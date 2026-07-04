export const ENERGY = Object.freeze({
  tree: 1,
  boulder: 2,
  robot: 3,
  meanie: 1,
  sentry: 4,
  sentinel: 4,
});

// Single source of truth for the world-Y scale lives in math3d.js.
import { HEIGHT_SCALE } from './math3d.js';
export { HEIGHT_SCALE };

const EPSILON = 1e-6;
const DEFAULT_RADIUS = 0.34;

const OBJECT_HEIGHT = Object.freeze({
  tree: 3.0,    // tall pines, as in the original
  boulder: 1.0,
  robot: 2.4,   // two boulders tall, +20% (raised so the eye clears the top
                // face of a 2-boulder stack for top-face targeting; see
                // EYE_HEIGHT.robot in game.js, kept consistent)
  meanie: 1.35,
  sentry: 2.0,   // a small sentinel, robot-sized
  sentinel: 2.2,
  pedestal: 1.0,
});

const OBJECT_RADIUS = Object.freeze({
  tree: 0.28,
  boulder: 0.38,
  robot: 0.32,
  meanie: 0.30,
  sentry: 0.36,
  sentinel: 0.42,
  pedestal: 0.45,
});

// Stack bases: objects that other things may rest on top of.
const STACKABLE_BASE = new Set(['boulder', 'pedestal']);

function tileHeight(tile) {
  if (!tile) return 0;
  if (typeof tile.height === 'number') return tile.height;
  if (Array.isArray(tile.h) && tile.h.length) {
    return tile.h.reduce((sum, value) => sum + value, 0) / tile.h.length;
  }
  return 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function length3(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize3(vector) {
  const length = length3(vector);
  if (length <= EPSILON) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function objectHeight(object) {
  return object.height ?? OBJECT_HEIGHT[object.type] ?? 1.0;
}

function objectRadius(object) {
  return object.radius ?? OBJECT_RADIUS[object.type] ?? DEFAULT_RADIUS;
}

// Collision radius at a given height above the object's base. A tree is NOT
// a fat full-height cylinder: near the ground only the thin trunk collides,
// and the foliage cone tapers to a point — otherwise clicks landing visually
// in the square next to a trunk (or past a slanted canopy) hit invisible
// volume and get swallowed.
function objectRadiusAt(object, heightAboveBase) {
  if (object.type === 'tree') {
    const FOLIAGE_BASE = 0.7, TOP = 3.0, FOLIAGE_R = 0.5;
    if (heightAboveBase < FOLIAGE_BASE) return 0.12;               // trunk
    return FOLIAGE_R * Math.max(0, (TOP - heightAboveBase) / (TOP - FOLIAGE_BASE));
  }
  return objectRadius(object);
}

function objectCenter(object) {
  return { x: object.x + 0.5, z: object.z + 0.5 };
}

export class World {
  constructor(tiles) {
    if (!Array.isArray(tiles) || tiles.length === 0 || !Array.isArray(tiles[0])) {
      throw new Error('World requires a non-empty 2D tile array');
    }
    this.tiles = tiles;
    this.depth = tiles.length;
    this.width = tiles[0].length;
    this.objects = [];
    // Visual-only ghosts of absorbed objects (dissolve 1 -> 0); the renderer
    // draws them, nothing else ever consults them.
    this.effects = [];
    // Visual-only energy motes (absorb/create bursts). A flat list of tiny
    // particles the renderer projects as 2-3px sprites; nothing else reads them.
    // Kept as a SEPARATE array from `effects` on purpose: `effects` entries are
    // full mesh-bearing ghost objects the renderer instances, whereas motes are
    // primitive point sprites — mixing the two would force the object emitter to
    // branch on shape. Both are equally "presentation-only".
    this.motes = [];
    this._nextObjectId = 1;
  }

  objectsAt(x, z) {
    return this.objects
      .filter((object) => object.x === x && object.z === z)
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
  }

  surfaceY(x, z) {
    const tile = this._tileAt(x, z);
    return tileHeight(tile) * HEIGHT_SCALE;
  }

  terrainYAt(worldX, worldZ) {
    const tileX = clamp(Math.floor(worldX), 0, this.width - 1);
    const tileZ = clamp(Math.floor(worldZ), 0, this.depth - 1);
    const tile = this.tiles[tileZ][tileX];
    const h = Array.isArray(tile.h) && tile.h.length >= 4
      ? tile.h
      : [tileHeight(tile), tileHeight(tile), tileHeight(tile), tileHeight(tile)];
    const u = clamp(worldX - tileX, 0, 1);
    const v = clamp(worldZ - tileZ, 0, 1);
    // Triangle interpolation along the h00-h11 diagonal — MUST match how the
    // renderer triangulates non-planar tiles, so that the pick ray and the
    // picture agree (bilinear sampling bulges where the screen shows a plane).
    // Corners: h[0]=h00(x0,z0) h[1]=h10(x1,z0) h[2]=h11(x1,z1) h[3]=h01(x0,z1)
    let y;
    if (u >= v) {
      y = h[0] + (h[1] - h[0]) * u + (h[2] - h[1]) * v; // triangle 00-10-11
    } else {
      y = h[0] + (h[2] - h[3]) * u + (h[3] - h[0]) * v; // triangle 00-11-01
    }
    return y * HEIGHT_SCALE;
  }

  topAt(x, z) {
    const stack = this.objectsAt(x, z);
    if (stack.length === 0) return this.surfaceY(x, z);
    const top = stack[stack.length - 1];
    return (top.y ?? this.surfaceY(x, z)) + objectHeight(top);
  }

  addObject(object) {
    if (!object || !object.type) return null;
    const candidate = { ...object };
    if (!this.canPlace(candidate.type, candidate.x, candidate.z)) return null;
    candidate.id ??= this._nextObjectId++;
    candidate.energy ??= ENERGY[candidate.type] ?? 1;
    candidate.y = this.restingY(candidate.type, candidate.x, candidate.z);
    candidate.height ??= objectHeight(candidate);
    candidate.radius ??= objectRadius(candidate);
    this.objects.push(candidate);
    return candidate;
  }

  removeObject(object) {
    const index = this.objects.indexOf(object);
    if (index === -1) return false;
    this.objects.splice(index, 1);
    return true;
  }

  canPlace(type, x, z) {
    if (!this._inBounds(x, z)) return false;
    const stack = this.objectsAt(x, z);
    const top = stack[stack.length - 1] ?? null;
    // Bare ground: objects may only rest on flat tiles (never on slopes).
    if (!top) {
      const tile = this._tileAt(x, z);
      return Boolean(tile && tile.flat);
    }
    if (type === 'boulder') return top.type === 'boulder';
    if (type === 'tree' || type === 'robot' || type === 'sentinel' || type === 'sentry' || type === 'meanie') {
      return STACKABLE_BASE.has(top.type);
    }
    return false;
  }

  restingY(type, x, z) {
    const stack = this.objectsAt(x, z);
    if (stack.length === 0) return this.surfaceY(x, z);
    const top = stack[stack.length - 1];
    if (STACKABLE_BASE.has(top.type)) return (top.y ?? 0) + objectHeight(top);
    return this.surfaceY(x, z);
  }

  isTopObject(object) {
    const stack = this.objectsAt(object.x, object.z);
    return stack[stack.length - 1] === object;
  }

  canSee(eye, target) {
    const start = this._point(eye);
    const end = this._point(target);
    const delta = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
    const distance = length3(delta);
    if (distance <= EPSILON) return true;
    const steps = Math.max(8, Math.ceil(distance * 18));

    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const point = {
        x: start.x + delta.x * t,
        y: start.y + delta.y * t,
        z: start.z + delta.z * t,
      };

      if (this.terrainYAt(point.x, point.z) >= point.y - 0.02) return false;

      for (const object of this.objects) {
        if (this._pointInsideObject(start, object) || this._pointInsideObject(end, object)) continue;
        if (this._pointInsideObject(point, object)) return false;
      }
    }

    return true;
  }

  // Marches the crosshair ray. Returns the first hit (object or terrain) plus
  // `groundTile` — the tile the ray would reach on TERRAIN if all objects were
  // ignored. Near-misses of an object's base square can then be forgiven:
  // hitting a trunk while the ray would land in the same square still counts
  // as pointing at that square.
  pickTarget(rayOrigin, rayDir) {
    const origin = this._point(rayOrigin);
    const direction = normalize3(rayDir);
    if (length3(direction) <= EPSILON) return null;

    const maxDistance = 80;
    const stepSize = 0.05;
    let objectHit = null;
    for (let distance = stepSize; distance <= maxDistance; distance += stepSize) {
      const point = {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
        z: origin.z + direction.z * distance,
      };

      if (!objectHit) {
        for (const object of this.objects) {
          if (this._pointInsideObject(origin, object)) continue;
          if (this._pointInsideObject(point, object)) {
            objectHit = { object, point, face: this._objectFaceHit(origin, direction, object) };
            break;
          }
        }
      }

      if (!this._worldPointInBounds(point.x, point.z)) continue;
      const terrainY = this.terrainYAt(point.x, point.z);
      if (point.y <= terrainY + 0.02) {
        const groundTile = {
          x: clamp(Math.floor(point.x), 0, this.width - 1),
          z: clamp(Math.floor(point.z), 0, this.depth - 1),
        };
        if (objectHit) {
          return {
            tile: { x: objectHit.object.x, z: objectHit.object.z },
            object: objectHit.object,
            point: objectHit.point,
            face: objectHit.face,
            groundTile,
          };
        }
        return {
          tile: groundTile,
          object: null,
          point: { x: point.x, y: terrainY, z: point.z },
          groundTile,
        };
      }
    }

    if (objectHit) {
      // Ray hit an object but never reached terrain (e.g. sky behind).
      return {
        tile: { x: objectHit.object.x, z: objectHit.object.z },
        object: objectHit.object,
        point: objectHit.point,
        face: objectHit.face,
        groundTile: null,
      };
    }
    return null;
  }

  // Classify WHICH surface of an object's collision volume (a vertical
  // cylinder) the crosshair ray enters through: the top cap, the bottom cap, or
  // the side wall. Done analytically from the ray, NOT from the discrete march
  // sample, so it is independent of stepSize and correct on corner grazes:
  //   - a DESCENDING ray that crosses the top plane (y = topY) within the cap
  //     disk enters through the top — above the top there is no solid, so that
  //     crossing IS the entry. If it crosses the top plane OUTSIDE the disk it
  //     is still outside the cylinder there and can only enter the side lower
  //     down.
  //   - symmetric reasoning for an ASCENDING ray and the bottom cap.
  //   - anything else is a side-wall entry.
  _objectFaceHit(origin, direction, object) {
    const center = objectCenter(object);
    const baseY = object.y ?? this.surfaceY(object.x, object.z);
    const topY = baseY + objectHeight(object);
    const withinDisk = (t, radius) => {
      const px = origin.x + direction.x * t;
      const pz = origin.z + direction.z * t;
      const dx = px - center.x;
      const dz = pz - center.z;
      return dx * dx + dz * dz <= radius * radius;
    };
    if (direction.y < -EPSILON) {
      const t = (topY - origin.y) / direction.y;
      if (t > 0 && withinDisk(t, objectRadiusAt(object, objectHeight(object)))) return 'top';
    } else if (direction.y > EPSILON) {
      const t = (baseY - origin.y) / direction.y;
      if (t > 0 && withinDisk(t, objectRadiusAt(object, 0))) return 'bottom';
    }
    return 'side';
  }

  _tileAt(x, z) {
    if (!this._inBounds(x, z)) return null;
    return this.tiles[z][x];
  }

  _inBounds(x, z) {
    return Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  _worldPointInBounds(x, z) {
    return x >= 0 && z >= 0 && x <= this.width && z <= this.depth;
  }

  _point(point) {
    return {
      x: point.x,
      y: point.y ?? point.eyeY ?? 0,
      z: point.z,
    };
  }

  _pointInsideObject(point, object) {
    const center = objectCenter(object);
    const y = object.y ?? this.surfaceY(object.x, object.z);
    if (point.y < y - 0.02 || point.y > y + objectHeight(object) + 0.02) return false;
    const radius = objectRadiusAt(object, point.y - y);
    const dx = point.x - center.x;
    const dz = point.z - center.z;
    return dx * dx + dz * dz <= radius * radius;
  }
}

export default World;
