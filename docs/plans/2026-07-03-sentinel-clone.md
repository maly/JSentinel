# The Sentinel (HTML5/JS klon) — Implementation Plan

> **For agentic workers:** Follow this plan exactly. File ownership is strict — do not touch files owned by another task. All interfaces are defined in "Contracts" below; implement against them, do not change them.

**Goal:** Playable single-level clone of The Sentinel (Geoff Crammond, 1986) in vanilla HTML5 + JS, canvas 512×384, fully keyboard-controlled, faithful flat-shaded vector look and full original mechanics.

**Architecture:** Grid-based world model (32×32 tiles, discrete heights, stacked objects) completely separated from a software-style flat-shaded polygon renderer (perspective projection + painter's algorithm on canvas 2D). Game logic runs on the grid; renderer only reads world state. No build step, no dependencies — ES modules loaded from `index.html`, run via any static server.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D API, no libraries. Verification via Playwright MCP (screenshots + console).

---

## Contracts (shared interfaces — FROZEN)

### World model (`js/world.js`)
```js
// Tile: { h: [h00,h10,h11,h01] corner heights (ints), flat: bool, height: int (if flat) }
// World.tiles[z][x], 32×32. Checkerboard color derives from (x+z)%2.
// Object: { type: 'tree'|'boulder'|'robot'|'sentinel'|'meanie'|'pedestal',
//           x, z,            // tile coords
//           stackIndex,      // 0 = on ground; boulders stack, robot/tree top only
//           rotY,            // facing (sentinel/robot/meanie), radians
//           id }
// World API:
//   objectsAt(x, z) -> Object[] (bottom-up)
//   topAt(x, z) -> Object | null
//   surfaceY(x, z) -> world-space Y of top of stack (or terrain) on tile
//   addObject(type, x, z), removeObject(id)
//   ENERGY = { tree: 1, boulder: 2, robot: 3, meanie: 1, sentinel: 4 }
```

### Line of sight (`js/world.js`)
```js
// canSee(eyePos {x,y,z}, target {x,y,z}) -> bool
// Sample terrain+object silhouettes along the ray; terrain sampled bilinearly per tile.
// "Sees a square" = canSee(eye, center of the square's top surface).
// "Sees object's base" = canSee(eye, point 0.1 above the base of that object's stack slot).
```

### Renderer (`js/renderer.js`)
```js
// render(ctx, world, camera, uiState)
// camera: { x, y, z, yaw, pitch }  (player eye = robot head, y = surfaceY + robot eye height)
// Flat-shaded quads/tris, painter's algorithm (sort by depth), 1px dark outlines optional.
// Palette (Sentinel-like): sky #6688EE→ gradient bands, tiles alternating #55BB55/#3D8B3D
// (slopes shaded darker by normal), trees green/dark, boulders grey, robots yellow-ochre,
// sentinel white/pale, meanie red-ish. Low-fi look: no anti-alias smoothing tricks needed.
```

### Game rules (`js/game.js`) — original mechanics, level "0000"-style
- Player is a robot shell; first-person view; **no walking** — only transfer between shells.
- **Crosshair** center screen; actions target the tile/object under crosshair (ray pick).
- **Absorb (A):** only if player sees the target square (base of object). Gain object's energy. Absorbing under-stack objects not allowed — top of stack only, except: absorbing a boulder absorbs everything on it? NO — original rule: you may only absorb the *top* object of a stack, and only if you can see the square it rests on.
- **Create tree (T) / boulder (B) / robot (R):** costs ENERGY[type]; target must be a *flat* tile (or top of boulder stack) you can see; boulders stack; tree/robot only on ground or boulder top; nothing on trees/robots.
- **Transfer (Q):** point at a robot shell you can see → consciousness moves there (old shell stays behind with its energy — you should absorb it after, classic Sentinel economy).
- **U-turn (U):** instant 180° yaw.
- **Hyperspace (H):** costs 3 energy; creates a new robot at a random flat square *not higher than current altitude*, transfers you there, old shell remains. If energy < 3 → death.
- **The Sentinel:** stands on `pedestal` on the highest plateau. Rotates in 30° steps every ~10 s, pauses. If it *sees the square the player's robot stands on* → drains 1 energy every ~7 s from player; each drained unit spawns a tree on a random flat tile (energy conservation). If it sees only the player's *head* but not the base square → turns a nearby tree into a **meanie**; meanie spins fast, and when it faces the player, forces hyperspace (costing 3 energy), then meanie reverts to tree.
- Sentinel also drains energy of visible unattended robots/boulders (1 unit/tick, leaves trees).
- **Win:** absorb the Sentinel (possible only when you can see its base = you are high enough via boulder stacking), then stand on the pedestal (transfer there) and press H → level complete screen.
- **Lose:** energy < 0 or drained to death / hyperspace without energy.
- **HUD:** energy shown Sentinel-style as icon row (robot=3, boulder=2, tree=1) top-left; low-energy warning; scanned-by-sentinel visual alarm (screen border flash + sound-less pulse).
- Also: initial "level view" overhead-ish intro showing landscape before entering robot (simplified: brief fly-over or static high view + key to start).

### Keyboard (final; `js/input.js`)
```
Arrows ........... rotate view (yaw/pitch)  [pitch clamp ±60°]  (no WASD — 'A' is Absorb)
A ................ absorb      T ... tree     B ... boulder   R ... robot
Q ................ transfer    H ... hyperspace   U ... U-turn
Enter ............ start / restart
Shift ............ fast rotate
```

### Terrain generation (`js/terrain.js`)
- 32×32, integer corner heights 0..~11. Mix of flat plateaus and connecting slopes
  (Sentinel style: mostly flat tiles at various levels, slope tiles between).
- Deterministic from seed. Guarantee: single highest plateau ≥2 flat tiles for
  Sentinel pedestal; ≥25 flat tiles at low levels; player start on a low flat tile
  far from Sentinel; ~12 trees scattered; ~3 idle boulders worth of energy on map.

---

## File structure & ownership

| File | Owner | Responsibility |
|---|---|---|
| `index.html`, `css` inline | fast-worker | Shell, canvas 512×384, HUD DOM overlay, screens (title/win/lose) |
| `js/input.js` | fast-worker | Keyboard state + action events |
| `js/hud.js` | fast-worker | Energy icons, messages, scan alarm overlay |
| `js/math3d.js` | deep-reasoner | Vec/mat, projection, ray-pick |
| `js/terrain.js` | deep-reasoner | Seeded landscape generation |
| `js/renderer.js` | deep-reasoner | Flat-shaded polygon renderer, object meshes |
| `js/world.js` | codex | World state, stacking, LOS (`canSee`), ray pick target resolution |
| `js/game.js` | codex | Rules, sentinel AI, meanie, energy economy, win/lose |
| `js/main.js` | lead (integration) | Game loop, module wiring, state machine |

## Tasks

### Task 1 (deep-reasoner): engine — math3d, terrain, renderer
Implement per contracts. Renderer must draw a test world (terrain + one of each object type) standalone via a `renderer-test.html` harness page. Meshes: tree = cone+trunk (~10 polys), boulder = tapered box, robot = boxy humanoid (~12 polys), sentinel = distinctive hooded figure on pedestal (~16 polys), meanie = robot variant with "wings". Painter's sort per-poly by centroid depth. 60 fps not required; 30 fps fine at 512×384.

### Task 2 (codex, parallel): world + game rules
Implement `world.js` + `game.js` per contracts against stub renderer. Include a tiny node-run test file `test/rules.test.mjs` (plain asserts, `node test/rules.test.mjs`) covering: energy economy of absorb/create, stacking legality, LOS blocking by terrain and objects, sentinel drain tick, meanie trigger condition, win condition.

### Task 3 (fast-worker, parallel): shell + input + HUD
`index.html`, `input.js`, `hud.js` per contracts. Title screen text in original spirit ("THE SENTINEL — press ENTER"), win ("LANDSCAPE ABSORBED"), lose ("ABSORBED BY THE SENTINEL").

### Task 4 (lead): integration + main loop
Wire modules in `main.js`: state machine (title → intro view → playing → win/lose), fixed-timestep logic tick (10 Hz) + render tick, camera from player shell. Resolve any contract mismatches.

### Task 5: verification (Playwright)
Serve statically, open page, screenshot title + gameplay; check console clean; run `node test/rules.test.mjs`; drive keys (rotate, plant tree, absorb) via Playwright and screenshot-verify. Then Codex peer review of the whole codebase for rule fidelity.

### Task 6: polish pass
Sky gradient bands, tile edge outlines, scan alarm pulse, energy icon row, sentinel head-turn animation. Screenshot compare against reference memory of original look.
