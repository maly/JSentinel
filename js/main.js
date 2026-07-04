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
import { levelToSeed, seedToLevel, formatLevel, formatSeed } from './levels.js';

const LOGIC_HZ = 10;
const YAW_SPEED = 1.2;        // rad/s
const YAW_SPEED_FAST = 3.0;
const PITCH_LIMIT = Math.PI / 3;
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

// ?seed=NNNNNNNN — an 8-digit landscape code. Valid codes map back to a
// level (0000-9999); anything else starts at level 0000.
function levelFromUrl() {
  const raw = new URLSearchParams(location.search).get('seed');
  if (!raw || !/^\d{1,8}$/.test(raw)) return 0;
  const mapped = seedToLevel(Number.parseInt(raw, 10));
  return mapped ?? 0;
}

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const hud = createHud(document.getElementById('overlay'));
const audio = createAudio();
// Browsers only allow audio after a user gesture.
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('mousedown', () => audio.unlock(), { once: true });

let state = 'title';          // 'title' | 'playing' | 'won' | 'complete' | 'dead'
let world = null;
let game = null;
let camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
let level = levelFromUrl();   // 0000-9999
let nextLevel = null;         // set when a level is won

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
  camera.pitch = 0;
  syncCamera();
  state = 'playing';
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

// ---- Loop -------------------------------------------------------------

let last = performance.now();
let logicAcc = 0;
let lastScanState = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // View rotation every frame for smoothness.
  if (state === 'playing') {
    const speed = input.held.fast ? YAW_SPEED_FAST : YAW_SPEED;
    if (input.held.yawLeft) camera.yaw -= speed * dt;
    if (input.held.yawRight) camera.yaw += speed * dt;
    if (input.held.pitchUp) camera.pitch = Math.min(PITCH_LIMIT, camera.pitch + speed * dt);
    if (input.held.pitchDown) camera.pitch = Math.max(-PITCH_LIMIT, camera.pitch - speed * dt);
  }

  // Current pick (crosshair target) — recomputed every frame so the renderer
  // can highlight the targeted square and actions reuse the same result.
  let pick = null;
  if (state === 'playing') {
    const ray = screenRay(camera, input.cursor.x, input.cursor.y);
    pick = world.pickTarget(ray.origin, ray.dir);
  }

  // Discrete actions.
  for (const action of input.pollActions()) {
    if (action === 'start') {
      if (state !== 'playing') {
        if (state === 'won' && nextLevel !== null) level = nextLevel;
        else if (state === 'complete') level = 0;   // fresh run after finishing
        // 'dead' and 'title' replay/start the current level unchanged
        newGame();
      }
      continue;
    }
    if (state !== 'playing') continue;
    if (action === 'uturn') {
      camera.yaw += Math.PI;
      continue;
    }
    game.doAction(action, pick);
    if (game.pendingFacing !== null) {
      camera.yaw = game.pendingFacing;   // face the shell you transferred from
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
    }
    // Scan-state rising edges get their own warning sounds.
    if (game.scanState !== lastScanState) {
      if (game.scanState === 1) audio.play('seen');
      else if (game.scanState === 2) audio.play('draining');
      lastScanState = game.scanState;
    }
    if (game.status === 'won') {
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

  // Render.
  if (world) {
    render(ctx, world, camera, {
      crosshair: state === 'playing',
      cursor: input.cursor,
      pickTile: pick ? pick.tile : null,
      skipObjectId: game ? game.playerShellId : null,
    });
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(frame);
}

hud.showScreen('title');
requestAnimationFrame(frame);

// Debug hook for automated verification (harmless in production).
window.__dbg = {
  camera,
  get world() { return world; },
  get game() { return game; },
};
