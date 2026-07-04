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
// Won-cinematic camera turn: slower than the u-turn/transfer tween above so
// the reorientation reads as a deliberate cinematic pan rather than a snap.
const CINEMATIC_YAW_RATE = 5;
// How close (tiles) a target heading's aim point may be to the camera before
// it's considered too unstable to steer by (see beginWonCinematic).
const CINEMATIC_AIM_MIN_DIST = 3;
// Drain shake: exp decay ~0.5s (rate 5 => e^-2.5 after 0.5s). Render-only.
const SHAKE_DECAY = 5;
// Watcher facing tween: exponential approach of the render-only `_displayFacing`
// toward the logic `facing`. rate 6 => ~e^-2.4 (≈9% left) after 0.4s, so each
// discrete 30° logic step reads as a ~0.4s smooth turn. Presentation ONLY.
const WATCHER_FACE_RATE = 6;
function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const BOULDER_COUNT = 2;
const START_ENERGY = 10;
// A watcher's turn "krrk" fades to silence over this many tiles (linear).
const WATCHER_TURN_RANGE = 15;

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
//   'playing' -> 'confirm' -> 'playing'|'menu' (Backspace -> ABANDON LANDSCAPE? -> NO/YES)
// A valid ?seed= deep-links 'splash' -> 'playing' directly.
const seedLink = urlSeed();
let state = 'splash';         // 'splash' | 'menu' | 'code' | 'playing' | 'won' | 'complete' | 'dead' | 'settings' | 'confirm'
let world = null;
let game = null;
let camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };
// Jump-turn tween + drain-shake state (render/camera only, never logic/pick).
let yawTweening = false;
// Won-cinematic pitch tween (see beginWonCinematic / updateCinematic). Only
// ever used outside 'playing', so it never competes with held pitch input.
let pitchTweening = false;
let shake = 0;
// Screen-transition + won-cinematic state. `fading` is true while a black wipe
// is in flight (blocks stray Enter). `cinematic` holds the win dissolve wave.
let fading = false;
let cinematic = null;
let level = seedLink.level;   // 0000-9999
let nextLevel = null;         // set when a level is won

// Menu / code-entry transient state.
let menuSelection = 0;
let codeDigits = '';          // up to 8 typed digits

// Settings-screen transient state. `settingsReturn` remembers where Esc came
// from ('menu' or 'playing') so the second Esc lands back there unchanged.
let settingsSelection = 0;
let settingsReturn = 'menu';

// Backspace-in-gameplay "ABANDON LANDSCAPE?" modal. NO (0) is the default
// selection; YES (1) quits to the menu. Only ever entered from 'playing'.
let confirmSelection = 0;

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
  cinematic = null;
  hud.showScreen(null);
  hud.setEnergy(game.energy, { silent: true });   // baseline, no drain/gain tick
  hud.showIntroTitle(`LANDSCAPE ${formatLevel(level)}`);
}

function syncCamera() {
  camera.x = game.camera.x + 0.5;
  camera.z = game.camera.z + 0.5;
  camera.y = game.camera.eyeY;
}

// ---- Presentation transitions & cinematics -----------------------------

// fade-out -> run `mid` while the screen is black -> fade back in. `fading`
// blocks input for the whole sequence so a stray Enter can't double-fire.
function fadeTo(mid, opts = {}) {
  const out = opts.out ?? 300;
  const hold = opts.hold ?? 0;
  const inMs = opts.in ?? 300;
  fading = true;
  hud.fadeOut(out, () => {
    if (mid) mid();
    setTimeout(() => {
      hud.fadeIn(inMs, () => { fading = false; });
    }, hold);
  });
}

// Won cinematic: freeze the world (game has already stopped ticking once state
// leaves 'playing') and dissolve every object away in a wave spreading outward
// from the player, using the renderer's dither (task 1) on a PRESENTATION-only
// `dissolve` value. Real objects are never removed — the world is rebuilt on the
// next level. `onDone` fires when the wave finishes (to fade in the won screen).
function beginWonCinematic(onDone) {
  state = 'won';            // stops logic + gameplay input; screen shown later
  hud.showScreen(null);     // ensure no overlay screen is up during the wave
  const px = game.camera.x + 0.5;
  const pz = game.camera.z + 0.5;
  // Collapse-wave origin: the Sentinel's summit. The pedestal survives even
  // after the Sentinel itself is absorbed, so prefer it; then any watcher; then
  // fall back to the highest terrain vertex (center of the tallest tile).
  let origin = null;
  for (const o of world.objects) {
    if (o.type === 'pedestal') { origin = { x: o.x + 0.5, z: o.z + 0.5 }; break; }
  }
  if (!origin) {
    for (const o of world.objects) {
      if (o.type === 'sentinel' || o.type === 'sentry') { origin = { x: o.x + 0.5, z: o.z + 0.5 }; break; }
    }
  }
  if (!origin) {
    let best = -Infinity, bx = world.width / 2, bz = world.depth / 2;
    for (let z = 0; z < world.depth; z++) {
      for (let x = 0; x < world.width; x++) {
        const h = world.tiles[z][x].h;
        const m = Math.max(h[0], h[1], h[2], h[3]);
        if (m > best) { best = m; bx = x + 0.5; bz = z + 0.5; }
      }
    }
    origin = { x: bx, z: bz };
  }
  // Each object dissolves when the wave front reaches it (distance from origin).
  for (const o of world.objects) {
    const dx = o.x + 0.5 - origin.x;
    const dz = o.z + 0.5 - origin.z;
    o._wonDist = Math.hypot(dx, dz);
  }
  // Farthest map corner from the origin: how far the front must travel to clear
  // the whole landscape. Tuned so the front crosses the map in ~waveTravel s.
  let maxR = 1;
  for (const [cx, cz] of [[0, 0], [world.width, 0], [0, world.depth], [world.width, world.depth]]) {
    const d = Math.hypot(cx - origin.x, cz - origin.z);
    if (d > maxR) maxR = d;
  }
  const rotDelay = 0.3;
  const waveTravel = 2.1;             // s for the front to reach the far corner
  const speed = maxR / waveTravel;    // world-units per second
  const band = 8;                     // collapse-zone width (dither + sink), units
  const fall = 0.05;                  // sink accel: dropY = -fall * prog^2
  const edge = 1.6;                   // crest-highlight width at the front, units
  const tail = band / speed;          // extra time for the last tiles to finish
  // Winning typically means transferring onto a high point or absorbing the
  // Sentinel, both of which tend to sit near the map edge — the player can
  // easily be looking out over the boundary, away from the landscape, right
  // when the dissolve wave starts. Steer the camera toward the remaining
  // scenery first so the wave is actually visible. Delay the wave itself a
  // touch (rotDelay, declared above) so the turn is visibly underway first.
  let cx = 0, cz = 0, n = 0;
  for (const o of world.objects) { cx += o.x + 0.5; cz += o.z + 0.5; n += 1; }
  let aimX, aimZ;
  if (n > 0) { aimX = cx / n; aimZ = cz / n; } else { aimX = px; aimZ = pz; }
  let dx = aimX - px, dz = aimZ - pz;
  if (Math.hypot(dx, dz) < CINEMATIC_AIM_MIN_DIST) {
    // Object centroid is right on top of the camera (nothing left standing
    // nearby) — aim at the map center instead of a degenerate direction.
    dx = world.width / 2 - px;
    dz = world.depth / 2 - pz;
  }
  if (Math.hypot(dx, dz) >= 0.001) {
    // yaw=0 looks along +Z, increasing yaw turns right (see math3d.js) —
    // atan2(dx, dz) matches that convention (sin(yaw)~dx, cos(yaw)~dz).
    const targetYaw = Math.atan2(dx, dz);
    if (Math.abs(angleDiff(camera.yaw, targetYaw)) > 0.05) {
      camera.targetYaw = targetYaw;
      yawTweening = true;
    }
    // A mild downward-tilted overview reads better than whatever pitch the
    // player happened to end on (straight up/down included).
    if (Math.abs(camera.pitch - (-0.1)) > 0.02) {
      camera.targetPitch = -0.1;
      pitchTweening = true;
    }
  }
  for (const o of world.objects) {
    if (o.dissolve === undefined) o.dissolve = 1; // start solid, fade presentationally
  }
  // Fire the won-screen fade once the front has cleared most of the landscape
  // (the fade itself overlaps the final tiles finishing their collapse).
  const dur = rotDelay + waveTravel + tail * 0.6;
  cinematic = {
    t: 0, dur, onDone,
    origin, speed, band, fall, edge, rotDelay,
    wave: { x: origin.x, z: origin.z, radius: 0, band, fall, edge },
  };
}

// Advance the won-cinematic dissolve wave. Called every frame while active.
function updateCinematic(dt) {
  // Ease the camera toward the landscape heading beginWonCinematic picked.
  // frame()'s own jump-turn tween block only runs while state === 'playing',
  // and beginWonCinematic already flips state to 'won' before this can run,
  // so there is no double-application — this is the sole driver once won.
  if (state !== 'playing') {
    if (yawTweening) {
      const d = angleDiff(camera.yaw, camera.targetYaw);
      if (Math.abs(d) < 0.001) { camera.yaw = camera.targetYaw; yawTweening = false; }
      else camera.yaw += d * (1 - Math.exp(-dt * CINEMATIC_YAW_RATE));
    }
    if (pitchTweening) {
      const dp = camera.targetPitch - camera.pitch;
      if (Math.abs(dp) < 0.001) { camera.pitch = camera.targetPitch; pitchTweening = false; }
      else camera.pitch += dp * (1 - Math.exp(-dt * CINEMATIC_YAW_RATE));
    }
  }
  if (!cinematic || !world) return;
  cinematic.t += dt;
  // Radial collapse front: radius grows linearly from the summit after rotDelay.
  const radius = cinematic.speed * Math.max(0, cinematic.t - cinematic.rotDelay);
  cinematic.wave.radius = radius;
  // Objects dissolve in lockstep with the terrain wave: the same front reaches
  // each object at radius === its distance from the origin, then it dithers away
  // over `band`. Its contact shadow fades with the same `dissolve` value.
  for (const o of world.objects) {
    if (o._wonDist === undefined) continue;
    const prog = radius - o._wonDist;         // >0 => front has passed it
    let dv = prog <= 0 ? 1 : 1 - prog / cinematic.band;
    dv = dv > 1 ? 1 : (dv < 0 ? 0 : dv);      // 0 => renderer skips it (fully gone)
    o.dissolve = dv;
  }
  if (cinematic.t >= cinematic.dur) {
    const done = cinematic.onDone;
    cinematic = null;
    if (done) done();
  }
}

// Smoothly tween each watcher's render-only `_displayFacing` toward its logic
// `facing`. Runs at frame rate for smoothness; never touches `facing` itself, so
// LOS/canSee logic (which reads only `facing`) is unaffected. New watchers snap
// to their spawn facing (no start-of-level spin).
function updateWatcherFacing(dt) {
  if (!world) return;
  const k = 1 - Math.exp(-dt * WATCHER_FACE_RATE);
  for (const o of world.objects) {
    if (o.type !== 'sentinel' && o.type !== 'sentry') continue;
    if (o._displayFacing === undefined) { o._displayFacing = o.facing ?? 0; continue; }
    o._displayFacing += angleDiff(o._displayFacing, o.facing ?? 0) * k;
  }
}

// Age and cull visual energy motes (presentation-only; see game._emitMotes).
function updateMotes(dt) {
  const motes = world && world.motes;
  if (!motes || !motes.length) return;
  for (let i = motes.length - 1; i >= 0; i -= 1) {
    motes[i].age += dt;
    if (motes[i].age >= motes[i].life) motes.splice(i, 1);
  }
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
  audio.play('menuSelect');                      // confirm — keyboard Enter or mouse click
  if (i === 0) { fadeTo(() => { level = 0; newGame(); }); } // START GAME — classic 0000
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

// Open the "ABANDON LANDSCAPE?" modal from gameplay on Backspace. Same pause
// mechanics as openSettings: the frame loop stops ticking while
// state === 'confirm', leaving the last frame on screen; music keeps flowing.
function openConfirm() {
  confirmSelection = 0;   // NO is always the safe default on open
  state = 'confirm';
  audio.play('menuMove');
  hud.showConfirm(confirmSelection);
}

// yes=false (NO) resumes the paused game untouched, like closeSettings().
// yes=true (YES) quits to the menu via the standard fade.
function resolveConfirm(yes) {
  if (yes) {
    fadeTo(() => goToMenu());
  } else {
    state = 'playing';
    hud.showScreen(null);    // drop the overlay; the live HUD is underneath
    last = performance.now(); // avoid a dt spike from the paused interval
  }
}

function confirmCode() {
  const code = parseSeed(codeDigits);
  const lvl = code === null ? null : seedToLevel(code);
  if (codeDigits.length !== 8 || lvl === null) {
    audio.play('uiError');
    hud.showCode(codeDisplay(codeDigits), 'INVALID CODE');
    return;
  }
  level = lvl;
  fadeTo(() => newGame());
}

function onMenuKeyDown(e) {
  const code = e.code;
  const isEnter = code === 'Enter' || code === 'NumpadEnter';

  // Swallow input while a transition wipe or the won cinematic is in flight.
  if (fading || cinematic) { e.preventDefault(); return; }

  if (state === 'splash') {
    unlockAudio();
    if (isEnter) { e.preventDefault(); leaveSplash(); }
    return;
  }

  if (state === 'menu') {
    if (code === 'ArrowUp' || code === 'KeyW') {
      e.preventDefault();
      menuSelection = (menuSelection + MENU_COUNT - 1) % MENU_COUNT;
      audio.play('menuMove');
      hud.showMenu(menuSelection);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      e.preventDefault();
      menuSelection = (menuSelection + 1) % MENU_COUNT;
      audio.play('menuMove');
      hud.showMenu(menuSelection);
    } else if (isEnter) {
      e.preventDefault();
      activateMenu(menuSelection);
    }
    return;
  }

  if (state === 'code') {
    if (code === 'Escape') { e.preventDefault(); audio.play('menuMove'); goToMenu(); }
    else if (isEnter) { e.preventDefault(); confirmCode(); }
    else if (code === 'Backspace') {
      e.preventDefault();
      if (codeDigits.length) {
        codeDigits = codeDigits.slice(0, -1);
        audio.play('keyBlip');
        hud.showCode(codeDisplay(codeDigits), '');
      }
    } else if (/^(Digit|Numpad)\d$/.test(code)) {
      e.preventDefault();
      if (codeDigits.length < 8) {
        codeDigits += code.slice(-1);
        audio.play('keyBlip');
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
      audio.play('menuMove');
      hud.setSettingSelection(settingsSelection);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      e.preventDefault();
      settingsSelection = (settingsSelection + 1) % settings.items.length;
      audio.play('menuMove');
      hud.setSettingSelection(settingsSelection);
    } else if (code === 'ArrowLeft' || code === 'KeyA') {
      e.preventDefault();
      const v = settings.nudge(item.key, -settings.step);
      audio.play('keyBlip');   // value adjust — same feedback as a slider drag
      hud.setSettingValue(settingsSelection, v);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      e.preventDefault();
      const v = settings.nudge(item.key, settings.step);
      audio.play('keyBlip');
      hud.setSettingValue(settingsSelection, v);
    } else if (code === 'Escape') {
      e.preventDefault();
      audio.play('menuMove');
      closeSettings();
    }
    return;
  }

  if (state === 'confirm') {
    if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') {
      e.preventDefault();
      if (confirmSelection !== 0) {
        confirmSelection = 0;
        audio.play('menuMove');
        hud.setConfirmSelection(confirmSelection);
      }
    } else if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') {
      e.preventDefault();
      if (confirmSelection !== 1) {
        confirmSelection = 1;
        audio.play('menuMove');
        hud.setConfirmSelection(confirmSelection);
      }
    } else if (isEnter) {
      e.preventDefault();
      audio.play('menuSelect');
      resolveConfirm(confirmSelection === 1);
    } else if (code === 'Escape' || code === 'Backspace') {
      // Both read as "NO" — same quiet back-out feedback as menu/settings Esc.
      e.preventDefault();
      audio.play('menuMove');
      resolveConfirm(false);
    }
    return;
  }

  // In gameplay, Escape opens the settings overlay and pauses the simulation;
  // Backspace opens the ABANDON LANDSCAPE? confirm modal.
  if (state === 'playing') {
    if (code === 'Escape') { e.preventDefault(); openSettings('playing'); }
    else if (code === 'Backspace') { e.preventDefault(); openConfirm(); }
    return;
  }

  // Bonus: Escape from an end screen returns to the menu (Enter still restarts).
  // Backspace does the same directly — nothing is at stake there, so no
  // confirm dialog is needed.
  if (state === 'won' || state === 'dead' || state === 'complete') {
    if (code === 'Escape' || code === 'Backspace') { e.preventDefault(); fadeTo(() => goToMenu()); }
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
  if (fading || cinematic) return;
  if (state === 'splash') { leaveSplash(); return; }
  if (state === 'menu') {
    const opt = e.target.closest('.hud-menu-option');
    if (opt) { menuSelection = Number(opt.dataset.index); activateMenu(menuSelection); }
  }
  if (state === 'confirm') {
    const opt = e.target.closest('.hud-menu-option');
    if (opt) {
      confirmSelection = Number(opt.dataset.index);
      audio.play('menuSelect');
      resolveConfirm(confirmSelection === 1);
    }
  }
});
overlayEl.addEventListener('mousemove', (e) => {
  if (state !== 'menu') return;
  const opt = e.target.closest('.hud-menu-option');
  if (opt) {
    const i = Number(opt.dataset.index);
    if (i !== menuSelection) { menuSelection = i; audio.play('menuMove'); hud.showMenu(menuSelection); }
  }
});

// ---- Settings slider mouse control (click + drag) ----------------------
let settingsDrag = null;      // { index, key, track } while dragging a slider

// Slider drag emits keyBlip, but throttled to at most one every 50 ms so a fast
// drag doesn't machine-gun the synth.
let lastDragBlip = 0;
function dragBlip() {
  const t = performance.now();
  if (t - lastDragBlip >= 50) { lastDragBlip = t; audio.play('keyBlip'); }
}

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
    dragBlip();
    hud.setSettingValue(index, v);
  }
});

window.addEventListener('mousemove', (e) => {
  if (!settingsDrag) return;
  const v = settings.setValue(settingsDrag.key, pctFromTrack(settingsDrag.track, e.clientX));
  dragBlip();
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

  // Ambient wind runs only in the game states (silent in menu/splash/settings);
  // its intensity tracks the scan pressure while actually playing. setAmbient is
  // idempotent per (active,scan), so calling it every frame is free.
  audio.setAmbient(inGame, state === 'playing' && game ? (game.scanState ?? 0) : 0);

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
  if (state === 'splash' || state === 'menu' || state === 'code' || state === 'settings' || state === 'confirm') {
    // dropped on purpose — these states run their own keydown listener, and
    // 'settings'/'confirm' must never let a stray Enter reach newGame() (that
    // would reset the paused game the player is about to return to).
  } else
  for (const action of actions) {
    if (action === 'start') {
      if (state !== 'playing' && !fading && !cinematic) {
        fadeTo(() => {
          if (state === 'won' && nextLevel !== null) level = nextLevel;
          else if (state === 'complete') level = 0;   // fresh run after finishing
          // 'dead' replays the current level unchanged
          newGame();
        });
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
      // Events are bare strings, or { type, ... } objects carrying a payload.
      const type = typeof ev === 'string' ? ev : ev.type;
      if (type === 'watcherTurn') {
        // Distance-attenuated so the player HEARS the landscape move: linear
        // falloff, audible out to WATCHER_TURN_RANGE tiles.
        const dx = ev.x - game.camera.x;
        const dz = ev.z - game.camera.z;
        const dist = Math.hypot(dx, dz);
        const gain = Math.max(0, 1 - dist / WATCHER_TURN_RANGE);
        if (gain > 0) audio.play('watcherTurn', { gain });
        continue;
      }
      audio.play(type);
      // Visual feedback for teleport / drain events.
      if (type === 'hyperspace') hud.flash('hyperspace');
      else if (type === 'transfer') hud.flash('transfer');
      else if (type === 'drain') shake = Math.max(shake, 0.6);
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
      // state==='playing', which beginWonCinematic() clears immediately below.
      music.onLevelWon();
      // Original progression: next level = current + remaining energy.
      // Past level 9999 there is nowhere further to go — the game is done.
      const code = levelToSeed(level);
      const energy = game.energy;
      const target = level + energy;
      // Cinematic dissolve wave (~1.8s), THEN fade into the appropriate screen.
      beginWonCinematic(() => {
        if (target > 9999) {
          state = 'complete';
          fadeTo(() => hud.showScreen('complete', [
            `LANDSCAPE ${formatLevel(level)} — REPLAY CODE ${formatSeed(code)}`,
            `FINAL ENERGY ${energy}`,
          ]));
        } else {
          state = 'won';
          nextLevel = target;
          fadeTo(() => hud.showScreen('won', [
            `REPLAY CODE ${formatSeed(code)}`,
            `NEXT LANDSCAPE ${formatLevel(target)}`,
          ]));
        }
      });
    } else if (game.status === 'dead') {
      // Switch state immediately (stops logic/input), but let the death sound
      // land: hold on black briefly, then reveal the dead screen.
      state = 'dead';
      fadeTo(() => hud.showScreen('dead', [`REPLAY CODE ${formatSeed(levelToSeed(level))}`]),
        { hold: 500 });
    }
  }

  // Presentation-only per-frame updates (run in every state so they keep
  // animating through the won cinematic and end screens):
  //   * watcher facing tween (render-only `_displayFacing`),
  //   * energy-mote aging/culling,
  //   * won-cinematic dissolve wave.
  updateWatcherFacing(dt);
  updateMotes(dt);
  updateCinematic(dt);

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
      cinematicWave: cinematic ? cinematic.wave : null,
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
// Audio debug hook: unlock state, ctx state, ambient bed status (see audio.debug).
window.__audio = audio;
