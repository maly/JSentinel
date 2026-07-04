// music.js — streamed background music over the SHARED AudioContext from
// audio.js (never a second context). Decoded .opus/.mp3 loops played through
// AudioBufferSourceNodes under a dedicated, quieter music gain.
//
// createMusic(getContext, getDestination) -> {
//   start(),                 // begin playback (after audio.unlock() created ctx)
//   setMode('menu'|'game'),  // which pool the NEXT track boundary draws from
//   onLevelWon(),            // mark "level completed during the current track"
//   ...debug getters (current, planned, next, mode, format, running, ctxState)
// }
//
// Playback contract (decisions are made ONLY at a track boundary — a track is
// never cut mid-way):
//   * menu mode: play `title`; when it ends and we are still in menu, play
//     `title` again.
//   * game mode: leaving the menu lets the current track (typically `title`)
//     finish, then `theme1` follows. On a `themeN` boundary: if a level was
//     won since this track started -> `theme(N+1)` (theme5 -> theme1); else the
//     same `themeN` repeats.
//   * won / dead / complete screens count as "in game" (music keeps flowing);
//     only a real return to the menu (setMode('menu')) routes back to `title`.

const MUSIC_GAIN = 0.35;       // sits UNDER audio.js's master (0.25) => quieter than SFX
const LOOKAHEAD = 0.35;        // seconds before a track's end to schedule its successor
const TICK_MS = 100;           // scheduler poll interval

const THEMES = ['theme1', 'theme2', 'theme3', 'theme4', 'theme5'];

export function createMusic(getContext, getDestination) {
  let ctx = null;
  let musicGain = null;
  let started = false;
  let disabled = false;         // set only on unrecoverable failure — stays silent

  let format = null;            // 'opus' | 'mp3' — decided on first decode, then cached
  const buffers = new Map();    // name -> AudioBuffer (decoded)
  const inflight = new Map();   // name -> Promise<AudioBuffer|null>

  let mode = 'menu';            // 'menu' | 'game'
  let wonFlag = false;          // a level was won since the ACTIVE track started

  // The track that is currently sounding.
  let activeSource = null;
  let activeName = null;
  let activeEnd = 0;            // ctx.currentTime at which the active track ends
  // The successor scheduled to begin, gaplessly, exactly at activeEnd.
  let nextSource = null;
  let nextName = null;
  let nextEnd = 0;

  let timer = null;

  // ---- decoding / loading -------------------------------------------------

  // Promise wrapper around decodeAudioData that also supports the old
  // callback-only signature (pre-promise Safari). decodeAudioData rejects on an
  // unsupported codec — that is exactly the .opus fallback trigger.
  function decode(data) {
    return new Promise((resolve, reject) => {
      let ret;
      try {
        ret = ctx.decodeAudioData(data, resolve, reject);
      } catch (e) {
        reject(e);
        return;
      }
      if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
    });
  }

  async function fetchDecode(name, ext) {
    const res = await fetch(`music/${name}.${ext}`);
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data = await res.arrayBuffer();
    return decode(data);
  }

  // Load+decode a track, caching both the buffer and the format decision.
  // Resolves to null (never throws) when the file is missing or undecodable so
  // the game can keep running silently.
  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (inflight.has(name)) return inflight.get(name);

    const p = (async () => {
      try {
        if (format === null) {
          // First-ever decode probes .opus; a failure switches EVERYTHING to
          // .mp3 for the rest of the session.
          try {
            const buf = await fetchDecode(name, 'opus');
            format = 'opus';
            return buf;
          } catch (e) {
            format = 'mp3';
            return await fetchDecode(name, 'mp3');
          }
        }
        return await fetchDecode(name, format);
      } catch (e) {
        return null;
      }
    })();

    inflight.set(name, p);
    return p.then((buf) => {
      inflight.delete(name);
      if (buf) buffers.set(name, buf);
      return buf;
    });
  }

  // Warm the buffers we are most likely to need next: title, the current theme
  // (for a repeat) and the next theme (for an advance).
  function prefetch(name) {
    const want = new Set(['title']);
    const idx = THEMES.indexOf(name);
    if (idx >= 0) {
      want.add(THEMES[idx]);
      want.add(THEMES[(idx + 1) % THEMES.length]);
    } else {
      want.add('theme1'); // title almost always leads into theme1
    }
    for (const t of want) load(t);
  }

  // ---- transition rules ---------------------------------------------------

  function chooseNext(name) {
    if (mode === 'menu') return 'title';
    // game mode
    const idx = THEMES.indexOf(name);
    if (idx < 0) return 'theme1';            // e.g. finishing `title` in game
    if (wonFlag) return THEMES[(idx + 1) % THEMES.length];
    return THEMES[idx];                      // no win -> repeat the same theme
  }

  // ---- playback -----------------------------------------------------------

  function makeSource(buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(musicGain);
    src.onended = () => onEnded(src);
    return src;
  }

  function beginActive(name, buf, when) {
    const src = makeSource(buf);
    try {
      src.start(when);
    } catch (e) {
      disable();
      return;
    }
    activeSource = src;
    activeName = name;
    activeEnd = when + buf.duration;
    nextSource = null;
    nextName = null;
    wonFlag = false;             // the win window is per active-track
    prefetch(name);
  }

  // Gapless boundary handling, polled slightly ahead of the known end time.
  function tick() {
    if (disabled || !ctx || !activeSource) return;
    const t = ctx.currentTime;

    // Schedule the successor a hair before the boundary so it can start(when)
    // exactly at activeEnd with no seam.
    if (!nextSource && t >= activeEnd - LOOKAHEAD) {
      const name = chooseNext(activeName);
      const buf = buffers.get(name);
      if (buf) {
        const src = makeSource(buf);
        try {
          src.start(activeEnd);
          nextSource = src;
          nextName = name;
          nextEnd = activeEnd + buf.duration;
        } catch (e) {
          disable();
          return;
        }
      } else {
        // Not decoded yet (prefetch didn't finish) — make sure it loads; the
        // onended fallback will pick it up, accepting a small gap.
        load(name);
      }
    }

    // Promote the scheduled successor to "active" once its start time passed.
    if (nextSource && t >= activeEnd) {
      activeSource = nextSource;
      activeName = nextName;
      activeEnd = nextEnd;
      nextSource = null;
      nextName = null;
      wonFlag = false;
      prefetch(activeName);
    }
  }

  // Fallback when the gapless path could not pre-schedule (buffer wasn't ready
  // in time). Fires on the natural end of a source; starts the successor ASAP.
  function onEnded(src) {
    if (disabled) return;
    if (src !== activeSource) return;   // already superseded/promoted — ignore
    if (nextSource) return;             // gapless successor is already sounding
    const name = chooseNext(activeName);
    load(name).then((buf) => {
      if (disabled) return;
      // Only recover if nothing else took over in the meantime.
      if (src !== activeSource || nextSource) return;
      if (!buf) { disable(); return; } // successor unavailable -> go silent
      beginActive(name, buf, Math.max(ctx.currentTime, activeEnd) + 0.02);
    });
  }

  function disable() {
    disabled = true;
    if (timer) { clearInterval(timer); timer = null; }
    try { if (activeSource) activeSource.stop(); } catch (e) { /* ignore */ }
    activeSource = null;
    nextSource = null;
  }

  // ---- public API ---------------------------------------------------------

  // Idempotent. A no-op until audio.unlock() has created the shared context;
  // callers wire it next to every audio.unlock() so the first gesture starts it.
  function start() {
    if (started || disabled) return;
    ctx = getContext();
    const dest = getDestination();
    if (!ctx || !dest) return;          // not unlocked yet — a later call retries
    started = true;

    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_GAIN;
    musicGain.connect(dest);

    // The menu is where start() is invoked, so the opening track is `title`.
    load('title').then((buf) => {
      if (disabled) return;
      if (!buf) { disable(); return; }  // no title asset -> silent, game unaffected
      beginActive('title', buf, ctx.currentTime + 0.05);
      if (!timer) timer = setInterval(tick, TICK_MS);
    });
  }

  function setMode(m) {
    if (m === 'menu' || m === 'game') mode = m;
  }

  function onLevelWon() {
    wonFlag = true;
  }

  return {
    start,
    setMode,
    onLevelWon,
    // Debug hooks (harmless in production; used by the smoke test).
    get current() { return activeName; },
    get planned() { return activeName ? chooseNext(activeName) : null; },
    get next() { return nextName; },
    get mode() { return mode; },
    get won() { return wonFlag; },
    get format() { return format; },
    get running() { return started && !disabled && !!activeSource; },
    get ctxState() { return ctx ? ctx.state : 'none'; },
  };
}
