// audio.js — synthesized retro SFX via vanilla WebAudio, no external assets.
//
// createAudio() -> {
//   unlock(): void,        // create/resume AudioContext; call on first user gesture
//   play(name): void,      // play a named sound; silent no-op before unlock()
// }
//
// Sound names: 'absorb', 'create', 'transfer', 'hyperspace', 'drain',
// 'seen', 'draining', 'meanie', 'uturn', 'won', 'dead'

const MASTER_GAIN = 0.25;

export function createAudio() {
  let ctx = null;
  let master = null;

  function unlock() {
    try {
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return; // no WebAudio support — silent no-op forever
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {
      // Swallow — audio is never allowed to throw into game logic.
    }
  }

  function play(name) {
    if (!ctx || !master) return; // play() before unlock() is a silent no-op
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      fn(ctx, master);
    } catch (e) {
      // Swallow — a bad synth call should never crash the game.
    }
  }

  return { unlock, play };
}

// ---------- low-level helpers ----------

function now(ctx) {
  return ctx.currentTime;
}

// Create an oscillator + its own gain envelope, connected to `dest`.
function tone(ctx, dest, { type = 'sine', freq = 440, start = 0, dur = 0.2 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
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

function sfxAbsorb(ctx, dest) {
  const dur = 0.5;
  const t0 = now(ctx);

  const { osc, gain } = tone(ctx, dest, { type: 'sawtooth', freq: 900, dur });
  freqSweep(osc, t0, 900, 140, dur);
  envelope(gain, t0, { peak: 0.9, attack: 0.02, dur });

  const { osc: osc2, gain: gain2 } = tone(ctx, dest, { type: 'square', freq: 450, dur });
  freqSweep(osc2, t0, 450, 90, dur);
  envelope(gain2, t0, { peak: 0.5, attack: 0.02, dur });
}

function sfxCreate(ctx, dest) {
  const dur = 0.5;
  const t0 = now(ctx);

  const { osc, gain } = tone(ctx, dest, { type: 'sawtooth', freq: 140, dur });
  freqSweep(osc, t0, 140, 900, dur);
  envelope(gain, t0, { peak: 0.9, attack: 0.02, dur });

  const { osc: osc2, gain: gain2 } = tone(ctx, dest, { type: 'square', freq: 90, dur });
  freqSweep(osc2, t0, 90, 450, dur);
  envelope(gain2, t0, { peak: 0.5, attack: 0.02, dur });
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
