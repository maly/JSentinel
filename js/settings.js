// settings.js — persistent audio-volume settings (Master / Music / Effects).
//
// createSettings(audio) -> {
//   items,                     // [{key,label}] in display order (↑↓ selection)
//   get(key): number,          // current 0..100 value
//   all(): {master,music,effects},
//   nudge(key, delta): number, // change by delta (clamped/rounded), persist+apply
//   setValue(key, pct): number,// set absolute (clamped/rounded), persist+apply
// }
//
// Values are integer percentages 0..100. They are persisted to localStorage
// under `sentinel.volume` as JSON and pushed into the audio bus graph on every
// change (live) and once at construction (so a saved profile is honoured from
// the first sound). Defaults are 100/100/100 which reproduce the original mix.

const STORAGE_KEY = 'sentinel.volume';
const STEP = 5; // keyboard ←/→ increment

const ITEMS = [
  { key: 'master', label: 'MASTER' },
  { key: 'music', label: 'MUSIC' },
  { key: 'effects', label: 'EFFECTS' },
];

const DEFAULTS = { master: 100, music: 100, effects: 100 };

function clampInt(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, n));
}

function load() {
  const out = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const { key } of ITEMS) {
        if (parsed && parsed[key] !== undefined) out[key] = clampInt(parsed[key]);
      }
    }
  } catch (e) {
    // Corrupt/blocked storage — fall back to defaults, never throw.
  }
  return out;
}

export function createSettings(audio) {
  const values = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch (e) {
      // Storage may be unavailable (private mode); volumes still apply live.
    }
  }

  function apply() {
    if (audio && audio.setVolumes) audio.setVolumes(values);
  }

  function setValue(key, pct) {
    if (!(key in values)) return undefined;
    values[key] = clampInt(pct);
    apply();
    save();
    return values[key];
  }

  function nudge(key, delta) {
    if (!(key in values)) return undefined;
    return setValue(key, values[key] + delta);
  }

  // Push the loaded profile into the audio graph immediately (stored until the
  // context is unlocked, then honoured on the first sound).
  apply();

  return {
    items: ITEMS,
    step: STEP,
    get(key) { return values[key]; },
    all() { return { ...values }; },
    setValue,
    nudge,
  };
}
