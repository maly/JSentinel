// audio.js — synthesized retro SFX via vanilla WebAudio, no external assets.
//
// createAudio() -> {
//   unlock(): void,        // create/resume AudioContext; call on first user gesture
//   play(name): void,      // play a named sound; silent no-op before unlock()
//   context(): AudioContext|null,   // the shared context (null before unlock)
//   musicBus(): GainNode|null,      // music sub-bus — music routes UNDER it
//   setVolumes({master,music,effects}): void, // 0..100 percentages (Settings)
// }
//
// Bus graph:  destination <- limiter <- master <- sfxBus  (SFX play() routes here)
//                                              <- musicBus (music.js routes here)
//
// The three Settings sliders drive the three gain nodes. 100% on each slider
// reproduces the pre-Settings balance exactly (relative SFX vs. music mix is
// unchanged), so the mapping is:
//   master node gain = MASTER_MAX * master%/100   (MASTER_MAX = overall loudness knob)
//   sfxBus   node gain = effects%/100             (100% => unity)
//   musicBus node gain = music%/100               (100% => unity; music.js keeps
//                                                  its own 0.35 gain underneath)
// A DynamicsCompressorNode sits between master and destination as a safety
// limiter so simultaneous SFX + music at high volume doesn't clip.
//
// Sound names: 'absorb', 'create', 'transfer', 'hyperspace', 'drain',
// 'seen', 'draining', 'meanie', 'uturn', 'won', 'dead'

const MASTER_MAX = 1.0;   // gain of the master node when its slider is at 100%

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicSub = null;
  let limiter = null;

  // Desired slider values (0..100). Applied live once the nodes exist; stored
  // beforehand so Settings can be changed before the first user gesture.
  const vols = { master: 100, music: 100, effects: 100 };

  function clampPct(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return 100;
    return Math.max(0, Math.min(100, n));
  }

  function applyVolumes() {
    if (master) master.gain.value = MASTER_MAX * vols.master / 100;
    if (sfxBus) sfxBus.gain.value = vols.effects / 100;
    if (musicSub) musicSub.gain.value = vols.music / 100;
  }

  function unlock() {
    try {
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return; // no WebAudio support — silent no-op forever
        ctx = new Ctor();
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.knee.value = 6;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.25;
        limiter.connect(ctx.destination);
        master = ctx.createGain();
        master.connect(limiter);
        sfxBus = ctx.createGain();
        sfxBus.connect(master);
        musicSub = ctx.createGain();
        musicSub.connect(master);
        applyVolumes();
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {
      // Swallow — audio is never allowed to throw into game logic.
    }
  }

  function play(name) {
    if (!ctx || !sfxBus) return; // play() before unlock() is a silent no-op
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      fn(ctx, sfxBus);
    } catch (e) {
      // Swallow — a bad synth call should never crash the game.
    }
  }

  // Update the Settings volumes (partial objects allowed). Applied instantly to
  // the running graph so changes are audible while the slider is dragged.
  function setVolumes(next) {
    if (!next) return;
    if (next.master !== undefined) vols.master = clampPct(next.master);
    if (next.music !== undefined) vols.music = clampPct(next.music);
    if (next.effects !== undefined) vols.effects = clampPct(next.effects);
    applyVolumes();
  }

  // Expose the shared context + music sub-bus so music.js can reuse them (one
  // AudioContext for the whole app). Both are null until unlock() runs.
  function context() { return ctx; }
  function musicBus() { return musicSub; }

  return { unlock, play, context, musicBus, setVolumes };
}

// ---------- low-level helpers ----------

function now(ctx) {
  return ctx.currentTime;
}

// 10%-duty pulse wave via Fourier series — WebAudio oscillators have no duty
// parameter, but a PeriodicWave with sin(n*pi*d) harmonics is exactly a pulse
// train. Far mellower than sawtooth/square for the dissolve sounds.
const pulseWaveCache = new WeakMap();
function pulseWave(ctx, duty = 0.1) {
  let byDuty = pulseWaveCache.get(ctx);
  if (!byDuty) { byDuty = new Map(); pulseWaveCache.set(ctx, byDuty); }
  if (!byDuty.has(duty)) {
    const N = 32;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    byDuty.set(duty, ctx.createPeriodicWave(real, imag));
  }
  return byDuty.get(duty);
}

// Create an oscillator + its own gain envelope, connected to `dest`.
// `type: 'pulse'` selects the 10%-duty pulse wave (optionally `duty`).
function tone(ctx, dest, { type = 'sine', freq = 440, start = 0, dur = 0.2, duty = 0.1 }) {
  const osc = ctx.createOscillator();
  if (type === 'pulse') {
    osc.setPeriodicWave(pulseWave(ctx, duty));
  } else {
    osc.type = type;
  }
  const t0 = now(ctx) + start;
  osc.frequency.setValueAtTime(freq, t0);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(t0);
  osc.stop(t0 + dur + 0.05);

  return { osc, gain, t0 };
}

// Simple exponential attack/decay envelope on a gain node.
function envelope(gain, t0, { peak = 1, attack = 0.01, dur = 0.2 }) {
  const g = gain.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function freqSweep(osc, t0, fromFreq, toFreq, dur) {
  osc.frequency.setValueAtTime(fromFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), t0 + dur);
}

// Build a short white-noise AudioBuffer (no ScriptProcessor needed).
function noiseBuffer(ctx, dur) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * dur));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function noiseSource(ctx, dest, dur, { filterType = 'lowpass', filterFreq = 2000 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now(ctx));

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  return { src, filter, gain };
}

// ---------- individual synth patches ----------

// Soft "dissolve" buzz layered under absorb/create — runs for the whole
// materialization (~1.2 s, matching the game's DISSOLVE_SECONDS) with a
// square-wave tremolo for the original's crackly dissolve character.
function buzzLayer(ctx, dest, { dur = 1.2, base = 70, peak = 0.25 } = {}) {
  const t0 = now(ctx);

  const { gain } = tone(ctx, dest, { type: 'pulse', duty: 0.15, freq: base, dur });
  envelope(gain, t0, { peak, attack: 0.08, dur });

  const { gain: gain2 } = tone(ctx, dest, { type: 'pulse', duty: 0.1, freq: base * 1.02, dur });
  envelope(gain2, t0, { peak: peak * 0.7, attack: 0.08, dur });

  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 26;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = peak * 0.5;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.05);
}

function sfxAbsorb(ctx, dest) {
  const dur = 0.6;
  const t0 = now(ctx);

  // Gentle 10%-duty pulse falling from a modest height — no sharp "tjou".
  const { osc, gain } = tone(ctx, dest, { type: 'pulse', freq: 380, dur });
  freqSweep(osc, t0, 380, 110, dur);
  envelope(gain, t0, { peak: 0.7, attack: 0.08, dur });

  const { osc: osc2, gain: gain2 } = tone(ctx, dest, { type: 'pulse', freq: 190, dur });
  freqSweep(osc2, t0, 190, 70, dur);
  envelope(gain2, t0, { peak: 0.45, attack: 0.08, dur });

  buzzLayer(ctx, dest, { base: 62 });
}

function sfxCreate(ctx, dest) {
  const dur = 0.5;
  const t0 = now(ctx);

  const { osc, gain } = tone(ctx, dest, { type: 'pulse', freq: 110, dur });
  freqSweep(osc, t0, 110, 380, dur);
  envelope(gain, t0, { peak: 0.7, attack: 0.08, dur });

  const { osc: osc2, gain: gain2 } = tone(ctx, dest, { type: 'pulse', freq: 70, dur });
  freqSweep(osc2, t0, 70, 190, dur);
  envelope(gain2, t0, { peak: 0.45, attack: 0.08, dur });

  buzzLayer(ctx, dest, { base: 78 });
}

function sfxTransfer(ctx, dest) {
  const t0 = now(ctx);
  const notes = [330, 415, 494, 660]; // quick upward arpeggio
  const step = 0.09;
  notes.forEach((freq, i) => {
    const start = i * step;
    const { osc, gain } = tone(ctx, dest, { type: 'triangle', freq, start, dur: 0.12 });
    envelope(gain, t0 + start, { peak: 0.7, attack: 0.005, dur: 0.12 });
  });
}

function sfxHyperspace(ctx, dest) {
  const dur = 0.9;
  const t0 = now(ctx);

  const { src, gain } = noiseSource(ctx, dest, dur, { filterType: 'bandpass', filterFreq: 2200 });
  src.playbackRate.value = 1;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.8, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.start(t0);
  src.stop(t0 + dur + 0.05);

  // Falling-pitch companion tone gives the noise whoosh a sense of descent.
  const { osc, gain: toneGain } = tone(ctx, dest, { type: 'sawtooth', freq: 1200, dur });
  freqSweep(osc, t0, 1200, 60, dur);
  envelope(toneGain, t0, { peak: 0.4, attack: 0.02, dur });
}

function sfxDrain(ctx, dest) {
  const dur = 0.4;
  const t0 = now(ctx);
  const pulseCount = 3;
  const pulseDur = dur / pulseCount;

  for (let i = 0; i < pulseCount; i++) {
    const start = i * pulseDur;
    const { gain } = tone(ctx, dest, { type: 'square', freq: 70, start, dur: pulseDur * 0.8 });
    envelope(gain, t0 + start, { peak: 0.8, attack: 0.005, dur: pulseDur * 0.8 });
  }
}

function sfxSeen(ctx, dest) {
  const dur = 0.2;
  const t0 = now(ctx);
  const { osc, gain } = tone(ctx, dest, { type: 'square', freq: 880, dur });
  freqSweep(osc, t0, 880, 1100, dur);
  envelope(gain, t0, { peak: 0.5, attack: 0.005, dur });
}

function sfxDraining(ctx, dest) {
  const t0 = now(ctx);
  const { gain: g1 } = tone(ctx, dest, { type: 'square', freq: 1000, dur: 0.15 });
  envelope(g1, t0, { peak: 0.7, attack: 0.003, dur: 0.15 });

  const { gain: g2 } = tone(ctx, dest, { type: 'square', freq: 600, start: 0.15, dur: 0.2 });
  envelope(g2, t0 + 0.15, { peak: 0.7, attack: 0.003, dur: 0.2 });
}

function sfxMeanie(ctx, dest) {
  const dur = 0.4;
  const t0 = now(ctx);

  const { gain: g1 } = tone(ctx, dest, { type: 'sawtooth', freq: 220, dur });
  envelope(g1, t0, { peak: 0.7, attack: 0.005, dur });

  const { gain: g2 } = tone(ctx, dest, { type: 'square', freq: 233, dur }); // dissonant minor-second clash
  envelope(g2, t0, { peak: 0.6, attack: 0.005, dur });
}

function sfxUturn(ctx, dest) {
  const dur = 0.1;
  const t0 = now(ctx);
  const { osc, gain } = tone(ctx, dest, { type: 'square', freq: 1400, dur });
  freqSweep(osc, t0, 1400, 900, dur);
  envelope(gain, t0, { peak: 0.4, attack: 0.002, dur });
}

function sfxWon(ctx, dest) {
  const t0 = now(ctx);
  const notes = [523, 659, 784, 1047]; // C-E-G-C rising jingle
  const step = 0.22;
  notes.forEach((freq, i) => {
    const start = i * step;
    const dur = i === notes.length - 1 ? 0.5 : 0.24;
    const { gain } = tone(ctx, dest, { type: 'triangle', freq, start, dur });
    envelope(gain, t0 + start, { peak: 0.8, attack: 0.01, dur });
  });
}

function sfxDead(ctx, dest) {
  const dur = 1.2;
  const t0 = now(ctx);

  const { osc, gain } = tone(ctx, dest, { type: 'sawtooth', freq: 500, dur });
  freqSweep(osc, t0, 500, 40, dur);
  envelope(gain, t0, { peak: 0.8, attack: 0.02, dur });

  const { osc: osc2, gain: gain2 } = tone(ctx, dest, { type: 'square', freq: 250, dur });
  freqSweep(osc2, t0, 250, 30, dur);
  envelope(gain2, t0, { peak: 0.5, attack: 0.02, dur });
}

const SOUNDS = {
  absorb: sfxAbsorb,
  create: sfxCreate,
  transfer: sfxTransfer,
  hyperspace: sfxHyperspace,
  drain: sfxDrain,
  seen: sfxSeen,
  draining: sfxDraining,
  meanie: sfxMeanie,
  uturn: sfxUturn,
  won: sfxWon,
  dead: sfxDead,
};
