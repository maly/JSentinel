import assert from 'node:assert/strict';
import { World, ENERGY } from '../js/world.js';
import { Game } from '../js/game.js';
import { levelToSeed, seedToLevel } from '../js/levels.js';

function makeTiles(width = 8, depth = 8, heightFor = () => 0) {
  const tiles = [];
  for (let z = 0; z < depth; z += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const height = heightFor(x, z);
      row.push({
        h: [height, height, height, height],
        flat: true,
        height,
      });
    }
    tiles.push(row);
  }
  return tiles;
}

function tickSeconds(game, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.1) {
    game.tick(0.1);
  }
}

// Fire a real crosshair ray from an eye point toward a world-space target and
// return world.pickTarget's result — exercising the SAME geometry the game
// uses each frame (so groundTile is derived, not hand-forged).
function pickRay(world, eye, target) {
  return world.pickTarget(eye, {
    x: target.x - eye.x,
    y: target.y - eye.y,
    z: target.z - eye.z,
  });
}

function testEnergyEconomy() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  // Tree placed off the sight line to tile (2,0) — a tree between the player
  // and the target square would legitimately block LOS.
  const tree = world.addObject({ type: 'tree', x: 1, z: 2 });

  assert.equal(game.doAction('boulder', { tile: { x: 2, z: 0 } }), true);
  assert.equal(game.energy, 10 - ENERGY.boulder);

  // Pointing at the object's body must NOT absorb when the continued ray
  // would land in a DIFFERENT square (groundTile mismatch / sky).
  assert.equal(game.doAction('absorb', { tile: { x: 1, z: 2 }, object: tree, point: { x: 1.5, y: 1, z: 2.5 }, groundTile: { x: 5, z: 5 } }), false);
  assert.equal(game.doAction('absorb', { tile: { x: 1, z: 2 }, object: tree, point: { x: 1.5, y: 1, z: 2.5 }, groundTile: null }), false);
  assert.equal(world.objects.includes(tree), true);
  // ...but a near-miss is forgiven when the ray would continue into the
  // object's own square.
  assert.equal(game.doAction('absorb', { tile: { x: 1, z: 2 }, object: tree, point: { x: 1.5, y: 1, z: 2.5 }, groundTile: { x: 1, z: 2 } }), true);
  assert.equal(world.objects.includes(tree), false);
  // Absorb via the square itself (classic path).
  world.addObject({ type: 'tree', x: 1, z: 2 });
  assert.equal(game.doAction('absorb', { tile: { x: 1, z: 2 }, object: null, point: { x: 1.5, y: 0, z: 2.5 } }), true);
  assert.equal(game.energy, 10 - ENERGY.boulder + 2 * ENERGY.tree);
  assert.equal(world.objectsAt(1, 2).length, 0);

  // Unaffordable create just fails — death only comes from hyperspace/drain.
  game.energy = ENERGY.robot - 1;
  assert.equal(game.doAction('robot', { tile: { x: 3, z: 0 } }), false);
  assert.equal(game.status, 'playing');
  assert.equal(game.doAction('hyperspace'), false);
  assert.equal(game.status, 'dead');
}

function testStackingRules() {
  const world = new World(makeTiles());
  const firstBoulder = world.addObject({ type: 'boulder', x: 1, z: 1 });
  const secondBoulder = world.addObject({ type: 'boulder', x: 1, z: 1 });
  const robot = world.addObject({ type: 'robot', x: 1, z: 1 });

  assert.ok(firstBoulder);
  assert.ok(secondBoulder);
  assert.ok(robot);
  assert.equal(world.objectsAt(1, 1).length, 3);
  assert.equal(world.addObject({ type: 'boulder', x: 1, z: 1 }), null);

  const tree = world.addObject({ type: 'tree', x: 3, z: 3 });
  assert.ok(tree);
  assert.equal(world.addObject({ type: 'robot', x: 3, z: 3 }), null);
  assert.equal(world.addObject({ type: 'boulder', x: 3, z: 3 }), null);

  // Nothing may be placed on a slope (non-flat) tile.
  world.tiles[5][5] = { h: [0, 1, 1, 0], flat: false };
  assert.equal(world.addObject({ type: 'tree', x: 5, z: 5 }), null);
  assert.equal(world.addObject({ type: 'boulder', x: 5, z: 5 }), null);
}

function testLineOfSightTerrainRidge() {
  // HEIGHT_SCALE is 0.25 (32 levels): ridge level 4 -> world Y 1.0 blocks an
  // eye ray at Y 1.0.
  const world = new World(makeTiles(8, 8, (x, z) => (x === 3 && z === 1 ? 4 : 0)));
  assert.equal(
    world.canSee({ x: 1.5, y: 1, z: 1.5 }, { x: 6.5, y: 1, z: 1.5 }),
    false,
  );

  const clearWorld = new World(makeTiles());
  assert.equal(
    clearWorld.canSee({ x: 1.5, y: 1, z: 1.5 }, { x: 6.5, y: 1, z: 1.5 }),
    true,
  );
}

function testLineOfSightObjectBlocker() {
  const world = new World(makeTiles());
  world.addObject({ type: 'boulder', x: 3, z: 1 });

  assert.equal(
    world.canSee({ x: 1.5, y: 0.5, z: 1.5 }, { x: 5.5, y: 0.5, z: 1.5 }),
    false,
  );
}

function testSentinelScanDrainChain() {
  const world = new World(makeTiles());
  // The sentinel scans right after each 30° rotation step. Start it 30° short
  // of facing the targets so the first rotation (at 10 s) brings them into view.
  world.addObject({ type: 'sentinel', x: 0, z: 0, facing: Math.PI / 2 - Math.PI / 6 });
  const robot = world.addObject({ type: 'robot', x: 2, z: 0 });
  const boulder = world.addObject({ type: 'boulder', x: 4, z: 0 });
  // Player bearing 0° — outside the cone before AND after the rotation, so no
  // player drain spawns trees that could randomly block the scan's sight line.
  const game = new Game(world, { x: 0, z: 7, energy: 10 });

  // First scan: robots have priority — the robot degrades to a boulder and
  // one tree is planted somewhere (energy conservation).
  tickSeconds(game, 10.2);
  assert.equal(world.objects.includes(robot), false);
  assert.equal(world.objectsAt(2, 0).at(-1).type, 'boulder');
  assert.equal(world.objects.includes(boulder), true);
  const treesAfterFirst = world.objects.filter((o) => o.type === 'tree').length;
  assert.ok(treesAfterFirst >= 1);
}

function testBoulderDrainsToTree() {
  const world = new World(makeTiles());
  world.addObject({ type: 'sentinel', x: 0, z: 0, facing: Math.PI / 2 - Math.PI / 6 });
  const boulder = world.addObject({ type: 'boulder', x: 2, z: 0 });
  const game = new Game(world, { x: 0, z: 7, energy: 10 });

  tickSeconds(game, 10.2);
  assert.equal(world.objects.includes(boulder), false);
  assert.equal(world.objectsAt(2, 0).at(-1).type, 'tree');
  assert.ok(world.objects.filter((o) => o.type === 'tree').length >= 2);
}

function testMeanieTriggerWhenHeadVisibleBaseHidden() {
  // HEIGHT_SCALE is 0.25: ridge level 6 -> world Y 1.5, which hides the
  // player's base (ray dips to ~0.8-1.1) but not the head (ray stays ~1.7).
  const world = new World(makeTiles(8, 8, (x, z) => (x === 3 && z === 0 ? 6 : 0)));
  world.addObject({ type: 'sentinel', x: 0, z: 0, facing: Math.PI / 2 });
  const tree = world.addObject({ type: 'tree', x: 6, z: 1 });
  const game = new Game(world, { x: 6, z: 0, energy: 10 });

  // Being spotted is not instant doom: the watcher needs ~5 s of sustained
  // head-only sight before summoning a meanie.
  game.tick(0.1);
  assert.equal(tree.type, 'tree');
  assert.equal(game.scannedBySentinel, true);
  // Head visible but base hidden => scan state 1 ("seen", cannot drain).
  assert.equal(game.scanState, 1);

  tickSeconds(game, 5.1);
  assert.equal(tree.type, 'meanie');

  // The meanie spawns facing away and sweeps slowly — the player gets a real
  // reaction window before the forced hyperspace...
  const energyBefore = game.energy;
  tickSeconds(game, 1);
  assert.equal(game.status, 'playing');
  assert.equal(game.energy, energyBefore);
  // ...but once it completes the sweep and sees the player, hyperspace fires
  // (costing 3 energy) and the meanie reverts to a tree.
  tickSeconds(game, 4);
  assert.equal(game.energy, energyBefore - ENERGY.robot);
  assert.equal(tree.type, 'tree');
}

function testAbsorbTargetsSquareTopObject() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const boulder = world.addObject({ type: 'boulder', x: 2, z: 2 });
  const tree = world.addObject({ type: 'tree', x: 2, z: 2 });

  // NEW RULE: a stack cannot be absorbed by pointing at its base square — the
  // active surface is the top face, so you must aim the object standing there.
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: null, point: { x: 2.5, y: 0.5, z: 2.5 } }), false);
  assert.equal(game.energy, 10);
  assert.equal(world.objects.includes(tree), true);

  // Aiming the top object (the tree) absorbs it; the boulder underneath stays.
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: tree, point: { x: 2.5, y: 1.2, z: 2.5 }, groundTile: { x: 2, z: 2 } }), true);
  assert.equal(game.energy, 10 + ENERGY.tree);
  assert.equal(world.objects.includes(tree), false);
  assert.equal(world.objects.includes(boulder), true);
}

// Rule 1: building ONTO a stack goes through the top face; the bare base
// square of an occupied tile does not accept a new object.
function testBuildOnStackViaTopFace() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 20 });
  const base = world.addObject({ type: 'boulder', x: 2, z: 2 });

  // Focusing the top face (object hit) stacks a boulder on top.
  assert.equal(game.doAction('boulder', { tile: { x: 2, z: 2 }, object: base, point: { x: 2.5, y: 1, z: 2.5 }, face: 'top', groundTile: { x: 2, z: 2 } }), true);
  assert.equal(world.objectsAt(2, 2).length, 2);

  // Pointing at the bare base square of the occupied tile is refused.
  const count = world.objectsAt(2, 2).length;
  assert.equal(game.doAction('tree', { tile: { x: 2, z: 2 }, object: null, point: { x: 2.5, y: 0, z: 2.5 } }), false);
  assert.equal(world.objectsAt(2, 2).length, count);

  // Pointing at a BURIED object (not the top of the stack) is also refused.
  assert.equal(game.doAction('boulder', { tile: { x: 2, z: 2 }, object: base, point: { x: 2.5, y: 0.4, z: 2.5 }, groundTile: { x: 2, z: 2 } }), false);
  assert.equal(world.objectsAt(2, 2).length, count);
}

// FACE RULE: building onto a stack requires aiming at the TOP FACE of the top
// object. A real crosshair ray that hits the SIDE of the top boulder (e.g. the
// player standing beside the pile aiming up at its flank) must be refused —
// otherwise a whole tower could be stacked "for free" from one spot. Uses the
// real pickTarget geometry so `face` is derived, not hand-forged.
function testBuildRejectsSideOfTopStone() {
  const world = new World(makeTiles(14, 14));
  const game = new Game(world, { x: 0, z: 6, energy: 20 });
  // Two boulders at (6,6): base 0..1, top boulder 1..2.
  world.addObject({ type: 'boulder', x: 6, z: 6 });
  const topBoulder = world.addObject({ type: 'boulder', x: 6, z: 6 });

  // Roughly LEVEL ray at y ~1.5 hits the near WALL of the top boulder (only the
  // top boulder spans that height — the base ends at y=1.0).
  const eye = { x: 1.5, y: 1.5, z: 6.5 };
  const pick = pickRay(world, eye, { x: 6.5, y: 1.5, z: 6.5 });
  assert.equal(pick.object, topBoulder);
  assert.equal(pick.face, 'side');

  assert.equal(game.doAction('boulder', pick), false);
  assert.equal(world.objectsAt(6, 6).length, 2);   // nothing stacked
  assert.equal(game.energy, 20);                    // no energy spent
}

// FACE RULE (positive): aiming DOWN onto the top cap of the top boulder — the
// active surface — passes, and the new object lands on the stack.
function testBuildAcceptsTopFaceViaRealRay() {
  const world = new World(makeTiles(14, 14));
  const game = new Game(world, { x: 0, z: 6, energy: 20 });
  world.addObject({ type: 'boulder', x: 6, z: 6 });
  const topBoulder = world.addObject({ type: 'boulder', x: 6, z: 6 }); // top at y=2.0

  // Eye ABOVE the stack, ray descending onto the top cap (crosses y=2.0 within
  // the disk) — a genuine top-face hit.
  const eye = { x: 4.5, y: 3.5, z: 6.5 };
  const pick = pickRay(world, eye, { x: 6.5, y: 1.9, z: 6.5 });
  assert.equal(pick.object, topBoulder);
  assert.equal(pick.face, 'top');

  assert.equal(game.doAction('boulder', pick), true);
  assert.equal(world.objectsAt(6, 6).length, 3);           // stacked
  assert.equal(game.energy, 20 - ENERGY.boulder);
}

// ROBOT EYE HEIGHT: the robot's eye must clear the top face of a 2-boulder
// stack it stands NEXT to (not on top of) — that top face sits at world Y
// 2.0, and the robot's standing eye height (2.16, i.e. 1.8 * 1.2) is derived
// from EYE_HEIGHT.robot in game.js, kept >= that so a natural, gently
// descending look lands as a genuine top-face hit, not a side hit forcing an
// awkward angle. Uses the Game's own camera eyeY (no hand-forged eye) and a
// flat terrain so the geometry is deterministic.
function testRobotEyeClearsAdjacentStackTopFace() {
  const world = new World(makeTiles(14, 14));
  const game = new Game(world, { x: 0, z: 6, energy: 20 });
  world.addObject({ type: 'boulder', x: 1, z: 6 });
  const topBoulder = world.addObject({ type: 'boulder', x: 1, z: 6 }); // top at y=2.0

  // Robot stands one tile away at (0,6); use the game's real camera eye
  // (surfaceY + EYE_HEIGHT.robot), not a hand-picked height.
  const eye = game._playerHeadPoint();
  assert.ok(eye.y > 2.0, 'robot eye must sit above the 2-boulder stack top');

  const pick = pickRay(world, eye, { x: 1.5, y: 1.95, z: 6.5 });
  assert.equal(pick.object, topBoulder);
  assert.equal(pick.face, 'top');

  assert.equal(game.doAction('boulder', pick), true);
  assert.equal(world.objectsAt(1, 6).length, 3); // stacked onto the top face
  assert.equal(game.energy, 20 - ENERGY.boulder);
}

// FACE RULE — bottom-up SIDE hit on an ELEVATED object. A lone boulder sits on
// a raised summit; the player on low ground aims UP at its flank. The ray
// climbs into the side wall (never the top cap), so face === 'side' and build
// is refused. Confirms the classifier works for ascending rays too.
function testBuildRejectsSideOfElevatedBoulderFromBelow() {
  // Summit at (6,6) raised to level 8 (world Y 2.0); rest of the map flat.
  const world = new World(makeTiles(14, 14, (x, z) => (x === 6 && z === 6 ? 8 : 0)));
  const game = new Game(world, { x: 0, z: 6, energy: 20 });
  const boulder = world.addObject({ type: 'boulder', x: 6, z: 6 }); // spans 2.0..3.0

  // Low eye; aim at the boulder's flank around y ~2.5 — the ray ascends into
  // the side wall.
  const eye = { x: 3.5, y: 1.8, z: 6.5 };
  const pick = pickRay(world, eye, { x: 6.5, y: 2.5, z: 6.5 });
  assert.equal(pick.object, boulder);
  assert.equal(pick.face, 'side');

  assert.equal(game.doAction('boulder', pick), false);
  assert.equal(world.objectsAt(6, 6).length, 1);
  assert.equal(game.energy, 20);
}

// REGRESSION: absorbing the TOP of a stack by hitting its BODY (side) must
// still work — absorb is deliberately forgiving here (rule 3). Only building is
// tightened by the face rule; absorb is unchanged. Real ray.
function testAbsorbSideOfTopStoneStillWorks() {
  const world = new World(makeTiles(14, 14));
  const game = new Game(world, { x: 0, z: 6, energy: 10 });
  const base = world.addObject({ type: 'boulder', x: 6, z: 6 });
  const topBoulder = world.addObject({ type: 'boulder', x: 6, z: 6 }); // top boulder 1..2

  const eye = { x: 1.5, y: 1.5, z: 6.5 };
  const pick = pickRay(world, eye, { x: 6.5, y: 1.5, z: 6.5 });
  assert.equal(pick.object, topBoulder);
  assert.equal(pick.face, 'side');

  // Side hit of the stack's top → absorbs the top boulder; the base remains.
  assert.equal(game.doAction('absorb', pick), true);
  assert.equal(game.energy, 10 + ENERGY.boulder);
  assert.equal(world.objects.includes(topBoulder), false);
  assert.equal(world.objects.includes(base), true);
}

// Rule 4: a lone object resting on the ground may be absorbed by pointing at
// its base square (or at the object itself — same target).
function testAbsorbLoneBoulderViaSquare() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const boulder = world.addObject({ type: 'boulder', x: 2, z: 2 });

  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: null, point: { x: 2.5, y: 0, z: 2.5 } }), true);
  assert.equal(game.energy, 10 + ENERGY.boulder);
  assert.equal(world.objects.includes(boulder), false);
}

// Rules 2 & 3: a thing standing on a boulder is absorbed only by aiming the
// thing; the boulder underneath cannot be absorbed while loaded. Stacks come
// apart strictly top-down.
function testAbsorbStackTopDownOnly() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const boulder = world.addObject({ type: 'boulder', x: 2, z: 2 });
  const robot = world.addObject({ type: 'robot', x: 2, z: 2 });

  // Base square of a loaded stack: refused (rule 3 — boulder is loaded).
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: null, point: { x: 2.5, y: 0, z: 2.5 } }), false);
  assert.equal(world.objectsAt(2, 2).length, 2);
  // Aiming the buried boulder directly: still refused (rule 3).
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: boulder, point: { x: 2.5, y: 0.4, z: 2.5 }, groundTile: { x: 2, z: 2 } }), false);
  assert.equal(world.objects.includes(boulder), true);

  // Aiming the robot on top: absorbed (rule 2).
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: robot, point: { x: 2.5, y: 1.4, z: 2.5 }, groundTile: { x: 2, z: 2 } }), true);
  assert.equal(game.energy, 10 + ENERGY.robot);
  assert.equal(world.objects.includes(robot), false);

  // Now the boulder stands alone — absorbable via its base square (rule 4).
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: null, point: { x: 2.5, y: 0, z: 2.5 } }), true);
  assert.equal(game.energy, 10 + ENERGY.robot + ENERGY.boulder);
  assert.equal(world.objectsAt(2, 2).length, 0);
}

// Rule 5: the Sentinel stands on a pedestal (stack: pedestal + sentinel). It is
// absorbed only by aiming the sentinel (the pedestal's top face where it
// stands), never the tile below; and while the sentinel stands there the
// pedestal itself cannot be absorbed (rule 3).
function testPedestalSentinelAbsorb() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const pedestal = world.addObject({ type: 'pedestal', x: 3, z: 3 });
  const sentinel = world.addObject({ type: 'sentinel', x: 3, z: 3 });
  assert.equal(world.objectsAt(3, 3).length, 2);

  // Aiming the tile below the pedestal: refused (rule 5 — not the tile below).
  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 3 }, object: null, point: { x: 3.5, y: 0, z: 3.5 } }), false);
  assert.equal(world.objects.includes(sentinel), true);
  // Aiming the pedestal itself while loaded: refused (rule 3).
  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 3 }, object: pedestal, point: { x: 3.5, y: 0.4, z: 3.5 }, groundTile: { x: 3, z: 3 } }), false);
  assert.equal(world.objects.includes(pedestal), true);

  // Aiming the sentinel (the pedestal's top face): absorbed (rules 2 & 5).
  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 3 }, object: sentinel, point: { x: 3.5, y: 2, z: 3.5 }, groundTile: { x: 3, z: 3 } }), true);
  assert.equal(game.energy, 10 + ENERGY.sentinel);
  assert.equal(world.objects.includes(sentinel), false);
  // Once the Sentinel is gone the landscape yields no more energy (original
  // rule), so the pedestal remains — untouched — beneath.
  assert.equal(world.objects.includes(pedestal), true);
  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 3 }, object: null, point: { x: 3.5, y: 0, z: 3.5 } }), false);
}

// REGRESSION: the crosshair ray toward an ELEVATED top object aims UPWARD, so
// world.pickTarget never reaches terrain and returns groundTile === null. The
// absorb path must NOT treat that as "pointing past" the object — a direct hit
// on its top face is proof of aim. Uses the real pickTarget geometry.
function testAbsorbElevatedStackViaRealRay() {
  const world = new World(makeTiles(14, 14));
  const game = new Game(world, { x: 0, z: 6, energy: 10 });
  // Robot standing on two boulders at (6,6): top object well above eye height.
  world.addObject({ type: 'boulder', x: 6, z: 6 });
  world.addObject({ type: 'boulder', x: 6, z: 6 });
  const robot = world.addObject({ type: 'robot', x: 6, z: 6 });

  const eye = { x: 1.5, y: 1.8, z: 6.5 };            // robot on the ground
  const pick = pickRay(world, eye, { x: 6.5, y: robot.y + 1.0, z: 6.5 });
  // Sanity: the ray really did hit the top object and the aim was upward.
  assert.equal(pick.object, robot);
  assert.equal(pick.groundTile, null);

  assert.equal(game.doAction('absorb', pick), true);
  assert.equal(game.energy, 10 + ENERGY.robot);
  assert.equal(world.objects.includes(robot), false);
}

// REGRESSION: same for the Sentinel on its pedestal atop a summit — the win
// path depends on being able to absorb it from a lower eye position.
function testAbsorbSentinelOnPedestalViaRealRay() {
  // Summit at (6,6) raised to level 8 (world Y 2.0); player on low ground.
  const world = new World(makeTiles(14, 14, (x, z) => (x === 6 && z === 6 ? 8 : 0)));
  const game = new Game(world, { x: 0, z: 6, energy: 10 });
  world.addObject({ type: 'pedestal', x: 6, z: 6 });
  const sentinel = world.addObject({ type: 'sentinel', x: 6, z: 6 });

  // Eye elevated enough to see over — as the player would be after climbing —
  // but still below the sentinel's body, so the ray aims upward.
  const eye = { x: 3.5, y: 3.0, z: 6.5 };
  const pick = pickRay(world, eye, { x: 6.5, y: sentinel.y + 1.0, z: 6.5 });
  assert.equal(pick.object, sentinel);
  assert.equal(pick.groundTile, null);

  assert.equal(game.doAction('absorb', pick), true);
  assert.equal(game.energy, 10 + ENERGY.sentinel);
  assert.equal(world.objects.includes(sentinel), false);
}

function testSentryActsAsWatcher() {
  const world = new World(makeTiles());
  // A sentry scans and drains exactly like the Sentinel.
  world.addObject({ type: 'sentry', x: 0, z: 0, facing: Math.PI / 2 - Math.PI / 6 });
  const boulder = world.addObject({ type: 'boulder', x: 2, z: 0 });
  const game = new Game(world, { x: 0, z: 7, energy: 10 });

  tickSeconds(game, 10.2);
  assert.equal(world.objects.includes(boulder), false);
  assert.equal(world.objectsAt(2, 0).at(-1).type, 'tree');
}

function testSentryAbsorbYieldsFour() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  world.addObject({ type: 'sentry', x: 3, z: 3 });

  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 3 }, object: null, point: { x: 3.5, y: 0, z: 3.5 } }), true);
  assert.equal(game.energy, 10 + ENERGY.sentry);
  assert.equal(ENERGY.sentry, 4);
}

function testMeanieLosesDistantTarget() {
  const world = new World(makeTiles(31, 31));
  // Player far beyond the meanie's hunting range (>10 tiles away).
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const meanie = world.addObject({ type: 'meanie', x: 25, z: 25, facing: 0 });

  const energyBefore = game.energy;
  tickSeconds(game, 1);
  assert.equal(meanie.type, 'tree');        // reverted, no hunt
  assert.equal(game.energy, energyBefore);  // no forced hyperspace
}

function testHyperspaceRevertsMeanie() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const meanie = world.addObject({ type: 'meanie', x: 5, z: 5, facing: 0 });

  // Escaping by hyperspace resolves the local threat: the meanie reverts.
  assert.equal(game.doAction('hyperspace'), true);
  assert.equal(meanie.type, 'tree');
  assert.equal(world.objects.filter((o) => o.type === 'meanie').length, 0);
}

function testTransferOnlyIntoRobots() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const tree = world.addObject({ type: 'tree', x: 3, z: 3 });
  const boulder = world.addObject({ type: 'boulder', x: 4, z: 4 });

  assert.equal(game.doAction('transfer', { object: tree }), false);
  assert.equal(game.doAction('transfer', { object: boulder }), false);
  assert.equal(game.camera.x, 0);
  assert.equal(game.camera.z, 0);
}

function testNoAbsorbAfterSentinel() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 20 });
  world.addObject({ type: 'sentinel', x: 3, z: 0 });
  const tree = world.addObject({ type: 'tree', x: 5, z: 5 });

  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 0 }, object: null, point: { x: 3.5, y: 0, z: 0.5 } }), true);
  // After the Sentinel is absorbed the landscape yields no more energy...
  assert.equal(game.doAction('absorb', { tile: { x: 5, z: 5 }, object: null, point: { x: 5.5, y: 0, z: 5.5 } }), false);
  assert.equal(world.objects.includes(tree), true);
  // ...but creating objects still works as normal.
  assert.equal(game.doAction('robot', { tile: { x: 3, z: 0 } }), true);
}

function testWinConditionSequence() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 20 });
  const sentinel = world.addObject({ type: 'sentinel', x: 3, z: 0 });

  assert.ok(sentinel);
  assert.equal(game.doAction('absorb', { tile: { x: 3, z: 0 }, object: null, point: { x: 3.5, y: 0, z: 0.5 } }), true);
  assert.equal(game.doAction('robot', { tile: { x: 3, z: 0 } }), true);
  const pedestalRobot = world.objectsAt(3, 0).at(-1);
  // Transferring onto the Sentinel's own square wins the level directly.
  assert.equal(game.doAction('transfer', { object: pedestalRobot }), true);
  assert.equal(game.status, 'won');
}

function testLevelSeedMapping() {
  // Injective: all 10 000 levels map to distinct 8-digit codes, and the
  // inverse recovers every level exactly.
  const seen = new Set();
  for (let level = 0; level < 10000; level += 1) {
    const code = levelToSeed(level);
    assert.ok(Number.isInteger(code) && code >= 0 && code < 100000000);
    assert.ok(!seen.has(code), `duplicate code for level ${level}`);
    seen.add(code);
    assert.equal(seedToLevel(code), level);
  }

  // Non-monotonic: consecutive levels must not produce codes with a constant
  // (predictable) difference.
  const d1 = levelToSeed(1) - levelToSeed(0);
  const d2 = levelToSeed(2) - levelToSeed(1);
  const d3 = levelToSeed(3) - levelToSeed(2);
  assert.ok(!(d1 === d2 && d2 === d3), 'code sequence is arithmetic');

  // Invalid codes map to null: find a code that is not any level's image.
  let probe = 0;
  while (seen.has(probe)) probe += 1;
  assert.equal(seedToLevel(probe), null);
  assert.equal(seedToLevel(-5), null);
  assert.equal(seedToLevel(100000000), null);
  assert.equal(seedToLevel(1.5), null);
}

testEnergyEconomy();
testStackingRules();
testLineOfSightTerrainRidge();
testLineOfSightObjectBlocker();
testSentinelScanDrainChain();
testBoulderDrainsToTree();
testMeanieTriggerWhenHeadVisibleBaseHidden();
testAbsorbTargetsSquareTopObject();
testBuildOnStackViaTopFace();
testBuildRejectsSideOfTopStone();
testBuildAcceptsTopFaceViaRealRay();
testRobotEyeClearsAdjacentStackTopFace();
testBuildRejectsSideOfElevatedBoulderFromBelow();
testAbsorbSideOfTopStoneStillWorks();
testAbsorbLoneBoulderViaSquare();
testAbsorbStackTopDownOnly();
testPedestalSentinelAbsorb();
testAbsorbElevatedStackViaRealRay();
testAbsorbSentinelOnPedestalViaRealRay();
testSentryActsAsWatcher();
testSentryAbsorbYieldsFour();
testMeanieLosesDistantTarget();
testHyperspaceRevertsMeanie();
testTransferOnlyIntoRobots();
testNoAbsorbAfterSentinel();
testWinConditionSequence();
testLevelSeedMapping();

console.log('rules.test.mjs: all tests passed');
