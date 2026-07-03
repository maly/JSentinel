import assert from 'node:assert/strict';
import { World, ENERGY } from '../js/world.js';
import { Game } from '../js/game.js';

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
  const world = new World(makeTiles(8, 8, (x, z) => (x === 3 && z === 1 ? 2 : 0)));
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
  // HEIGHT_SCALE is 0.5: ridge height 3 -> world Y 1.5, which hides the
  // player's base (ray dips to ~0.8-1.1) but not the head (ray stays ~1.7).
  const world = new World(makeTiles(8, 8, (x, z) => (x === 3 && z === 0 ? 3 : 0)));
  world.addObject({ type: 'sentinel', x: 0, z: 0, facing: Math.PI / 2 });
  const tree = world.addObject({ type: 'tree', x: 6, z: 1 });
  const game = new Game(world, { x: 6, z: 0, energy: 10 });

  game.tick(0.1);

  assert.equal(tree.type, 'meanie');
  assert.equal(game.scannedBySentinel, true);
  // Head visible but base hidden => scan state 1 ("seen", cannot drain).
  assert.equal(game.scanState, 1);
}

function testAbsorbTargetsSquareTopObject() {
  const world = new World(makeTiles());
  const game = new Game(world, { x: 0, z: 0, energy: 10 });
  const boulder = world.addObject({ type: 'boulder', x: 2, z: 2 });
  const tree = world.addObject({ type: 'tree', x: 2, z: 2 });

  // Pointing at the square absorbs the TOP object of its stack (the tree).
  assert.equal(game.doAction('absorb', { tile: { x: 2, z: 2 }, object: null, point: { x: 2.5, y: 0.5, z: 2.5 } }), true);
  assert.equal(game.energy, 10 + ENERGY.tree);
  assert.equal(world.objects.includes(tree), false);
  assert.equal(world.objects.includes(boulder), true);
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

testEnergyEconomy();
testStackingRules();
testLineOfSightTerrainRidge();
testLineOfSightObjectBlocker();
testSentinelScanDrainChain();
testBoulderDrainsToTree();
testMeanieTriggerWhenHeadVisibleBaseHidden();
testAbsorbTargetsSquareTopObject();
testTransferOnlyIntoRobots();
testWinConditionSequence();

console.log('rules.test.mjs: all tests passed');
