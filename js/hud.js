// hud.js — DOM overlay HUD: energy icons, transient messages, scan state
// indicator/vignette, and full-screen title/won/dead screens.
//
// createHud(overlayEl) -> {
//   setEnergy(n): void,
//   showMessage(text, ms): void,
//   setScanState(state): void, // 0=unseen, 1=seen (head only), 2=draining
//   setScanned(bool): void,    // deprecated alias: false->0, true->2
//   setWatchers(sentinelAlive, sentryCount): void, // top-right watcher indicator
//   showScreen(kind): void   // kind: 'title' | 'won' | 'dead' | null
// }

const STYLE_ID = 'sentinel-hud-style';

const STYLE = `
#overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: "Courier New", Courier, monospace;
  color: #cfffd6;
}

/* ---------- energy icon row ---------- */
.hud-energy {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  max-width: 70%;
}

.hud-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 13px;
  line-height: 1;
  border-radius: 2px;
  text-shadow: 0 0 3px rgba(0,0,0,0.8);
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.6));
}

.hud-icon.robot { color: #d9a441; }   /* ochre */
.hud-icon.boulder { color: #9aa0a6; } /* grey */
.hud-icon.tree { color: #4fbf5a; }    /* green */

.hud-energy-count {
  margin-left: 6px;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #9fffb0;
  text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

.hud-energy.low .hud-energy-count {
  color: #ff6b5c;
  animation: hud-low-pulse 0.9s infinite;
}

@keyframes hud-low-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ---------- watcher indicator row (top-right, mirrors energy row) ---------- */
.hud-watchers {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  max-width: 70%;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(140, 200, 255, 0.35);
}

.hud-watch-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #cfe8ff;
  text-shadow: 0 0 4px rgba(120, 190, 255, 0.6), 0 0 3px rgba(0,0,0,0.8);
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.6));
  line-height: 1;
}

.hud-watch-icon.sentinel {
  width: 22px;
  height: 22px;
  font-size: 19px;
}

.hud-watch-icon.sentry {
  width: 17px;
  height: 17px;
  font-size: 14px;
  opacity: 0.9;
}

.hud-watchers-clear {
  margin-right: 6px;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #4a6a55;
  text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

/* ---------- transient bottom-center message ---------- */
.hud-message {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  padding: 6px 14px;
  background: rgba(6, 16, 8, 0.75);
  border: 1px solid #3a6a42;
  color: #d7ffde;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.hud-message.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ---------- scan-state indicator (top-center) ---------- */
.hud-scan-indicator {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 10px;
  background: rgba(6, 16, 8, 0.75);
  border: 1px solid #3a6a42;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  color: #2f6b3a;
  text-shadow: 0 0 3px rgba(0,0,0,0.8);
}

.hud-scan-indicator.state-0 {
  color: #3f8f4d;
  border-color: #2f5a37;
}

.hud-scan-indicator.state-1 {
  color: #e6b93d;
  border-color: #8a6a1e;
  animation: hud-indicator-pulse-mild 1.6s ease-in-out infinite;
}

.hud-scan-indicator.state-2 {
  color: #ff4b3c;
  border-color: #8a1e1e;
  animation: hud-indicator-pulse-strong 0.5s ease-in-out infinite;
}

@keyframes hud-indicator-pulse-mild {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes hud-indicator-pulse-strong {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ---------- scanned-by-sentinel vignette ---------- */
.hud-scan-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  box-shadow: inset 0 0 0 0 rgba(255, 30, 30, 0);
  transition: opacity 0.2s ease;
}

.hud-scan-vignette.mild {
  opacity: 1;
  box-shadow: inset 0 0 30px 6px rgba(230, 185, 61, 0.18);
  animation: hud-scan-pulse-mild 1.6s ease-in-out infinite;
}

.hud-scan-vignette.active {
  opacity: 1;
  animation: hud-scan-pulse 1.1s ease-in-out infinite;
}

@keyframes hud-scan-pulse-mild {
  0%   { box-shadow: inset 0 0 24px 4px rgba(230, 185, 61, 0.12); }
  50%  { box-shadow: inset 0 0 44px 10px rgba(230, 185, 61, 0.28); }
  100% { box-shadow: inset 0 0 24px 4px rgba(230, 185, 61, 0.12); }
}

@keyframes hud-scan-pulse {
  0%   { box-shadow: inset 0 0 40px 8px rgba(255, 30, 30, 0.25), inset 0 0 0 4px rgba(255, 30, 30, 0.35); }
  50%  { box-shadow: inset 0 0 90px 24px rgba(255, 30, 30, 0.65), inset 0 0 0 6px rgba(255, 30, 30, 0.8); }
  100% { box-shadow: inset 0 0 40px 8px rgba(255, 30, 30, 0.25), inset 0 0 0 4px rgba(255, 30, 30, 0.35); }
}

/* ---------- hyperspace / transfer flash ---------- */
.hud-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center,
    rgba(233, 255, 238, 0.95) 0%,
    rgba(190, 255, 205, 0.85) 55%,
    rgba(150, 240, 175, 0.7) 100%);
  opacity: 0;
  will-change: opacity;
}

/* ---------- full-canvas screens (title / won / dead) ---------- */
.hud-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: rgba(2, 6, 3, 0.88);
  text-align: center;
}

.hud-screen-title {
  font-size: 34px;
  letter-spacing: 0.18em;
  color: #9fffb0;
  text-shadow: 0 0 12px rgba(120, 255, 140, 0.6);
}

.hud-screen-sub {
  font-size: 14px;
  letter-spacing: 0.12em;
  color: #d7ffde;
  animation: hud-blink 1.2s steps(1) infinite;
}

.hud-screen-info {
  font-size: 13px;
  letter-spacing: 0.1em;
  color: #a8d8b0;
  margin: 2px 0;
}

.hud-screen.won .hud-screen-title { color: #9fffb0; }
.hud-screen.complete .hud-screen-title { color: #ffe08a; text-shadow: 0 0 14px rgba(255, 220, 120, 0.6); }
.hud-screen.dead .hud-screen-title { color: #ff6b5c; text-shadow: 0 0 12px rgba(255, 60, 40, 0.65); }

@keyframes hud-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.15; }
}

/* ---------- splash / menu / code screens ---------- */
/* These screens are interactive (menu clicks, splash "click anywhere"),
   so they opt back into pointer events that #overlay switches off. */
.hud-screen.splash,
.hud-screen.menu,
.hud-screen.code,
.hud-screen.settings {
  pointer-events: auto;
  cursor: default;
}

.hud-screen-title.big {
  font-size: 42px;
  letter-spacing: 0.22em;
}

.hud-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}

.hud-menu-option {
  font-size: 18px;
  letter-spacing: 0.16em;
  color: #4f8a5a;
  padding: 4px 22px;
  border: 1px solid transparent;
  cursor: pointer;
}

.hud-menu-option.selected {
  color: #cfffd6;
  border-color: #3a6a42;
  text-shadow: 0 0 10px rgba(120, 255, 140, 0.6);
}

.hud-menu-option.selected::before { content: "> "; }
.hud-menu-option.selected::after { content: " <"; }

.hud-code-value {
  font-size: 32px;
  letter-spacing: 0.3em;
  color: #9fffb0;
  text-shadow: 0 0 12px rgba(120, 255, 140, 0.5);
  margin: 4px 0;
}

.hud-code-hint {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #a8d8b0;
}

.hud-code-error {
  font-size: 13px;
  letter-spacing: 0.14em;
  color: #ff6b5c;
  text-shadow: 0 0 8px rgba(255, 60, 40, 0.5);
  min-height: 1.1em;
}

.hud-screen-footer {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  font-size: 11px;
  line-height: 1.7;
  letter-spacing: 0.12em;
  color: #4f8a5a;
}

/* ---------- settings (volumes) screen ---------- */
.hud-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 10px 0 4px;
  width: 300px;
  max-width: 78%;
}

.hud-setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 1px solid transparent;
  color: #4f8a5a;
}

.hud-setting-row.selected {
  color: #cfffd6;
  border-color: #3a6a42;
  text-shadow: 0 0 10px rgba(120, 255, 140, 0.5);
}

.hud-setting-label {
  flex: 0 0 84px;
  font-size: 14px;
  letter-spacing: 0.14em;
  text-align: left;
}

.hud-setting-track {
  position: relative;
  flex: 1 1 auto;
  height: 12px;
  border: 1px solid #3a6a42;
  background: #0c1a0e;
  cursor: pointer;
  pointer-events: auto;
}

.hud-setting-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  background: #2f6b3a;
}

.hud-setting-row.selected .hud-setting-fill {
  background: #4fbf5a;
  box-shadow: 0 0 8px rgba(120, 255, 140, 0.4);
}

.hud-setting-value {
  flex: 0 0 46px;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-align: right;
}

.hud-settings-hint {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #a8d8b0;
  margin-top: 6px;
}

/* ---------- screen-transition fader (black wipe) ---------- */
.hud-fader {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms ease;
}

/* ---------- level intro title ("LANDSCAPE NNNN") ---------- */
/* Big centred CRT title that rises in, holds, then drifts up and fades. Matches
   the green phosphor look of the end screens. Removed on animationend. */
.hud-intro-title {
  position: absolute;
  top: 30%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 40px;
  letter-spacing: 0.24em;
  color: #9fffb0;
  text-shadow: 0 0 16px rgba(120, 255, 140, 0.7), 0 0 4px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  opacity: 0;
  will-change: transform, opacity;
  animation: hud-intro 2.2s ease forwards;
}

@keyframes hud-intro {
  0%   { opacity: 0; transform: translateY(14px) scale(0.96); }
  16%  { opacity: 1; transform: translateY(0) scale(1); }
  68%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-42px) scale(1.03); }
}

/* ---------- energy tick feedback (drain / gain) ---------- */
.hud-energy.drain { animation: hud-energy-drain 0.3s ease; }
.hud-energy.gain  { animation: hud-energy-gain 0.3s ease; }

@keyframes hud-energy-drain {
  0%   { filter: none; }
  25%  { filter: brightness(1.35) drop-shadow(0 0 6px rgba(255, 64, 48, 0.95)); }
  100% { filter: none; }
}

@keyframes hud-energy-gain {
  0%   { transform: scale(1); filter: none; }
  40%  { transform: scale(1.16); filter: drop-shadow(0 0 6px rgba(120, 255, 150, 0.9)); }
  100% { transform: scale(1); filter: none; }
}
`;

function ensureStyleInjected() {
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);
}

// Icon glyphs (unicode-styled colored spans, no external assets).
const ICONS = {
  robot: '■',   // filled square — robot shell
  boulder: '●', // filled circle — boulder
  tree: '▲',    // filled triangle — tree
};

// Watcher glyphs (pale, unicode-styled — an "eye" for the Sentinel, a
// smaller diamond-eye for each sentry).
const WATCHER_ICONS = {
  sentinel: '◉',
  sentry: '◈',
};

const SCAN_STATE_TEXT = {
  0: 'UNSEEN',
  1: 'SEEN',
  2: 'DRAINING',
};

const SCREEN_TEXT = {
  title: { title: 'THE SENTINEL', sub: 'PRESS ENTER' },
  won: { title: 'LANDSCAPE ABSORBED', sub: 'PRESS ENTER' },
  dead: { title: 'ABSORBED BY THE SENTINEL', sub: 'PRESS ENTER' },
  complete: { title: 'ALL LANDSCAPES ABSORBED', sub: 'PRESS ENTER' },
};

// Attribution shown on splash / menu / code screens.
const FOOTER_LINES = [
  'BASED ON THE SENTINEL BY GEOFF CRAMMOND',
  'EKLEKTIK LABS 2026',
];

const MENU_OPTIONS = ['START GAME', 'ENTER CODE', 'SETTINGS'];

// Settings rows, in ↑↓ selection order. `key` matches settings.js item keys.
const SETTINGS_ITEMS = [
  { key: 'master', label: 'MASTER' },
  { key: 'music', label: 'MUSIC' },
  { key: 'effects', label: 'EFFECTS' },
];

export function createHud(overlayEl) {
  ensureStyleInjected();

  overlayEl.innerHTML = '';

  const energyRow = document.createElement('div');
  energyRow.className = 'hud-energy';
  overlayEl.appendChild(energyRow);

  const watchersRow = document.createElement('div');
  watchersRow.className = 'hud-watchers';
  overlayEl.appendChild(watchersRow);

  const messageEl = document.createElement('div');
  messageEl.className = 'hud-message';
  overlayEl.appendChild(messageEl);

  const scanIndicator = document.createElement('div');
  scanIndicator.className = 'hud-scan-indicator state-0';
  scanIndicator.textContent = SCAN_STATE_TEXT[0];
  overlayEl.appendChild(scanIndicator);

  const scanVignette = document.createElement('div');
  scanVignette.className = 'hud-scan-vignette';
  overlayEl.appendChild(scanVignette);

  const flashEl = document.createElement('div');
  flashEl.className = 'hud-flash';
  overlayEl.appendChild(flashEl);

  const screenEl = document.createElement('div');
  screenEl.className = 'hud-screen';
  screenEl.style.display = 'none';
  overlayEl.appendChild(screenEl);

  // Appended LAST so it sits above the screens: a full-frame black wipe used for
  // state transitions (menu<->game, restart, end screens).
  const faderEl = document.createElement('div');
  faderEl.className = 'hud-fader';
  overlayEl.appendChild(faderEl);

  let messageTimer = null;
  let flashTimer = null;
  let scanState = 0;
  let lastSentinelAlive = null;
  let lastSentryCount = null;
  let lastEnergy = null;        // for the drain/gain energy-tick diff
  let energyTickTimer = null;

  // opts.silent: set the baseline without playing a drain/gain tick (used when a
  // new level resets the energy — otherwise the jump would flash a false gain).
  function setEnergy(n, opts = {}) {
    energyRow.innerHTML = '';
    energyRow.classList.toggle('low', n <= 3 && n >= 0);

    if (!opts.silent && lastEnergy !== null && n !== lastEnergy) {
      const cls = n < lastEnergy ? 'drain' : 'gain';
      energyRow.classList.remove('drain', 'gain');
      void energyRow.offsetWidth;              // reflow so the animation restarts
      energyRow.classList.add(cls);
      if (energyTickTimer) clearTimeout(energyTickTimer);
      energyTickTimer = setTimeout(() => energyRow.classList.remove('drain', 'gain'), 320);
    }
    lastEnergy = n;

    let remaining = Math.max(0, Math.floor(n));

    const robots = Math.floor(remaining / 3);
    remaining -= robots * 3;
    const boulders = Math.floor(remaining / 2);
    remaining -= boulders * 2;
    const trees = remaining; // 1 each

    const frag = document.createDocumentFragment();

    for (let i = 0; i < robots; i++) {
      frag.appendChild(makeIcon('robot'));
    }
    for (let i = 0; i < boulders; i++) {
      frag.appendChild(makeIcon('boulder'));
    }
    for (let i = 0; i < trees; i++) {
      frag.appendChild(makeIcon('tree'));
    }

    energyRow.appendChild(frag);

    const countEl = document.createElement('span');
    countEl.className = 'hud-energy-count';
    countEl.textContent = String(n);
    energyRow.appendChild(countEl);
  }

  function makeIcon(kind) {
    const span = document.createElement('span');
    span.className = `hud-icon ${kind}`;
    span.textContent = ICONS[kind];
    return span;
  }

  function setWatchers(sentinelAlive, sentryCount) {
    const alive = !!sentinelAlive;
    const count = Math.max(0, Math.min(3, Math.floor(sentryCount) || 0));

    // Cheap no-op when values unchanged.
    if (alive === lastSentinelAlive && count === lastSentryCount) return;
    lastSentinelAlive = alive;
    lastSentryCount = count;

    watchersRow.innerHTML = '';

    if (!alive && count === 0) {
      const clearEl = document.createElement('span');
      clearEl.className = 'hud-watchers-clear';
      clearEl.textContent = 'CLEAR';
      watchersRow.appendChild(clearEl);
      return;
    }

    const frag = document.createDocumentFragment();

    if (alive) {
      frag.appendChild(makeWatchIcon('sentinel'));
    }
    for (let i = 0; i < count; i++) {
      frag.appendChild(makeWatchIcon('sentry'));
    }

    watchersRow.appendChild(frag);
  }

  function makeWatchIcon(kind) {
    const span = document.createElement('span');
    span.className = `hud-watch-icon ${kind}`;
    span.textContent = WATCHER_ICONS[kind];
    return span;
  }

  function showMessage(text, ms = 2000) {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    messageEl.textContent = text;
    // Force reflow so re-triggering the same message still animates.
    void messageEl.offsetWidth;
    messageEl.classList.add('visible');

    messageTimer = setTimeout(() => {
      messageEl.classList.remove('visible');
      messageTimer = null;
    }, ms);
  }

  function setScanState(state) {
    if (state === scanState) return; // cheap no-op when unchanged
    scanState = state;

    scanIndicator.className = `hud-scan-indicator state-${state}`;
    scanIndicator.textContent = SCAN_STATE_TEXT[state] ?? SCAN_STATE_TEXT[0];

    scanVignette.classList.toggle('mild', state === 1);
    scanVignette.classList.toggle('active', state === 2);
  }

  // Deprecated: thin alias over setScanState for backward compatibility.
  function setScanned(isScanned) {
    setScanState(isScanned ? 2 : 0);
  }

  // Full-screen greenish-white flash for teleport events. 'hyperspace' is a
  // strong, longer flash; 'transfer' is a softer, shorter one. Snaps to peak
  // over ~120ms, then fades out (400ms hyperspace / 280ms transfer).
  function flash(kind = 'hyperspace') {
    const strong = kind !== 'transfer';
    const peak = strong ? 0.85 : 0.42;
    const inMs = 120;
    const outMs = strong ? 400 : 280;
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    flashEl.style.transition = `opacity ${inMs}ms ease-out`;
    flashEl.style.opacity = String(peak);
    flashTimer = setTimeout(() => {
      flashEl.style.transition = `opacity ${outMs}ms ease-out`;
      flashEl.style.opacity = '0';
      flashTimer = null;
    }, inMs);
  }

  // `lines`: optional array of extra info strings rendered between the title
  // and the "PRESS ENTER" prompt (level codes, next-level info, ...).
  function showScreen(kind, lines = []) {
    if (!kind) {
      screenEl.style.display = 'none';
      screenEl.className = 'hud-screen';
      screenEl.innerHTML = '';
      return;
    }

    const text = SCREEN_TEXT[kind];
    if (!text) {
      screenEl.style.display = 'none';
      return;
    }

    screenEl.className = `hud-screen ${kind}`;
    screenEl.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'hud-screen-title';
    titleEl.textContent = text.title;
    screenEl.appendChild(titleEl);

    for (const line of lines) {
      const lineEl = document.createElement('div');
      lineEl.className = 'hud-screen-info';
      lineEl.textContent = line;
      screenEl.appendChild(lineEl);
    }

    const subEl = document.createElement('div');
    subEl.className = 'hud-screen-sub';
    subEl.textContent = text.sub;
    screenEl.appendChild(subEl);

    screenEl.style.display = 'flex';
  }

  // ---- splash / menu / code screens -------------------------------------
  // Share the .hud-screen container with showScreen(); each rebuilds it from
  // scratch and toggles it visible. Call showScreen(null) to dismiss.

  function makeDiv(cls, text) {
    const el = document.createElement('div');
    el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function appendFooter() {
    const footer = makeDiv('hud-screen-footer');
    for (const line of FOOTER_LINES) footer.appendChild(makeDiv(null, line));
    screenEl.appendChild(footer);
  }

  function showSplash() {
    screenEl.className = 'hud-screen splash';
    screenEl.innerHTML = '';
    const titleEl = makeDiv('hud-screen-title big', 'SENTINEL REMAKE');
    screenEl.appendChild(titleEl);
    screenEl.appendChild(makeDiv('hud-screen-sub', 'PRESS ENTER'));
    appendFooter();
    screenEl.style.display = 'flex';
  }

  // selectedIndex highlights one of MENU_OPTIONS. Option elements carry a
  // data-index attribute so a click/hover handler can map back to a choice.
  function showMenu(selectedIndex = 0) {
    screenEl.className = 'hud-screen menu';
    screenEl.innerHTML = '';
    screenEl.appendChild(makeDiv('hud-screen-title big', 'SENTINEL REMAKE'));
    const menu = makeDiv('hud-menu');
    MENU_OPTIONS.forEach((label, i) => {
      const opt = makeDiv(`hud-menu-option${i === selectedIndex ? ' selected' : ''}`, label);
      opt.dataset.index = String(i);
      menu.appendChild(opt);
    });
    screenEl.appendChild(menu);
    appendFooter();
    screenEl.style.display = 'flex';
  }

  // display: the code text already formatted as XXXX-XXXX (with placeholders
  // for not-yet-typed digits). error: optional message under the code.
  function showCode(display, error = '') {
    screenEl.className = 'hud-screen code';
    screenEl.innerHTML = '';
    screenEl.appendChild(makeDiv('hud-screen-title', 'ENTER CODE'));
    screenEl.appendChild(makeDiv('hud-code-value', display));
    screenEl.appendChild(makeDiv('hud-code-hint', 'DIGITS TO TYPE · BACKSPACE · ENTER CONFIRM · ESC BACK'));
    screenEl.appendChild(makeDiv('hud-code-error', error));
    appendFooter();
    screenEl.style.display = 'flex';
  }

  // display: settings screen with three volume sliders. `volumes` is the
  // {master,music,effects} object (0..100); `selectedIndex` highlights a row.
  // Rows carry data-key/data-index so main.js can map clicks/drags back.
  // Returns nothing; call setSettingValue() to live-update a row while dragging.
  let settingRowEls = [];
  function showSettings(volumes, selectedIndex = 0) {
    screenEl.className = 'hud-screen settings';
    screenEl.innerHTML = '';
    screenEl.appendChild(makeDiv('hud-screen-title', 'SETTINGS'));

    const list = makeDiv('hud-settings');
    settingRowEls = [];
    SETTINGS_ITEMS.forEach((item, i) => {
      const row = makeDiv(`hud-setting-row${i === selectedIndex ? ' selected' : ''}`);
      row.dataset.key = item.key;
      row.dataset.index = String(i);

      const label = makeDiv('hud-setting-label', item.label);
      const track = makeDiv('hud-setting-track');
      track.dataset.key = item.key;
      track.dataset.index = String(i);
      const fill = makeDiv('hud-setting-fill');
      track.appendChild(fill);
      const value = makeDiv('hud-setting-value');

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      list.appendChild(row);

      settingRowEls[i] = { row, fill, value };
      setSettingValue(i, volumes[item.key] ?? 0);
    });
    screenEl.appendChild(list);

    screenEl.appendChild(makeDiv('hud-settings-hint',
      '↑↓ SELECT · ←→ ADJUST · DRAG · ESC BACK'));
    screenEl.style.display = 'flex';
  }

  // Live update one settings row's fill width + numeric readout (no rebuild).
  function setSettingValue(index, pct) {
    const refs = settingRowEls[index];
    if (!refs) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    refs.fill.style.width = `${clamped}%`;
    refs.value.textContent = `${clamped}%`;
  }

  // Move the row highlight without rebuilding the whole screen.
  function setSettingSelection(index) {
    settingRowEls.forEach((refs, i) => {
      if (refs) refs.row.classList.toggle('selected', i === index);
    });
  }

  // ---- screen transitions ------------------------------------------------
  // Drive the black fader to opaque (fadeOut) or clear (fadeIn); `cb` fires when
  // the transition of length `ms` completes. main.js sequences these into a
  // fade-out -> swap -> fade-in around newGame()/showScreen()/goToMenu().
  function fadeOut(ms = 300, cb) {
    faderEl.style.transition = `opacity ${ms}ms ease`;
    void faderEl.offsetWidth;
    faderEl.style.opacity = '1';
    if (cb) setTimeout(cb, ms);
  }
  function fadeIn(ms = 300, cb) {
    faderEl.style.transition = `opacity ${ms}ms ease`;
    void faderEl.offsetWidth;
    faderEl.style.opacity = '0';
    if (cb) setTimeout(cb, ms);
  }

  // Big centred level-intro title; self-removes when its CSS animation ends.
  function showIntroTitle(text) {
    const el = document.createElement('div');
    el.className = 'hud-intro-title';
    el.textContent = text;
    overlayEl.appendChild(el);
    const remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('animationend', remove);
    setTimeout(remove, 2600);   // safety net if animationend is missed
  }

  return {
    setEnergy, showMessage, setScanState, setScanned, setWatchers, flash,
    showScreen, showSplash, showMenu, showCode,
    showSettings, setSettingValue, setSettingSelection,
    fadeOut, fadeIn, showIntroTitle,
    menuOptionCount: MENU_OPTIONS.length,
  };
}
