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

  const screenEl = document.createElement('div');
  screenEl.className = 'hud-screen';
  screenEl.style.display = 'none';
  overlayEl.appendChild(screenEl);

  let messageTimer = null;
  let scanState = 0;
  let lastSentinelAlive = null;
  let lastSentryCount = null;

  function setEnergy(n) {
    energyRow.innerHTML = '';
    energyRow.classList.toggle('low', n <= 3 && n >= 0);

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

  return { setEnergy, showMessage, setScanState, setScanned, setWatchers, showScreen };
}
