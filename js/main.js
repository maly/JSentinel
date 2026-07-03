// The Sentinel — integration layer: level setup, state machine, game loop.
// Wires terrain/world/game (logic) to renderer/input/hud (presentation).

import { generateTerrain } from './terrain.js';
import { World } from './world.js';
import { Game } from './game.js';
import { render } from './renderer.js';
import { screenRay } from './math3d.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';

const LOGIC_HZ = 10;
const YAW_SPEED = 1.2;        // rad/s
const YAW_SPEED_FAST = 3.0;
const PITCH_LIMIT = Math.PI / 3;
const TREE_DENSITY = 0.25;    // trees on ~25% of free flat tiles
const BOULDER_COUNT = 2;
const START_ENERGY = 10;

// Deterministic level generation: the numeric seed drives BOTH the terrain
// and the object scatter, so the same seed always yields the same landscape.
// Pin a landscape with ?seed=N in the URL; otherwise each start rolls a new one.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const urlSeed = Number.parseInt(new URLSearchParams(location.search).get('seed'), 10);
const seedPinned = Number.isInteger(urlSeed);

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const hud = createHud(document.getElementById('overlay'));

let state = 'title';          // 'title' | 'playing' | 'won' | 'dead'
let world = null;
let game = null;
let camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
let seed = seedPinned ? urlSeed : (Math.floor(Math.random() * 10000));

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

function setupLevel(w, rng) {
  const flats = flatTiles(w.tiles);

  // Sentinel on the single highest plateau.
  const maxH = Math.max(...flats.map((t) => t.height));
  const summit = pickRandom(flats.filter((t) => t.height === maxH), rng);
  w.addObject({ type: 'pedestal', x: summit.x, z: summit.z });
  const sentinel = w.addObject({ type: 'sentinel', x: summit.x, z: summit.z, facing: rng() * Math.PI * 2 });

  // Player start: an empty low flat tile, far from the Sentinel and with its
  // base square hidden from the Sentinel's eye (terrain LOS, ignoring facing —
  // the Sentinel sweeps, so a merely-out-of-cone tile is not safe).
  const minH = Math.min(...flats.map((t) => t.height));
  const sentinelEye = { x: summit.x + 0.5, y: sentinel.y + 1.9, z: summit.z + 0.5 };
  const lows = flats.filter((t) => t.height <= minH + 1 && w.objectsAt(t.x, t.z).length === 0);
  const hidden = lows.filter(
    (t) => !w.canSee(sentinelEye, { x: t.x + 0.5, y: w.surfaceY(t.x, t.z) + 0.05, z: t.z + 0.5 }),
  );
  const pool = hidden.length ? hidden : lows;
  const dist2 = (t) => (t.x - summit.x) ** 2 + (t.z - summit.z) ** 2;
  pool.sort((a, b) => dist2(b) - dist2(a));
  const start = pickRandom(pool.slice(0, Math.max(1, Math.floor(pool.length / 10))), rng);

  // Scatter trees over ~25% of the free flat tiles, plus a couple of boulders.
  const free = () => flats.filter(
    (t) => w.objectsAt(t.x, t.z).length === 0 && !(t.x === start.x && t.z === start.z),
  );
  const treeCount = Math.floor(free().length * TREE_DENSITY);
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
  world = new World(generateTerrain(seed));
  const rng = mulberry32(seed * 2654435761 + 1);
  const { start, sentinel } = setupLevel(world, rng);
  game = new Game(world, { x: start.x, z: start.z, energy: START_ENERGY });
  // Face the Sentinel on spawn (math3d yaw convention: 0 = +Z, dir.x = sin yaw).
  camera.yaw = Math.atan2(sentinel.x - start.x, sentinel.z - start.z);
  camera.pitch = 0;
  syncCamera();
  state = 'playing';
  hud.showScreen(null);
  hud.setEnergy(game.energy);
  hud.showMessage(`LANDSCAPE ${String(seed).padStart(4, '0')}`, 3000);
  // Next restart rolls a fresh landscape unless the seed is pinned via ?seed=N.
  if (!seedPinned) seed = Math.floor(Math.random() * 10000);
}

function syncCamera() {
  camera.x = game.camera.x + 0.5;
  camera.z = game.camera.z + 0.5;
  camera.y = game.camera.eyeY;
}

// ---- Loop -------------------------------------------------------------

let last = performance.now();
let logicAcc = 0;

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
      if (state !== 'playing') newGame();
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
    for (const msg of game.messages.splice(0)) {
      hud.showMessage(msg, 2500);
    }
    if (game.status === 'won') { state = 'won'; hud.showScreen('won'); }
    else if (game.status === 'dead') { state = 'dead'; hud.showScreen('dead'); }
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
