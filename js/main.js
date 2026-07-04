// The Sentinel — integration layer: level setup, state machine, game loop.
// Wires terrain/world/game (logic) to renderer/input/hud (presentation).

import { generateTerrain } from './terrain.js';
import { World } from './world.js';
import { Game } from './game.js';
import { render, setPalette, PALETTES } from './renderer.js';
import { screenRay } from './math3d.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import { createSettings } from './settings.js';
import { levelToSeed, seedToLevel, formatLevel, formatSeed, parseSeed } from './levels.js';

const LOGIC_HZ = 10;
const YAW_SPEED = 1.2;        // rad/s
const YAW_SPEED_FAST = 3.0;
const PITCH_LIMIT = Math.PI / 3;
// Jump-turn easing (u-turn / transfer). Held-key rotation is NEVER eased (that
// would add input lag) — only discrete target changes tween. rate ~10 => the
// 180° u-turn sweeps in ~250ms. angleDiff picks the shortest direction.
const YAW_TWEEN_RATE = 10;
// Drain shake: exp decay ~0.5s (rate 5 => e^-2.5 after 0.5s). Render-only.
const SHAKE_DECAY = 5;
function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const BOULDER_COUNT = 2;
const START_ENERGY = 10;

// Difficulty rises in steps of 200 levels and maxes out at level 2000:
// tier 0 = levels 0000-0199 (today's balance), tier 10 = harshest.
// Harder tiers mean rougher terrain, fewer trees and more sentries.
function difficultyFor(level) {
  const tier = Math.min(Math.floor(level / 200), 10);
  const t = tier / 10;
  return {
    tier,
    ruggedness: t,                                  // terrain generator knob
    treeDensity: 0.25 - 0.15 * t,                   // 25% -> 10% of free flats
    minSentries: tier >= 6 ? 3 : (tier >= 3 ? 2 : 1),
  };
}

// Deterministic level generation: the level's 8-digit code drives BOTH the
// terrain and the object scatter, so a landscape is fully reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ?seed=NNNNNNNN — an 8-digit landscape code. A valid code (one that maps
// back to a level 0000-9999) turns the URL into a deep link: after the splash
// it launches that landscape directly, bypassing the menu. Missing/invalid
// codes leave { present:false } and the game starts from the menu at 0000.
function urlSeed() {
  const raw = new URLSearchParams(location.search).get('seed');
  const code = parseSeed(raw ?? '');
  const lvl = code === null ? null : seedToLevel(code);
  if (lvl === null) return { present: false, level: 0 };
  return { present: true, level: lvl };
}

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const hud = createHud(document.getElementById('overlay'));
const audio = createAudio();
// Background music shares audio.js's single AudioContext (no second context).
const music = createMusic(audio.context, audio.musicBus);
// Audio volume settings (Master/Music/Effects) — loads any saved profile from
// localStorage and pushes it into the audio bus graph immediately.
const settings = createSettings(audio);
const overlayEl = document.getElementById('overlay');
// Browsers only allow audio after a user gesture. The splash/menu key & click
// handlers below call unlockAudio() on every interaction (idempotent), so an
// Enter on the splash is guaranteed to unlock before the game starts. These
// once-listeners stay as a catch-all for gestures that bypass those handlers.
// music.start() can only take effect once unlock() has created the context, so
// it is paired with every unlock() call.
function unlockAudio() {
  audio.unlock();
  music.start();
}
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('mousedown', unlockAudio, { once: true });

// State machine:
//   'splash' -> 'menu' -> 'playing'         (menu START GAME)
//   'menu'   -> 'code' -> 'playing'         (menu ENTER CODE, valid code)
//   'playing' -> 'won' | 'complete' | 'dead' (Enter restarts, Esc -> 'menu')
// A valid ?seed= deep-links 'splash' -> 'playing' directly.
const seedLink = urlSeed();
let state = 'splash';         // 'splash' | 'menu' | 'code' | 'playing' | 'won' | 'complete' | 'dead' | 'settings'
let world = null;
let game = null;
let camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, targetYaw: 0 };
// Jump-turn tween + drain-shake state (render/camera only, never logic/pick).
let yawTweening = false;
let shake = 0;
let level = seedLink.level;   // 0000-9999
let nextLevel = null;         // set when a level is won

// Menu / code-entry transient state.
let menuSelection = 0;
let codeDigits = '';          // up to 8 typed digits

// Settings-screen transient state. `settingsReturn` remembers where Esc came
// from ('menu' or 'playing') so the second Esc lands back there unchanged.
let settingsSelection = 0;
let settingsReturn = 'menu';

// ---- Level setup ----------------------------------------------------------
// Terrain gives us bare tiles; the level itself (Sentinel on its pedestal on
// the highest plateau, scattered trees/boulders, player start far away) is
// composed here.

function flatTiles(tiles) {
  const out = [];
  for (let z = 0; z < tiles.length; z++) {
    for (let x = 0; x < tiles[z].length; x++) {
      if (tiles[z][x].flat) out.push({ x, z, height: tiles[z][x].height });
    }
  }
  return out;
}

function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function setupLevel(w, rng, diff) {
  const flats = flatTiles(w.tiles);

  // Sentinel on the single highest plateau.
  const maxH = Math.max(...flats.map((t) => t.height));
  const summit = pickRandom(flats.filter((t) => t.height === maxH), rng);
  w.addObject({ type: 'pedestal', x: summit.x, z: summit.z });
  const sentinel = w.addObject({ type: 'sentinel', x: summit.x, z: summit.z, facing: rng() * Math.PI * 2 });
  const minH = Math.min(...flats.map((t) => t.height));

  // Sentries: 1-3 mini sentinels on LOCAL hilltops (flat tiles at least as
  // high as all 8 neighbours, below the summit), spread evenly — each pick
  // maximizes its minimum distance to the Sentinel and prior sentries.
  const size = w.tiles.length;
  const tileTopH = (x, z) => {
    const t = w.tiles[z][x];
    return t.flat ? t.height : Math.max(...t.h);
  };
  const hilltops = flats.filter((t) => {
    if (t.height >= maxH || w.objectsAt(t.x, t.z).length > 0) return false;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = t.x + dx, nz = t.z + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        if (tileTopH(nx, nz) > t.height) return false;
      }
    }
    return true;
  });
  // Prefer the higher third of hilltop candidates — the summit dwarfs the
  // general landscape, so an absolute midpoint threshold would filter out
  // every real hill.
  const byHeight = hilltops.slice().sort((a, b) => b.height - a.height);
  // Difficulty raises the guaranteed minimum; the cap stays at 3.
  const minS = diff.minSentries;
  const sentryCount = Math.min(3, minS + Math.floor(rng() * (4 - minS)));
  const elevated = byHeight.slice(0, Math.max(sentryCount * 3, Math.ceil(byHeight.length / 3)));
  let sentryPool = elevated.length >= sentryCount ? elevated : hilltops;
  const anchors = [{ x: summit.x, z: summit.z }];
  const sentries = [];
  for (let i = 0; i < sentryCount && sentryPool.length; i++) {
    let best = null, bestScore = -1;
    for (const c of sentryPool) {
      const score = Math.min(...anchors.map((a) => (a.x - c.x) ** 2 + (a.z - c.z) ** 2));
      if (score > bestScore) { bestScore = score; best = c; }
    }
    anchors.push(best);
    sentryPool = sentryPool.filter((c) => c !== best);
    sentries.push(w.addObject({
      type: 'sentry', x: best.x, z: best.z,
      facing: rng() * Math.PI * 2, _rotT: rng() * 10,   // staggered scan phase
    }));
  }

  // Player start: an empty low flat tile, far from the Sentinel and with its
  // base square hidden from every watcher's eye (terrain LOS, ignoring facing
  // — watchers sweep, so a merely-out-of-cone tile is not safe).
  const eyes = [
    { x: summit.x + 0.5, y: sentinel.y + 1.9, z: summit.z + 0.5 },
    ...sentries.filter(Boolean).map((s) => ({ x: s.x + 0.5, y: s.y + 1.7, z: s.z + 0.5 })),
  ];
  const lows = flats.filter((t) => t.height <= minH + 1 && w.objectsAt(t.x, t.z).length === 0);
  const basePoint = (t) => ({ x: t.x + 0.5, y: w.surfaceY(t.x, t.z) + 0.05, z: t.z + 0.5 });
  const hiddenAll = lows.filter((t) => eyes.every((e) => !w.canSee(e, basePoint(t))));
  const hiddenSentinel = lows.filter((t) => !w.canSee(eyes[0], basePoint(t)));
  const pool = hiddenAll.length ? hiddenAll : (hiddenSentinel.length ? hiddenSentinel : lows);
  const dist2 = (t) => (t.x - summit.x) ** 2 + (t.z - summit.z) ** 2;
  pool.sort((a, b) => dist2(b) - dist2(a));
  const start = pickRandom(pool.slice(0, Math.max(1, Math.floor(pool.length / 10))), rng);

  // Scatter trees over the difficulty-scaled share of free flat tiles
  // (25% at tier 0 down to 10% at max), plus a couple of boulders.
  const free = () => flats.filter(
    (t) => w.objectsAt(t.x, t.z).length === 0 && !(t.x === start.x && t.z === start.z),
  );
  const treeCount = Math.floor(free().length * diff.treeDensity);
  for (let i = 0; i < treeCount; i++) {
    const spots = free();
    if (!spots.length) break;
    const s = pickRandom(spots, rng);
    w.addObject({ type: 'tree', x: s.x, z: s.z });
  }
  for (let i = 0; i < BOULDER_COUNT; i++) {
    const spots = free();
    if (!spots.length) break;
    const s = pickRandom(spots, rng);
    w.addObject({ type: 'boulder', x: s.x, z: s.z });
  }

  return { start, sentinel };
}

function newGame() {
  const code = levelToSeed(level);
  const diff = difficultyFor(level);
  // Level 0000 keeps the classic green look; other levels cycle palettes
  // pseudo-randomly via their landscape code.
  setPalette(level === 0 ? 0 : code % PALETTES.length);
  world = new World(generateTerrain(code, diff.ruggedness));
  const rng = mulberry32((code ^ 0x9e3779b9) >>> 0);
  const { start, sentinel } = setupLevel(world, rng, diff);
  game = new Game(world, { x: start.x, z: start.z, energy: START_ENERGY });
  // Face the Sentinel on spawn (math3d yaw convention: 0 = +Z, dir.x = sin yaw).
  camera.yaw = Math.atan2(sentinel.x - start.x, sentinel.z - start.z);
  camera.targetYaw = camera.yaw;   // spawn snaps (no start-of-level spin)
  yawTweening = false;
  shake = 0;
  camera.pitch = 0;
  syncCamera();
  state = 'playing';
  // Entering gameplay: after the current track (typically `title`) finishes,
  // the theme rotation takes over. won/dead/complete stay in game mode.
  music.setMode('game');
  lastScanState = 0;
  nextLevel = null;
  hud.showScreen(null);
  hud.setEnergy(game.energy);
  hud.showMessage(`LANDSCAPE ${formatLevel(level)}`, 3000);
}

function syncCamera() {
  camera.x = game.camera.x + 0.5;
  camera.z = game.camera.z + 0.5;
  camera.y = game.camera.eyeY;
}

// ---- Splash / menu / code navigation ----------------------------------
// input.js only knows a handful of game keys (Enter -> 'start'), so menu
// navigation gets its own keydown listener, active only outside 'playing'.
// The game loop drains and ignores input.js actions while in these states.

const MENU_COUNT = hud.menuOptionCount;

// Partial code as XXXX-XXXX with '_' placeholders for untyped digits. Once all
// 8 are in, formatSeed() gives the identical canonical form.
function codeDisplay(digits) {
  const padded = digits.padEnd(8, '_');
  return `${padded.slice(0, 4)}-${padded.slice(4)}`;
}

function goToMenu() {
  state = 'menu';
  menuSelection = 0;
  // A real return to the menu routes music back to `title` at the next boundary.
  music.setMode('menu');
  hud.showMenu(menuSelection);
}

function goToCode() {
  state = 'code';
  codeDigits = '';
  hud.showCode(codeDisplay(codeDigits), '');
}

function leaveSplash() {
  unlockAudio();
  // Deep link: a valid ?seed= jumps straight into its landscape.
  if (seedLink.present) { level = seedLink.level; newGame(); return; }
  goToMenu();
}

function activateMenu(i) {
  if (i === 0) { level = 0; newGame(); }        // START GAME — classic level 0000
  else if (i === 1) { goToCode(); }             // ENTER CODE
  else { openSettings('menu'); }                // SETTINGS
}

// Open the volume-settings overlay. `from` ('menu' | 'playing') is where the
// second Esc must return. Opening from gameplay does NOT reset or advance the
// simulation — the frame loop simply stops ticking while state === 'settings',
// leaving the last frame on screen. Music keeps flowing (mode untouched).
function openSettings(from) {
  settingsReturn = from;
  settingsSelection = 0;
  state = 'settings';
  hud.showSettings(settings.all(), settingsSelection);
}

// Close settings and land back exactly where it was opened: the paused game
// resumes untouched, or the menu reappears with its selection intact.
function closeSettings() {
  if (settingsReturn === 'playing') {
    state = 'playing';
    hud.showScreen(null);   // drop the overlay; the live HUD is underneath
    last = performance.now(); // avoid a dt spike from the paused interval
  } else {
    state = 'menu';
    hud.showMenu(menuSelection);
  }
}

function confirmCode() {
  const code = parseSeed(codeDigits);
  const lvl = code === null ? null : seedToLevel(code);
  if (codeDigits.length !== 8 || lvl === null) {
    hud.showCode(codeDisplay(codeDigits), 'INVALID CODE');
    return;
  }
  level = lvl;
  newGame();
}

function onMenuKeyDown(e) {
  const code = e.code;
  const isEnter = code === 'Enter' || code === 'NumpadEnter';

  if (state === 'splash') {
    unlockAudio();
    if (isEnter) { e.preventDefault(); leaveSplash(); }
    return;
  }

  if (state === 'menu') {
    if (code === 'ArrowUp' || code === 'KeyW') {
      e.preventDefault();
      menuSelection = (menuSelection + MENU_COUNT - 1) % MENU_COUNT;
      hud.showMenu(menuSelection);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      e.preventDefault();
      menuSelection = (menuSelection + 1) % MENU_COUNT;
      hud.showMenu(menuSelection);
    } else if (isEnter) {
      e.preventDefault();
      activateMenu(menuSelection);
    }
    return;
  }

  if (state === 'code') {
    if (code === 'Escape') { e.preventDefault(); goToMenu(); }
    else if (isEnter) { e.preventDefault(); confirmCode(); }
    else if (code === 'Backspace') {
      e.preventDefault();
      if (codeDigits.length) {
        codeDigits = codeDigits.slice(0, -1);
        hud.showCode(codeDisplay(codeDigits), '');
      }
    } else if (/^(Digit|Numpad)\d$/.test(code)) {
      e.preventDefault();
      if (codeDigits.length < 8) {
        codeDigits += code.slice(-1);
        hud.showCode(codeDisplay(codeDigits), '');
      }
    }
    return;
  }

  if (state === 'settings') {
    const item = settings.items[settingsSelection];
    if (code === 'ArrowUp' || code === 'KeyW') {
      e.preventDefault();
      settingsSelection = (settingsSelection + settings.items.length - 1) % settings.items.length;
      hud.setSettingSelection(settingsSelection);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      e.preventDefault();
      settingsSelection = (settingsSelection + 1) % settings.items.length;
      hud.setSettingSelection(settingsSelection);
    } else if (code === 'ArrowLeft' || code === 'KeyA') {
      e.preventDefault();
      const v = settings.nudge(item.key, -settings.step);
      hud.setSettingValue(settingsSelection, v);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      e.preventDefault();
      const v = settings.nudge(item.key, settings.step);
      hud.setSettingValue(settingsSelection, v);
    } else if (code === 'Escape') {
      e.preventDefault();
      closeSettings();
    }
    return;
  }

  // In gameplay, Escape opens the settings overlay and pauses the simulation.
  if (state === 'playing') {
    if (code === 'Escape') { e.preventDefault(); openSettings('playing'); }
    return;
  }

  // Bonus: Escape from an end screen returns to the menu (Enter still restarts).
  if (state === 'won' || state === 'dead' || state === 'complete') {
    if (code === 'Escape') { e.preventDefault(); goToMenu(); }
  }
}

window.addEventListener('keydown', onMenuKeyDown);

// Paste support on the ENTER CODE screen: strip everything but digits from the
// clipboard text and use it to replace the whole buffer (truncated to 8), so
// pasting a full "XXXX-XXXX" code (with or without the dash, or embedded in
// other text like "code: 1234 5678 thanks") always lands cleanly regardless of
// what was typed/pasted before.
function applyPastedDigits(text) {
  if (state !== 'code' || !text) return;
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (!digits) return;
  codeDigits = digits;
  hud.showCode(codeDisplay(codeDigits), '');
}

window.addEventListener('paste', (e) => {
  if (state !== 'code') return;
  e.preventDefault();
  const text = e.clipboardData ? e.clipboardData.getData('text') : '';
  applyPastedDigits(text);
});

// Fallback for environments where the 'paste' event doesn't fire (some
// embedders swallow it): try the async Clipboard API on Ctrl/Cmd+V. This is
// best-effort — permission may be denied, in which case we silently do
// nothing and rely on the 'paste' event above.
window.addEventListener('keydown', (e) => {
  if (state !== 'code') return;
  const isPasteChord = (e.ctrlKey || e.metaKey) && e.code === 'KeyV';
  if (!isPasteChord) return;
  if (!navigator.clipboard || !navigator.clipboard.readText) return;
  navigator.clipboard.readText().then((text) => {
    applyPastedDigits(text);
  }).catch(() => {});
});

// Optional mouse support on the splash and menu screens.
overlayEl.addEventListener('click', (e) => {
  unlockAudio();
  if (state === 'splash') { leaveSplash(); return; }
  if (state === 'menu') {
    const opt = e.target.closest('.hud-menu-option');
    if (opt) { menuSelection = Number(opt.dataset.index); activateMenu(menuSelection); }
  }
});
overlayEl.addEventListener('mousemove', (e) => {
  if (state !== 'menu') return;
  const opt = e.target.closest('.hud-menu-option');
  if (opt) {
    const i = Number(opt.dataset.index);
    if (i !== menuSelection) { menuSelection = i; hud.showMenu(menuSelection); }
  }
});

// ---- Settings slider mouse control (click + drag) ----------------------
let settingsDrag = null;      // { index, key, track } while dragging a slider

function pctFromTrack(track, clientX) {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
}

overlayEl.addEventListener('mousedown', (e) => {
  if (state !== 'settings') return;
  const row = e.target.closest('.hud-setting-row');
  if (row) {
    settingsSelection = Number(row.dataset.index);
    hud.setSettingSelection(settingsSelection);
  }
  const track = e.target.closest('.hud-setting-track');
  if (track) {
    e.preventDefault();
    const index = Number(track.dataset.index);
    const key = track.dataset.key;
    settingsDrag = { index, key, track };
    const v = settings.setValue(key, pctFromTrack(track, e.clientX));
    hud.setSettingValue(index, v);
  }
});

window.addEventListener('mousemove', (e) => {
  if (!settingsDrag) return;
  const v = settings.setValue(settingsDrag.key, pctFromTrack(settingsDrag.track, e.clientX));
  hud.setSettingValue(settingsDrag.index, v);
});

window.addEventListener('mouseup', () => { settingsDrag = null; });

// ---- Loop -------------------------------------------------------------

let last = performance.now();
let logicAcc = 0;
let lastScanState = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // The key-legend footer belongs to gameplay only; menu/code/settings screens
  // hide it (CSS reacts to this body class). Idempotent — no reflow when steady.
  const inGame = state === 'playing' || state === 'won' || state === 'dead' || state === 'complete';
  document.body.classList.toggle('show-footer', inGame);

  // View rotation every frame for smoothness.
  if (state === 'playing') {
    const speed = input.held.fast ? YAW_SPEED_FAST : YAW_SPEED;
    if (input.held.yawLeft || input.held.yawRight) {
      // Direct, un-eased response to held keys (no input lag). Any manual turn
      // cancels an in-progress jump-turn tween so the two never fight.
      if (input.held.yawLeft) camera.yaw -= speed * dt;
      if (input.held.yawRight) camera.yaw += speed * dt;
      camera.targetYaw = camera.yaw;
      yawTweening = false;
    }
    if (input.held.pitchUp) camera.pitch = Math.min(PITCH_LIMIT, camera.pitch + speed * dt);
    if (input.held.pitchDown) camera.pitch = Math.max(-PITCH_LIMIT, camera.pitch - speed * dt);

    // Ease discrete jump-turns (u-turn / transfer) toward targetYaw. Applied
    // BEFORE the pick below, so picking uses the actual (tweened) camera.
    if (yawTweening) {
      const d = angleDiff(camera.yaw, camera.targetYaw);
      if (Math.abs(d) < 0.001) {
        camera.yaw = camera.targetYaw;
        yawTweening = false;
      } else {
        camera.yaw += d * (1 - Math.exp(-dt * YAW_TWEEN_RATE));
      }
    }
  }

  // Current pick (crosshair target) — recomputed every frame so the renderer
  // can highlight the targeted square and actions reuse the same result.
  let pick = null;
  if (state === 'playing') {
    const ray = screenRay(camera, input.cursor.x, input.cursor.y);
    pick = world.pickTarget(ray.origin, ray.dir);
  }

  // Discrete actions. Splash/menu/code run their own keydown listener, so
  // here we just drain and ignore input.js's queue in those states.
  const actions = input.pollActions();
  if (state === 'splash' || state === 'menu' || state === 'code' || state === 'settings') {
    // dropped on purpose — these states run their own keydown listener, and
    // 'settings' must never let a stray Enter reach newGame() (that would reset
    // the paused game the player is about to return to).
  } else
  for (const action of actions) {
    if (action === 'start') {
      if (state !== 'playing') {
        if (state === 'won' && nextLevel !== null) level = nextLevel;
        else if (state === 'complete') level = 0;   // fresh run after finishing
        // 'dead' and 'title' replay/start the current level unchanged
        newGame();
      }
      continue;
    }
    if (action === 'mute') {
      // Allowed from playing/won/dead/complete — session-only, doesn't touch
      // Settings/localStorage (see audio.js setMuted/toggleMuted).
      const muted = audio.toggleMuted();
      hud.showMessage(muted ? 'Sound off' : 'Sound on', 1500);
      continue;
    }
    if (state !== 'playing') continue;
    if (action === 'uturn') {
      // Jump-turn 180°, eased. Blocked while a tween is already in flight.
      if (!yawTweening) {
        camera.targetYaw = camera.yaw + Math.PI;
        yawTweening = true;
      }
      continue;
    }
    game.doAction(action, pick);
    if (game.pendingFacing !== null) {
      // Face the shell you transferred from — eased jump-turn to it.
      camera.targetYaw = game.pendingFacing;
      yawTweening = true;
      game.pendingFacing = null;
    }
    syncCamera();
  }

  // Fixed-timestep logic.
  if (state === 'playing') {
    logicAcc += dt;
    const step = 1 / LOGIC_HZ;
    while (logicAcc >= step) {
      logicAcc -= step;
      game.tick(step);
    }
    syncCamera();

    hud.setEnergy(game.energy);
    hud.setScanState(game.scanState ?? 0);
    hud.setWatchers(
      world.objects.some((o) => o.type === 'sentinel'),
      world.objects.filter((o) => o.type === 'sentry').length,
    );
    for (const msg of game.messages.splice(0)) {
      hud.showMessage(msg, 2500);
    }
    for (const ev of game.events.splice(0)) {
      audio.play(ev);
      // Visual feedback for teleport / drain events.
      if (ev === 'hyperspace') hud.flash('hyperspace');
      else if (ev === 'transfer') hud.flash('transfer');
      else if (ev === 'drain') shake = Math.max(shake, 0.6);
    }
    // Scan-state rising edges get their own warning sounds.
    if (game.scanState !== lastScanState) {
      if (game.scanState === 1) audio.play('seen');
      else if (game.scanState === 2) audio.play('draining');
      lastScanState = game.scanState;
    }
    if (game.status === 'won') {
      // A level was completed: the current theme advances to the next one at
      // its end (theme5 -> theme1). Fires once — the win block is gated by
      // state==='playing', which no longer holds after we switch below.
      music.onLevelWon();
      // Original progression: next level = current + remaining energy.
      // Past level 9999 there is nowhere further to go — the game is done.
      const code = levelToSeed(level);
      const target = level + game.energy;
      if (target > 9999) {
        state = 'complete';
        hud.showScreen('complete', [
          `LANDSCAPE ${formatLevel(level)} — REPLAY CODE ${formatSeed(code)}`,
          `FINAL ENERGY ${game.energy}`,
        ]);
      } else {
        state = 'won';
        nextLevel = target;
        hud.showScreen('won', [
          `REPLAY CODE ${formatSeed(code)}`,
          `NEXT LANDSCAPE ${formatLevel(target)}`,
        ]);
      }
    } else if (game.status === 'dead') {
      state = 'dead';
      hud.showScreen('dead', [`REPLAY CODE ${formatSeed(levelToSeed(level))}`]);
    }
  }

  // Drain shake: a render-ONLY yaw/pitch jitter with exponential decay. It must
  // never leak into camera (pick/logic already used the true camera above), so
  // it is applied to a throwaway copy passed to render.
  let renderCam = camera;
  if (shake > 0.001) {
    shake *= Math.exp(-dt * SHAKE_DECAY);
    renderCam = {
      ...camera,
      yaw: camera.yaw + (Math.random() - 0.5) * 0.01 * shake,
      pitch: camera.pitch + (Math.random() - 0.5) * 0.01 * shake,
    };
  } else {
    shake = 0;
  }

  // Render.
  if (world) {
    render(ctx, world, renderCam, {
      crosshair: state === 'playing',
      cursor: input.cursor,
      pickTile: pick ? pick.tile : null,
      pick,
      time: now / 1000,
      skipObjectId: game ? game.playerShellId : null,
    });
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(frame);
}

hud.showSplash();
requestAnimationFrame(frame);

// Debug hook for automated verification (harmless in production).
window.__dbg = {
  camera,
  get world() { return world; },
  get game() { return game; },
  get state() { return state; },
  get settings() { return settings.all(); },
};
// Music debug hook: current track, planned successor, mode, format, ctx state.
window.__music = music;
