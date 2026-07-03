// renderer.js — flat-shaded polygon renderer on Canvas 2D.
// deep-reasoner, Task 1. Vanilla ES module, no deps.
//
// render(ctx, world, camera, uiState)
//   world:  { tiles, objects, surfaceY(x,z) }  (world.js contract; read-only)
//   camera: { x, y, z, yaw, pitch }
//   uiState:{ crosshair: bool }
//
// Pipeline per frame:
//   1. Sky gradient bands.
//   2. Collect terrain quads + object mesh faces as world-space polygons.
//   3. World->view transform, near-plane clip, backface cull, project.
//   4. Painter's algorithm: sort polys by centroid view-depth (far first).
//   5. Fill flat-shaded + 1px darker outline for the vector look.
//   6. Crosshair.

import {
  VIEW_W, VIEW_H, CX, CY, NEAR, HEIGHT_SCALE,
  makeView, projectView, vsub, vcross, vnorm, vdot,
} from './math3d.js';

// Boulder height in world Y units (objects stack by this). Integration note:
// world.js should use the same constant when computing stack surface heights.
export const BOULDER_H = 1.0;

// ---- Palette ------------------------------------------------------------
const SKY_TOP = [0x22, 0x3A, 0x9C];
const SKY_HORIZON = [0x6E, 0x92, 0xE6];
const GREEN_A = [0x55, 0xBB, 0x55];   // checkerboard light green
const GREEN_B = [0x3D, 0x8B, 0x3D];   // checkerboard dark green
const COL = {
  treeLeaf: [0x2E, 0x8B, 0x33],
  treeTrunk: [0x6B, 0x49, 0x2A],
  boulder: [0x9A, 0x9A, 0x9E],
  robot: [0xC8, 0xA8, 0x40],   // yellow-ochre
  sentinel: [0xE6, 0xE6, 0xF0], // pale
  sentinelHood: [0xBF, 0xBF, 0xCF],
  meanie: [0xC8, 0x30, 0x30],  // red
  pedestal: [0x86, 0x80, 0x72],
};

// Directional light (from upper-front). Flat ground (normal +Y) reads bright.
const LIGHT = vnorm({ x: -0.35, y: 1.0, z: -0.28 });
const AMBIENT = 0.45;
const DIFFUSE = 0.55;

function shade(rgb, brightness) {
  const b = Math.max(0, Math.min(1.25, brightness));
  return [
    Math.min(255, rgb[0] * b) | 0,
    Math.min(255, rgb[1] * b) | 0,
    Math.min(255, rgb[2] * b) | 0,
  ];
}
const rgbStr = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// Brightness for a world-space polygon given its vertices (CCW from outside).
function faceBrightness(worldVerts, flipToUp = false) {
  const n0 = vcross(vsub(worldVerts[1], worldVerts[0]), vsub(worldVerts[2], worldVerts[0]));
  let n = vnorm(n0);
  if (flipToUp && n.y < 0) n = { x: -n.x, y: -n.y, z: -n.z };
  const d = Math.max(0, vdot(n, LIGHT));
  return AMBIENT + DIFFUSE * d;
}

// ---- Sky ----------------------------------------------------------------
function drawSky(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, rgbStr(SKY_TOP));
  g.addColorStop(1, rgbStr(SKY_HORIZON));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Subtle horizontal bands for the retro look.
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < VIEW_H; y += 24) ctx.fillRect(0, y, VIEW_W, 1);
  ctx.globalAlpha = 1;
}

// ---- Near-plane clip (Sutherland–Hodgman against z = NEAR) ---------------
// Clips a polygon of view-space verts; returns [] if fully behind.
function clipNear(verts) {
  const out = [];
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const aIn = a.z >= NEAR;
    const bIn = b.z >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: NEAR,
      });
    }
  }
  return out;
}

// Signed area of a projected 2D polygon (screen y-down). >0 => CCW on screen.
function signedArea2D(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

// ---- Polygon submission -------------------------------------------------
// A "poly" queued for drawing: { pts:[{x,y}], depth, fill, stroke }.
// Builds one poly from world-space verts. `cull`: backface cull (closed mesh).
function buildPoly(list, view, worldVerts, fillCol, cull, strokeCol = null, depthMode = 'avg', alpha = 1) {
  // to view space
  const vv = new Array(worldVerts.length);
  for (let i = 0; i < worldVerts.length; i++) vv[i] = view.toView(worldVerts[i]);
  const clipped = clipNear(vv);
  if (clipped.length < 3) return;
  // project
  const pts = new Array(clipped.length);
  let depth = 0;
  let maxDepth = -Infinity;
  for (let i = 0; i < clipped.length; i++) {
    pts[i] = projectView(clipped[i]);
    depth += clipped[i].z;
    if (clipped[i].z > maxDepth) maxDepth = clipped[i].z;
  }
  depth /= clipped.length;
  // Terrain sorts by its FARTHEST vertex: a large ground tile then always
  // paints before the small object standing on it (its centroid would often
  // be nearer than the object's trunk and wrongly overpaint it), while nearer
  // ridge tiles still correctly cover distant objects behind them.
  if (depthMode === 'max') depth = maxDepth;
  if (cull) {
    // CCW-from-outside meshes project to negative signed area when front-facing
    // (screen y is down). Cull the back faces.
    if (signedArea2D(pts) > 0) return;
  }
  const stroke = strokeCol || shade(fillCol, 0.62);
  list.push({ pts, depth, fill: rgbStr(fillCol), stroke: rgbStr(stroke), alpha });
}

// ---- Terrain ------------------------------------------------------------
// Lerp an rgb color `t` of the way toward white (for the pick highlight).
function toward(rgb, white, t) {
  return [
    rgb[0] + (white - rgb[0]) * t,
    rgb[1] + (white - rgb[1]) * t,
    rgb[2] + (white - rgb[2]) * t,
  ];
}

function collectTerrain(list, view, world, pickTile) {
  const tiles = world.tiles;
  const size = tiles.length;
  const pkx = pickTile ? pickTile.x : -1;
  const pkz = pickTile ? pickTile.z : -1;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[z][x];
      const [h00, h10, h11, h01] = t.h;
      // World-space corners (CCW when viewed from above).
      const p00 = { x: x, y: h00 * HEIGHT_SCALE, z: z };
      const p10 = { x: x + 1, y: h10 * HEIGHT_SCALE, z: z };
      const p11 = { x: x + 1, y: h11 * HEIGHT_SCALE, z: z + 1 };
      const p01 = { x: x, y: h01 * HEIGHT_SCALE, z: z + 1 };
      let base;
      if (t.flat) {
        base = ((x + z) & 1) ? GREEN_A : GREEN_B;   // checkerboard
      } else {
        // Slopes: blend the two greens then let the normal darken them.
        base = [
          (GREEN_A[0] + GREEN_B[0]) >> 1,
          (GREEN_A[1] + GREEN_B[1]) >> 1,
          (GREEN_A[2] + GREEN_B[2]) >> 1,
        ];
      }

      // Pick highlight: the tile under the crosshair reads brighter with a
      // lighter outline so the player can see what they are targeting.
      const picked = (x === pkx && z === pkz);
      if (picked) base = toward(base, 255, 0.35);
      const strokeShade = picked ? 1.15 : 0.62;

      // Triangulation: the game's pick/LOS sampling (world.js terrainYAt)
      // interpolates each tile as two triangles split along the h00->h11
      // diagonal. Coplanar tiles (h00 + h11 === h10 + h01) are a single plane,
      // so one quad is exact; non-planar (saddle) tiles must be drawn as the
      // SAME two triangles so the picture matches the pick ray exactly.
      const coplanar = (h00 + h11) === (h10 + h01);
      if (coplanar) {
        emitFace(list, view, [p00, p10, p11, p01], base, strokeShade);
      } else {
        // triangle 00-10-11 (u >= v) and triangle 00-11-01 (u < v)
        emitFace(list, view, [p00, p10, p11], base, strokeShade);
        emitFace(list, view, [p00, p11, p01], base, strokeShade);
      }
    }
  }
}

// Emit one terrain face (quad or triangle): flat-shade by its own normal, with
// an explicit stroke shade (brighter for the highlighted pick tile).
function emitFace(list, view, wv, base, strokeShade) {
  const bright = faceBrightness(wv, true);
  const fill = shade(base, bright);
  buildPoly(list, view, wv, fill, false, shade(fill, strokeShade), 'max');
}

// ---- Meshes -------------------------------------------------------------
// Each mesh is an array of faces; a face = { v: [[x,y,z],...], c: rgb }.
// Local space: origin at object base center, +Y up. rotY + translate applied
// when instancing. Winding is CCW from outside so backface culling works.

function boxFaces(cx, cy, cz, hx, hy, hz, col) {
  const x0 = cx - hx, x1 = cx + hx;
  const y0 = cy - hy, y1 = cy + hy;
  const z0 = cz - hz, z1 = cz + hz;
  const p = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], // 0-3 front (z0)
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], // 4-7 back  (z1)
  ];
  const f = (a, b, c, d) => ({ v: [p[a], p[b], p[c], p[d]], c: col });
  return [
    f(0, 3, 2, 1), // front  (-Z), CCW from outside (-Z looking toward +Z)
    f(5, 6, 7, 4), // back   (+Z)
    f(4, 7, 3, 0), // left   (-X)
    f(1, 2, 6, 5), // right  (+X)
    f(3, 7, 6, 2), // top    (+Y)
    f(4, 0, 1, 5), // bottom (-Y)
  ];
}

// Tapered box: separate bottom/top half-widths (for boulders, pedestals, robes).
function taperedFaces(y0, y1, hb, ht, col, cx = 0, cz = 0) {
  const b0 = [cx - hb, y0, cz - hb], b1 = [cx + hb, y0, cz - hb];
  const b2 = [cx + hb, y0, cz + hb], b3 = [cx - hb, y0, cz + hb];
  const t0 = [cx - ht, y1, cz - ht], t1 = [cx + ht, y1, cz - ht];
  const t2 = [cx + ht, y1, cz + ht], t3 = [cx - ht, y1, cz + ht];
  const f = (a, b, c, d) => ({ v: [a, b, c, d], c: col });
  return [
    f(b0, t0, t1, b1), // -Z
    f(b1, t1, t2, b2), // +X
    f(b2, t2, t3, b3), // +Z
    f(b3, t3, t0, b0), // -X
    f(t0, t3, t2, t1), // top
    f(b0, b1, b2, b3), // bottom
  ];
}

function coneFaces(y0, y1, radius, segments, col) {
  const faces = [];
  const apex = [0, y1, 0];
  const base = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [Math.cos(a) * radius, y0, Math.sin(a) * radius];
  });
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    faces.push({ v: [base[i], base[j], apex], c: col }); // side, CCW from outside
  }
  // Base cap wound to face DOWNWARD (-Y normal): reversed ring order. Without
  // it, a tree viewed from below (looking up-slope) is see-through / half-open
  // because the open cone bottom exposes the culled interior. Reversed order
  // gives the -Y normal so the disk survives backface culling from underneath
  // (and is correctly culled from above, where the foliage hides it anyway).
  // depthMode 'max': the wide disk's centroid is often nearer the camera than
  // the thin trunk below it, so a per-centroid sort would paint the disk OVER
  // the trunk when viewed from underneath. Sorting the disk by its farthest
  // vertex paints it first, so the trunk correctly overlaps it.
  faces.push({ v: [...base].reverse(), c: col, depthMode: 'max' });
  return faces;
}

// Tree — total height 3.0 world units (matches world.js OBJECT_HEIGHT.tree),
// evoking the original Sentinel's tall pines: a short trunk (~0.7) topped by a
// tall foliage cone (base radius ~0.5) that carries the rest of the silhouette.
function treeMesh() {
  const trunk = boxFaces(0, 0.35, 0, 0.09, 0.35, 0.09, COL.treeTrunk);
  // Cone base overlaps the trunk top slightly to hide the seam; apex at 3.0.
  const foliage = coneFaces(0.55, 3.0, 0.5, 8, COL.treeLeaf);
  return trunk.concat(foliage);
}

// Tapered octagonal prism (chamfered block) — much closer to the original
// Sentinel boulder silhouette than a plain box.
function octaPrismFaces(y0, y1, rb, rt, col) {
  const seg = 8;
  const off = Math.PI / seg; // rotate half a step so a flat face fronts +Z
  const ring = (y, r) => Array.from({ length: seg }, (_, i) => {
    const a = off + (i / seg) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const bot = ring(y0, rb);
  const top = ring(y1, rt);
  const faces = [];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    // Side winding bot[i]->bot[j]->top[j]->top[i] = outward normal. Verified
    // empirically in-game: eye-level views render the front walls with this
    // order (the paper-screen bug was ONLY the top cap's reversed winding).
    faces.push({ v: [bot[i], bot[j], top[j], top[i]], c: col }); // side, CCW out
  }
  faces.push({ v: [...top], c: col });            // top cap, +Y normal (seen from above)
  faces.push({ v: [...bot].reverse(), c: col });  // bottom cap, -Y normal (watertight)
  return faces;
}

function boulderMesh() {
  return octaPrismFaces(0, BOULDER_H, 0.44, 0.36, COL.boulder);
}

// Watertight tapered SQUARE prism built with the SAME proven winding as
// octaPrismFaces (side bot[i]->bot[j]->top[j]->top[i], top cap [...top], bottom
// cap [...bot].reverse()). seg=4 with a 45° angular offset places one flat wall
// squarely on +Z (forward) and axis-aligned edges. `wb`/`wt` are HALF-WIDTHS
// (edge-to-center), converted to the ring circumradius via *sqrt(2). Reusing the
// boulder's ground-truth winding keeps every wall + both caps facing outward.
function squarePrism(y0, y1, wb, wt, col) {
  const seg = 4;
  const off = Math.PI / 4; // 45°: flat faces front the axes, one faces +Z
  const rb = wb * Math.SQRT2, rt = wt * Math.SQRT2;
  const ring = (y, r) => Array.from({ length: seg }, (_, i) => {
    const a = off + (i / seg) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const bot = ring(y0, rb);
  const top = ring(y1, rt);
  const faces = [];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    faces.push({ v: [bot[i], bot[j], top[j], top[i]], c: col }); // side, CCW out
  }
  faces.push({ v: [...top], c: col });           // top cap, +Y normal
  faces.push({ v: [...bot].reverse(), c: col });  // bottom cap, -Y normal
  return faces;
}

// Deformed-box hexahedron: 8 vertices in the SAME index layout as boxFaces
// (p0..p3 the z0 quad, p4..p7 the z1 quad), so the proven boxFaces winding gives
// outward normals for any convex deformation. Used for the sentinel's hooked
// beak where the +Z (z1) quad juts forward and droops. `cols` picks a per-face
// colour: {front(-Z), back(+Z), left(-X), right(+X), top(+Y), bottom(-Y)}.
function hexFaces(p, cols) {
  const f = (a, b, c, d, col) => ({ v: [p[a], p[b], p[c], p[d]], c: col });
  return [
    f(0, 3, 2, 1, cols.front),  // -Z
    f(5, 6, 7, 4, cols.back),   // +Z
    f(4, 7, 3, 0, cols.left),   // -X
    f(1, 2, 6, 5, cols.right),  // +X
    f(3, 7, 6, 2, cols.top),    // +Y
    f(4, 0, 1, 5, cols.bottom), // -Y
  ];
}

// Humanoid — total height exactly 2.0 world units (= 2 * BOULDER_H). Restyled to
// match ref-robot.png, top to bottom: (a) trapezoid "lampshade" head, wider at
// top, floating above a small gap; (b) broad shoulder slab spanning wide like
// shallow angled wings (wide in X, shallow in Z); (c) chest as a downward-
// pointing tapering wedge (inverted triangle) narrowing to the waist; (d) lower
// body = one column flaring slightly toward the ground (no separate legs). Every
// part keeps half-width <= 0.30 so it stays inside the LOS cylinder. All solid
// parts are watertight (squarePrism caps + boxFaces are closed).
function humanoidMesh(bodyCol) {
  const faces = [];
  // (d) lower column: single column, flares slightly toward the ground (0.0..0.9)
  faces.push(...squarePrism(0.0, 0.9, 0.20, 0.13, bodyCol));
  // (c) chest wedge: narrow waist -> wide shoulders, inverted triangle (0.9..1.5)
  faces.push(...squarePrism(0.9, 1.5, 0.13, 0.28, bodyCol));
  // (b) broad shoulder slab: wide in X (0.30) like shallow wings, shallow in Z
  faces.push(...boxFaces(0, 1.575, 0, 0.30, 0.075, 0.16, bodyCol));
  // gap (1.65..1.72): the head floats above the shoulders
  // (a) trapezoid "lampshade" head: wider at top than bottom (1.72..2.0)
  faces.push(...squarePrism(1.72, 2.0, 0.12, 0.20, bodyCol));
  return faces;
}

function robotMesh() { return humanoidMesh(COL.robot); }

function meanieMesh() {
  const faces = humanoidMesh(COL.meanie);
  // "wings" — two angled quads off the broad shoulders (kept, per spec).
  const wing = COL.meanie;
  faces.push({ v: [[0.28, 1.62, 0], [0.60, 1.80, 0], [0.60, 1.52, 0], [0.28, 1.40, 0]], c: wing });
  faces.push({ v: [[-0.28, 1.40, 0], [-0.60, 1.52, 0], [-0.60, 1.80, 0], [-0.28, 1.62, 0]], c: wing });
  return faces;
}

// Sentinel — restyled to match ref-sentinel.png: a slim robe column tapering
// UPWARD (base ~0.26 half-width) topped by the iconic head whose crown bends
// forward into a hooked BEAK. The beak points in the facing direction (+Z local
// = forward; verified: math3d yaw 0 looks +Z, game angleTo = atan2(dx,dz), and a
// local +Z vector maps unchanged to the world facing direction at yaw 0). It
// replaces the old face-plate as the facing indicator: it juts ~0.3 forward,
// droops slightly, and carries a dark eye (tip front) and dark underside so the
// direction reads at distance. ~2.2 tall. Pale palette. Everything is a
// watertight solid (squarePrism caps, boxFaces, and the closed beak hexahedron).
function sentinelMesh() {
  const faces = [];
  const FACE_DARK = [0x16, 0x18, 0x2E]; // dark navy
  const EYE_DARK = [0x06, 0x07, 0x12];  // near-black
  // Slim robe column, tapering upward (0.0..1.75).
  faces.push(...squarePrism(0, 1.75, 0.26, 0.16, COL.sentinel));
  // Small shoulder / wing bump.
  faces.push(...boxFaces(0, 1.66, 0, 0.22, 0.06, 0.14, COL.sentinelHood));
  // Head block (1.81..2.11).
  faces.push(...boxFaces(0, 1.96, 0, 0.15, 0.15, 0.15, COL.sentinelHood));
  // Hooked beak: a deformed box whose +Z (forward) quad juts to z=0.46 and droops
  // (tip lower than the root), so the crown appears to bend forward. Root quad
  // (z=0.12) is buried in the head; tip front quad = dark "eye"; underside dark.
  const beak = [
    [-0.10, 1.92, 0.12], // p0  root, z0
    [ 0.10, 1.92, 0.12], // p1
    [ 0.10, 2.18, 0.12], // p2
    [-0.10, 2.18, 0.12], // p3
    [-0.05, 1.84, 0.46], // p4  tip, z1
    [ 0.05, 1.84, 0.46], // p5
    [ 0.05, 2.00, 0.46], // p6
    [-0.05, 2.00, 0.46], // p7
  ];
  faces.push(...hexFaces(beak, {
    front: COL.sentinel,     // -Z root (hidden inside the head)
    back: EYE_DARK,          // +Z tip front — dark eye, reads as the facing
    left: COL.sentinelHood,
    right: COL.sentinelHood,
    top: COL.sentinel,
    bottom: FACE_DARK,       // dark drooping underside
  }));
  return faces;
}

function pedestalMesh() {
  // Total height exactly 1.0 to match world.js OBJECT_HEIGHT.pedestal, so the
  // sentinel stacked at pedestal-top (base + 1.0) reads as standing ON it. The
  // original pedestal is a tall tapered block: model it as a two-tier truncated
  // pyramid using the proven squarePrism winding, so every wall + both caps of
  // each tier face outward and it stays watertight from below (it sits on the
  // summit and is usually seen from underneath).
  const lower = squarePrism(0, 0.55, 0.48, 0.38, COL.pedestal);  // wide base tier
  const upper = squarePrism(0.55, 1.0, 0.34, 0.28, COL.pedestal); // narrower top tier
  return lower.concat(upper);
}

export const MESHES = {
  tree: treeMesh(),
  boulder: boulderMesh(),
  robot: robotMesh(),
  meanie: meanieMesh(),
  sentinel: sentinelMesh(),
  pedestal: pedestalMesh(),
};

// ---- Objects ------------------------------------------------------------
// Map a `dissolve` value in [0,1] to a draw alpha. undefined / >= 1 => solid
// (alpha 1). Values in (0,1) step to quarters for a cheap retro scanline-dither
// look. Callers must skip objects whose dissolve <= 0 (fully gone) themselves.
function dissolveAlpha(d) {
  if (d === undefined || d === null || d >= 1) return 1;
  return Math.ceil(d * 4) / 4;
}

// Emit one world object (or ghost effect) into the poly list. Reads o.dissolve
// (undefined = solid); objects with dissolve <= 0 are skipped by the caller.
function emitObject(list, view, world, o) {
  const mesh = MESHES[o.type];
  if (!mesh) return;
  const alpha = dissolveAlpha(o.dissolve);
  // Base surface Y for this object: world.js assigns each object its
  // resting world-Y in o.y (stack-aware). Fall back to terrain height.
  let baseY;
  if (typeof o.y === 'number') {
    baseY = o.y;
  } else if (typeof world.surfaceY === 'function') {
    baseY = world.surfaceY(o.x, o.z);
  } else {
    const t = world.tiles[o.z][o.x];
    const centerH = (t.h[0] + t.h[1] + t.h[2] + t.h[3]) / 4;
    baseY = centerH * HEIGHT_SCALE + (o.stackIndex || 0) * BOULDER_H;
  }
  const px = o.x + 0.5, pz = o.z + 0.5;
  const yaw = o.rotY ?? o.facing ?? 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  for (const face of mesh) {
    const wv = new Array(face.v.length);
    const bright = localFaceBrightness(face.v, yaw);
    for (let i = 0; i < face.v.length; i++) {
      const lv = face.v[i];
      // rotate about Y, then translate to world.
      const rx = cy * lv[0] + sy * lv[2];
      const rz = -sy * lv[0] + cy * lv[2];
      wv[i] = { x: px + rx, y: baseY + lv[1], z: pz + rz };
    }
    buildPoly(list, view, wv, shade(face.c, bright), true, null, face.depthMode ?? 'avg', alpha);
  }
}

function collectObjects(list, view, world, skipObjectId = null) {
  const objs = world.objects || [];
  for (const o of objs) {
    // First-person: never draw the shell the player is looking out of.
    if (skipObjectId !== null && o.id === skipObjectId) continue;
    // Player-created objects may materialize 0->1; fully-gone objects vanish.
    if (o.dissolve !== undefined && o.dissolve <= 0) continue;
    emitObject(list, view, world, o);
  }
  // Ghost effects: objects being absorbed, fading 1->0. Rendered like objects
  // but never affect anything else; skipObjectId does not apply to them.
  const effects = world.effects || [];
  for (const o of effects) {
    if (o.dissolve !== undefined && o.dissolve <= 0) continue;
    emitObject(list, view, world, o);
  }
}

// Brightness of a mesh face in local space (normal rotated by yaw about Y).
function localFaceBrightness(v, yaw) {
  const a = { x: v[0][0], y: v[0][1], z: v[0][2] };
  const b = { x: v[1][0], y: v[1][1], z: v[1][2] };
  const c = { x: v[2][0], y: v[2][1], z: v[2][2] };
  let n = vnorm(vcross(vsub(b, a), vsub(c, a)));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const n2 = { x: cy * n.x + sy * n.z, y: n.y, z: -sy * n.x + cy * n.z };
  const d = Math.max(0, vdot(n2, LIGHT));
  return AMBIENT + DIFFUSE * d;
}

// ---- Crosshair ----------------------------------------------------------
function drawCrosshair(ctx, cx = CX, cy = CY) {
  const x = Math.round(cx), y = Math.round(cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 0.5); ctx.lineTo(x - 2, y + 0.5);
  ctx.moveTo(x + 2, y + 0.5); ctx.lineTo(x + 7, y + 0.5);
  ctx.moveTo(x + 0.5, y - 7); ctx.lineTo(x + 0.5, y - 2);
  ctx.moveTo(x + 0.5, y + 2); ctx.lineTo(x + 0.5, y + 7);
  ctx.stroke();
}

// ---- Main entry ---------------------------------------------------------
export function render(ctx, world, camera, uiState = {}) {
  drawSky(ctx);
  const view = makeView(camera);

  const list = [];
  collectTerrain(list, view, world, uiState.pickTile || null);
  collectObjects(list, view, world, uiState.skipObjectId ?? null);

  // Painter's algorithm: draw far polygons first.
  list.sort((a, b) => b.depth - a.depth);

  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  for (const poly of list) {
    const pts = poly.pts;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (poly.alpha !== 1) ctx.globalAlpha = poly.alpha;
    ctx.fillStyle = poly.fill;
    ctx.fill();
    ctx.strokeStyle = poly.stroke;   // 1px darker outline for the vector look
    ctx.stroke();
    if (poly.alpha !== 1) ctx.globalAlpha = 1;
  }

  if (uiState.crosshair) {
    drawCrosshair(ctx, uiState.cursor?.x ?? CX, uiState.cursor?.y ?? CY);
  }
}
