import { ENERGY } from './world.js';

const STEP = 0.1;
const SENTINEL_ROTATE_SECONDS = 10;
const SENTINEL_DRAIN_SECONDS = 7;
// The Sentinel only sees within a cone around its current facing —
// it rotates in 30° steps, sweeping the landscape.
const SENTINEL_HALF_FOV = Math.PI / 6;
const MEANIE_COOLDOWN_SECONDS = 8;
const DISSOLVE_SECONDS = 1.2;

// What a drained object degrades into (energy conservation: the lost unit
// reappears as a tree the sentinel plants somewhere in its field of view).
const DRAIN_CHAIN = Object.freeze({ robot: 'boulder', boulder: 'tree' });
const MEANIE_TURN_RATE = Math.PI * 2;
const MEANIE_FACE_TOLERANCE = Math.PI / 36;

const EYE_HEIGHT = Object.freeze({
  tree: 1.15,
  robot: 1.8,    // robot stands 2.0 tall (two boulders)
  sentinel: 1.9,
  meanie: 1.15,
});

function centerOf(objectOrTile) {
  return { x: objectOrTile.x + 0.5, z: objectOrTile.z + 0.5 };
}

function shortestAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function angleTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export class Game {
  constructor(world, playerStart = {}) {
    this.world = world;
    this.energy = playerStart.energy ?? 10;
    this.status = 'playing';
    this.messages = [];
    this.scannedBySentinel = false;
    // 0 = sentinel can't see the player, 1 = sees the head only (can't
    // drain), 2 = sees the player's square and drains.
    this.scanState = 0;
    this.playerShellId = null;
    this.pendingFacing = null;   // set on transfer; consumed by the camera
    this.camera = {
      x: playerStart.x ?? 0,
      z: playerStart.z ?? 0,
      eyeY: playerStart.eyeY ?? world.surfaceY(playerStart.x ?? 0, playerStart.z ?? 0) + EYE_HEIGHT.robot,
    };
    this.facing = playerStart.facing ?? 0;

    this._accumulator = 0;
    this._sentinelRotateTimer = 0;
    this._sentinelDrainTimer = 0;
    this._sentinelAbsorbed = false;
    this._sentinelPedestal = null;

    const shell = world.addObject({
      type: playerStart.shellType ?? 'robot',
      x: this.camera.x,
      z: this.camera.z,
      energy: ENERGY.robot,
      facing: this.facing,
      controlled: true,
    });
    if (shell) {
      this.playerShellId = shell.id;
      this.camera.eyeY = shell.y + (EYE_HEIGHT[shell.type] ?? EYE_HEIGHT.robot);
    }
  }

  tick(dt) {
    if (this.status !== 'playing') return;
    this._accumulator += dt;
    while (this._accumulator >= STEP && this.status === 'playing') {
      this._accumulator -= STEP;
      this._step(STEP);
    }
  }

  doAction(action, pickResult = null) {
    if (this.status !== 'playing') return false;

    switch (action) {
      case 'absorb':
        return this._absorb(pickResult);
      case 'tree':
      case 'boulder':
      case 'robot':
        return this._create(action, pickResult?.tile ?? null, pickResult);
      case 'transfer':
        return this._transfer(pickResult?.object ?? null);
      case 'hyperspace':
        return this._hyperspace();
      case 'uturn':
        this.facing = (this.facing + Math.PI) % (Math.PI * 2);
        this._message('U-turn');
        return true;
      default:
        this._message(`Unknown action: ${action}`);
        return false;
    }
  }

  _step(dt) {
    this.scannedBySentinel = false;
    this._runSentinel(dt);
    this._runMeanies(dt);
    this._runDissolve(dt);
  }

  // Advance materialization of created objects and fade-out of absorbed ones.
  _runDissolve(dt) {
    const rate = dt / DISSOLVE_SECONDS;
    for (const object of this.world.objects) {
      if (typeof object.dissolve === 'number' && object.dissolve < 1) {
        object.dissolve = Math.min(1, object.dissolve + rate);
      }
    }
    const effects = this.world.effects;
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      effects[i].dissolve -= rate;
      if (effects[i].dissolve <= 0) effects.splice(i, 1);
    }
  }

  _absorb(pickResult) {
    if (!pickResult) return false;
    // As in the original: absorption works ONLY by pointing at the SQUARE the
    // object stands on. Pointing at the object's body does nothing.
    if (pickResult.object) {
      this._message('Aim at the square the object stands on');
      return false;
    }
    const tile = pickResult.tile;
    if (!tile) return false;
    const stack = this.world.objectsAt(tile.x, tile.z);
    const object = stack[stack.length - 1] ?? null;
    if (!object || object.id === this.playerShellId) return false;
    if (object.type === 'pedestal') {
      this._message('The pedestal cannot be absorbed');
      return false;
    }
    // A pick with a hit point came from the crosshair ray — visibility proven.
    const seen = pickResult.point ? true : this._canSeeRestingSquare(object);
    if (!seen) {
      this._message('Target square is not visible');
      return false;
    }

    this.energy += ENERGY[object.type] ?? object.energy ?? 0;
    if (object.type === 'sentinel') {
      this._sentinelAbsorbed = true;
      this._sentinelPedestal = { x: object.x, z: object.z, y: object.y };
      this._message('Sentinel absorbed');
    }
    this.world.removeObject(object);
    // Leave a visual ghost that dissolves away (original's dissolve effect).
    this.world.effects.push({
      type: object.type, x: object.x, z: object.z, y: object.y,
      facing: object.facing ?? 0, dissolve: 1,
    });
    return true;
  }

  _create(type, tile, pickResult = null) {
    if (!tile) return false;
    const cost = ENERGY[type];
    if (this.energy < cost) {
      this._message('Insufficient energy');
      return false;
    }
    // A pick with a hit point came from the player's own crosshair ray —
    // the ray itself proves the square is visible. The centre-of-tile LOS
    // check is only a fallback for direct (rayless) calls.
    const seen = pickResult?.point ? true : this._canSeeTileTop(tile.x, tile.z);
    if (!seen) {
      this._message('Target square is not visible');
      return false;
    }
    // dissolve: 0 -> materializes gradually (visual dissolve-in).
    const object = this.world.addObject({ type, x: tile.x, z: tile.z, energy: cost, dissolve: 0 });
    if (!object) {
      this._message('Cannot create object there');
      return false;
    }
    this.energy -= cost;
    this._message(`Created ${type}`);
    return true;
  }

  _transfer(object) {
    // Consciousness can only transfer into robot shells.
    if (!object || object.type !== 'robot' || object.id === this.playerShellId) {
      return false;
    }
    if (!this.world.isTopObject(object) || !this._canSeeRestingSquare(object)) {
      this._message('Transfer target is not visible');
      return false;
    }

    const oldShell = this._playerShell();
    if (oldShell) {
      oldShell.energy = ENERGY.robot;
      oldShell.controlled = false;
      // As in the original: after transferring you face the shell you left.
      this.pendingFacing = Math.atan2(oldShell.x - object.x, oldShell.z - object.z);
    }

    object.controlled = true;
    object.energy = Math.max(object.energy ?? 0, ENERGY[object.type] ?? 1);
    this.playerShellId = object.id;
    this.camera = {
      x: object.x,
      z: object.z,
      eyeY: object.y + (EYE_HEIGHT[object.type] ?? EYE_HEIGHT.robot),
    };
    this.facing = object.facing ?? this.facing;
    // The level is won by climbing high enough to see the Sentinel's square,
    // absorbing it, and transferring onto its place.
    if (this._sentinelAbsorbed
      && this._sentinelPedestal
      && object.x === this._sentinelPedestal.x
      && object.z === this._sentinelPedestal.z) {
      this.status = 'won';
      this._message('Landscape absorbed');
      return true;
    }
    this._message('Transferred');
    return true;
  }

  _hyperspace() {
    if (this.energy < ENERGY.robot) {
      this._die('Insufficient energy for hyperspace');
      return false;
    }
    this.energy -= ENERGY.robot;

    const currentHeight = this._playerBasePoint().y;
    const destination = this._randomFlatTileAtOrBelow(currentHeight);
    if (destination) this._movePlayerTo(destination.x, destination.z);
    this._message('Hyperspace');
    return true;
  }

  _runSentinel(dt) {
    const sentinel = this.world.objects.find((object) => object.type === 'sentinel');
    if (!sentinel) return;

    this._sentinelRotateTimer += dt;
    if (this._sentinelRotateTimer >= SENTINEL_ROTATE_SECONDS) {
      this._sentinelRotateTimer = 0;
      sentinel.facing = ((sentinel.facing ?? 0) + Math.PI / 6) % (Math.PI * 2);
      // After turning, the sentinel scans the fresh view and feeds:
      // robots first, then boulders — one unit per scan.
      this._scanAndDrainObjects(sentinel);
    }

    const baseVisible = this._sentinelSees(sentinel, this._playerBasePoint());
    const headVisible = this._sentinelSees(sentinel, this._playerHeadPoint());
    this.scannedBySentinel = baseVisible || headVisible;
    this.scanState = baseVisible ? 2 : (headVisible ? 1 : 0);

    this._sentinelDrainTimer += dt;
    if (this._sentinelDrainTimer >= SENTINEL_DRAIN_SECONDS) {
      this._sentinelDrainTimer = 0;
      if (baseVisible) {
        this._drainPlayer();
        this._spawnTreeInFov(sentinel);
      }
    }

    this._meanieCooldown = Math.max(0, (this._meanieCooldown ?? 0) - dt);
    const meanieExists = this.world.objects.some((object) => object.type === 'meanie');
    if (!baseVisible && headVisible && !meanieExists && this._meanieCooldown === 0) {
      this._convertNearestTreeToMeanie();
      this._meanieCooldown = MEANIE_COOLDOWN_SECONDS;
    }
  }

  _runMeanies(dt) {
    const playerPoint = this._playerHeadPoint();
    for (const meanie of [...this.world.objects.filter((object) => object.type === 'meanie')]) {
      const meaniePoint = centerOf(meanie);
      const desired = angleTo(meaniePoint, playerPoint);
      const current = meanie.facing ?? 0;
      const delta = shortestAngleDelta(current, desired);
      const turn = Math.sign(delta) * Math.min(Math.abs(delta), MEANIE_TURN_RATE * dt);
      meanie.facing = current + turn;

      if (Math.abs(shortestAngleDelta(meanie.facing, desired)) <= MEANIE_FACE_TOLERANCE) {
        meanie.type = 'tree';
        meanie.energy = ENERGY.tree;
        meanie.height = undefined;
        meanie.radius = undefined;
        this._message('Meanie forced hyperspace');
        this._hyperspace();
      }
    }
  }

  _drainPlayer() {
    this.energy -= 1;
    this._message('Sentinel drained energy');
    if (this.energy < 0) this._die('Energy depleted');
  }

  _sentinelSees(sentinel, point) {
    const origin = centerOf(sentinel);
    const delta = shortestAngleDelta(sentinel.facing ?? 0, angleTo(origin, point));
    if (Math.abs(delta) > SENTINEL_HALF_FOV) return false;
    return this.world.canSee(this._objectEye(sentinel), point);
  }

  // One scan = drain one unit from the first visible target, robots before
  // boulders. Draining degrades the object one step down the energy chain
  // (robot -> boulder -> tree) and the drained unit reappears as a tree the
  // sentinel plants somewhere in its field of view.
  _scanAndDrainObjects(sentinel) {
    for (const wantedType of ['robot', 'boulder']) {
      for (const object of this.world.objects) {
        if (object.type !== wantedType) continue;
        if (object.id === this.playerShellId) continue;
        if (!this.world.isTopObject(object)) continue;
        if (!this._sentinelSees(sentinel, this._restingPoint(object))) continue;

        const { x, z } = object;
        this.world.removeObject(object);
        this.world.addObject({ type: DRAIN_CHAIN[wantedType], x, z, dissolve: 0 });
        this._spawnTreeInFov(sentinel);
        return;
      }
    }
  }

  // The drained unit becomes a tree, preferably on a flat tile the sentinel
  // currently sees; if its whole view offers no spot, anywhere else.
  _spawnTreeInFov(sentinel) {
    const inFov = this._randomTile((x, z, tile) => tile.flat
      && this.world.canPlace('tree', x, z)
      && this._sentinelSees(sentinel, {
        x: x + 0.5, z: z + 0.5, y: this.world.topAt(x, z) + 0.05,
      }));
    const tile = inFov
      ?? this._randomTile((x, z, t) => t.flat && this.world.canPlace('tree', x, z));
    if (tile) this.world.addObject({ type: 'tree', x: tile.x, z: tile.z, dissolve: 0 });
  }

  _convertNearestTreeToMeanie() {
    const player = this._playerHeadPoint();
    const nearest = this.world.objects
      .filter((object) => object.type === 'tree')
      .sort((a, b) => distanceSq(centerOf(a), player) - distanceSq(centerOf(b), player))[0];
    if (!nearest) return;
    nearest.type = 'meanie';
    nearest.energy = ENERGY.meanie;
    nearest.facing = nearest.facing ?? 0;
    this._message('Tree became a meanie');
  }

  _randomFlatTileAtOrBelow(maxHeight) {
    return this._randomTile((x, z, tile) => {
      const shell = this._playerShell();
      const type = shell?.type ?? 'robot';
      return tile.flat && this.world.surfaceY(x, z) <= maxHeight && this._canMoveShellTo(type, x, z);
    });
  }

  _randomTile(predicate) {
    const candidates = [];
    for (let z = 0; z < this.world.depth; z += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        const tile = this.world.tiles[z][x];
        if (predicate(x, z, tile)) candidates.push({ x, z });
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  _movePlayerTo(x, z) {
    const shell = this._playerShell();
    if (!shell) {
      this.camera = { x, z, eyeY: this.world.surfaceY(x, z) + EYE_HEIGHT.robot };
      return true;
    }

    this.world.removeObject(shell);
    if (!this.world.canPlace(shell.type, x, z)) {
      this.world.objects.push(shell);
      return false;
    }
    shell.x = x;
    shell.z = z;
    shell.y = this.world.restingY(shell.type, x, z);
    this.world.objects.push(shell);
    this.camera = {
      x,
      z,
      eyeY: shell.y + (EYE_HEIGHT[shell.type] ?? EYE_HEIGHT.robot),
    };
    return true;
  }

  _canMoveShellTo(type, x, z) {
    const shell = this._playerShell();
    if (!shell) return this.world.canPlace(type, x, z);
    this.world.removeObject(shell);
    const canPlace = this.world.canPlace(type, x, z);
    this.world.objects.push(shell);
    return canPlace;
  }

  _canSeeRestingSquare(object) {
    return this.world.canSee(this._playerHeadPoint(), this._restingPoint(object));
  }

  _canSeeTileTop(x, z) {
    return this.world.canSee(this._playerHeadPoint(), {
      x: x + 0.5,
      z: z + 0.5,
      y: this.world.topAt(x, z) + 0.05,
    });
  }

  _restingPoint(object) {
    return {
      ...centerOf(object),
      y: (object.y ?? this.world.surfaceY(object.x, object.z)) + 0.05,
    };
  }

  _playerBasePoint() {
    const shell = this._playerShell();
    if (shell) return this._restingPoint(shell);
    return {
      x: this.camera.x + 0.5,
      z: this.camera.z + 0.5,
      y: this.world.surfaceY(this.camera.x, this.camera.z) + 0.05,
    };
  }

  _playerHeadPoint() {
    return {
      x: this.camera.x + 0.5,
      z: this.camera.z + 0.5,
      y: this.camera.eyeY,
    };
  }

  _objectEye(object) {
    return {
      ...centerOf(object),
      y: (object.y ?? this.world.surfaceY(object.x, object.z)) + (EYE_HEIGHT[object.type] ?? 1.2),
    };
  }

  _playerShell() {
    return this.world.objects.find((object) => object.id === this.playerShellId) ?? null;
  }

  _die(message) {
    this.status = 'dead';
    this._message(message);
  }

  _message(message) {
    this.messages.push(message);
  }
}

export default Game;
