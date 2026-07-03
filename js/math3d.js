// math3d.js — vectors, camera transform, perspective projection, ray-pick.
// The Sentinel clone (deep-reasoner, Task 1). Vanilla ES module, no deps.
//
// Coordinate system (right-handed):
//   +X east, +Y up, +Z north. Tile (x,z) spans x..x+1, z..z+1 in world units.
//   Corner height unit -> world Y via HEIGHT_SCALE.
//
// Camera { x, y, z, yaw, pitch }:
//   yaw   = rotation about +Y. yaw=0 looks along +Z. Increasing yaw turns right.
//   pitch = look up/down. pitch>0 looks UP, pitch<0 looks DOWN. Clamp ±60° upstream.
//
// View space: camera at origin, looking down +Z (into screen), +X right, +Y up.
// A point is in front of the camera iff its view-space z > 0.

// ---- Viewport / projection constants ------------------------------------
export const VIEW_W = 512;
export const VIEW_H = 384;
export const CX = VIEW_W / 2;   // 256
export const CY = VIEW_H / 2;   // 192
// Focal length in pixels. hfov ~= 2*atan(256/430) ~= 61°. Square pixels.
export const FOCAL = 430;
// Near plane distance in view space. Polygons are clipped to z >= NEAR so that
// geometry behind / straddling the camera never projects to garbage.
export const NEAR = 0.05;

// 1 corner-height unit = HEIGHT_SCALE world Y units. 0.25 matches the original
// game's finer 32-LEVEL grid: a summit near level ~28 -> ~7 world units over a
// 31-wide map, while the general landscape (levels 0..~20) stays gentle.
// Integration note: world.js / game.js should read this to convert heights.
export const HEIGHT_SCALE = 0.25;

// ---- Vector helpers (plain {x,y,z} objects) -----------------------------
export function vec(x = 0, y = 0, z = 0) { return { x, y, z }; }
export function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
export function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function vscale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
export function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function vcross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
export function vlen(a) { return Math.hypot(a.x, a.y, a.z); }
export function vnorm(a) {
  const l = vlen(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

// ---- Camera transform ---------------------------------------------------
// Build a fast world->view transform for one frame. Precomputes trig.
// Returns { toView(p) -> {x,y,z}, pos, forward }.
export function makeView(cam) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const ox = cam.x, oy = cam.y, oz = cam.z;
  function toView(p) {
    const dx = p.x - ox, dy = p.y - oy, dz = p.z - oz;
    // yaw about Y
    const x1 = cy * dx - sy * dz;
    const z1 = sy * dx + cy * dz;
    const y1 = dy;
    // pitch about X
    return {
      x: x1,
      y: cp * y1 - sp * z1,
      z: sp * y1 + cp * z1,
    };
  }
  // World-space forward (unit): direction the camera looks.
  const forward = { x: sy * cp, y: sp, z: cy * cp };
  return { toView, pos: { x: ox, y: oy, z: oz }, forward };
}

// Convenience: transform a single world point into view space.
export function worldToView(cam, p) { return makeView(cam).toView(p); }

// ---- Perspective projection ---------------------------------------------
// Project a VIEW-SPACE point to screen pixels. Returns { x, y } (y down).
// Assumes v.z > 0 (caller must near-clip first). Does not itself reject.
export function projectView(v) {
  const invz = 1 / v.z;
  return { x: CX + FOCAL * v.x * invz, y: CY - FOCAL * v.y * invz };
}

// Project a world point directly. Returns { x, y, z } (z = view depth) or
// null if behind the near plane.
export function projectPoint(cam, p) {
  const v = worldToView(cam, p);
  if (v.z <= NEAR) return null;
  const s = projectView(v);
  return { x: s.x, y: s.y, z: v.z };
}

// ---- Screen-center ray (crosshair picking) ------------------------------
// Given camera { x, y, z, yaw, pitch }, return the ray through screen center.
//   { origin: {x,y,z}, dir: {x,y,z} }   dir is a unit vector.
// Consumers (world.js) march this ray against terrain / object stacks.
export function screenCenterRay(cam) {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
  return {
    origin: { x: cam.x, y: cam.y, z: cam.z },
    dir: { x: syw * cp, y: sp, z: cyw * cp }, // already unit length
  };
}

// General screen-pixel -> world ray, in case picking off-center is ever needed.
export function screenRay(cam, sx, sy) {
  // View-space direction for pixel (sx, sy): x right, y up, z forward.
  const vx = (sx - CX) / FOCAL;
  const vy = -(sy - CY) / FOCAL;
  const vz = 1;
  // Rotate view dir back into world (inverse of makeView rotation).
  const cy = Math.cos(cam.yaw), sy2 = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  // inverse pitch (about X): (y,z) rotated by -pitch's transpose
  const y1 = cp * vy + sp * vz;
  const z1 = -sp * vy + cp * vz;
  const x1 = vx;
  // inverse yaw (about Y)
  const wx = cy * x1 + sy2 * z1;
  const wz = -sy2 * x1 + cy * z1;
  const wy = y1;
  return { origin: { x: cam.x, y: cam.y, z: cam.z }, dir: vnorm({ x: wx, y: wy, z: wz }) };
}
