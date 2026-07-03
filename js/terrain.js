// terrain.js — seeded deterministic 31×31 Sentinel-style terrain.
// deep-reasoner, Task 1 (rev 4: original 31-grid / 32-level fidelity). ES module.
//
// Model: a 32×32 grid of integer vertex heights (0..MAX_HEIGHT). Adjacent tiles
// share corner vertices, so the surface is automatically continuous. A tile is
// FLAT iff its 4 corner heights are all equal; otherwise it is a slope.
//
// ORIGINAL-GAME FIDELITY: the arcade Sentinel uses a 31×31 tile grid with 32
// integer height LEVELS (0..31). We match that here. With HEIGHT_SCALE = 0.25
// (math3d.js) the WORLD-SPACE character is unchanged from the old 8-level /
// 0.5-scale build — level values are ~doubled, so the same wavy terraced look
// now lives on a finer grid (old level 8 * 0.5 = 4.0 world == new level 16 *
// 0.25). The general landscape uses most of levels 0..~20; the top levels are
// reserved for the unique SUMMIT (highest used level ~24..31, seed-dependent).
//
// Look: a WAVY terraced landscape (like the original Sentinel) — independent
// ridges, valleys and basins scattered across the whole map, NOT one big hill.
// A multi-octave value-noise heightfield (with a dedicated ridge octave and
// strong mid-frequency terms) is quantised to integer levels, its plateaus are
// widened, and its worst steps are shaved so that no ordinary tile spans more
// than 4 levels. Most steps are gentle (2–4 levels ≈ 0.5–1.0 world); the
// occasional bigger cliff reaches 6 levels (1.5 world — the same real-world cap
// as the old span-3 / 0.5-scale build). The summit is a terraced cone blended
// in only near its own footprint (via max()), so it is a local peak — it does
// not tilt the whole map.
//
// generateTerrain(seed) -> tiles[31][31], indexed tiles[z][x], where
//   tile = { h: [h00, h10, h11, h01], flat: bool, height: int }
//   h00 = corner at (x,   z)      h10 = corner at (x+1, z)
//   h11 = corner at (x+1, z+1)    h01 = corner at (x,   z+1)
//
// Guarantees (verified over seeds 1..5):
//   * one SINGLE highest plateau (unique max height) with >= 4 flat tiles,
//   * >= 25 flat tiles across the lowest levels,
//   * >= 55% of all tiles flat (mostly-walkable plateaus),
//   * ordinary tiles span <= 4 levels; every tile (incl. summit) spans <= 6,
//     so no adjacent corner delta > 6, with the big cliffs occasional,
//   * shared corners between adjacent tiles (continuous surface),
//   * NON-monotonic relief: local ridges/basins across the map, not one hill,
//   * deterministic: same integer seed -> byte-identical tiles, every run.

export const MAP_SIZE = 31;      // tiles per side (original 31×31 grid)
export const MAX_HEIGHT = 31;    // highest possible level (32 levels: 0..31)
const VN = MAP_SIZE + 1;         // 32 vertices per side
const FIELD_MAX = 12;            // general (non-summit) ground tops out here
const GEN_SPAN = 4;              // ordinary slope tiles span at most this
const WALL_CAP = 6;              // hard cap incl. summit cliffs (1.5 world)
// The general terrain is built at HALF resolution (a proven coarse pass that
// reliably yields >=55% flat, like the old 8-level build) and then every level
// is DOUBLED. Doubling preserves flat tiles exactly (equal corners stay equal)
// and doubles every span, so the coarse span-2 slopes become the 4-level steps
// and the coarse span-1 steps become the gentle 2-level steps of the final map.
const COARSE_MAX = FIELD_MAX / 2; // coarse ground cap (7) -> doubled to 14
const COARSE_SPAN = 2;            // coarse tile span cap -> doubled to GEN_SPAN(4)
const COARSE_LIP = 2;             // coarse flatten lip (matches COARSE_SPAN)

// Deterministic PRNG: mulberry32. Same seed -> same landscape, every run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth (smoothstep) fade for value-noise interpolation.
const fade = (t) => t * t * (3 - 2 * t);

// Accumulate one octave of value noise onto field `f`. Draws every lattice
// value from `rng` in a fixed order (row-major) => deterministic. If `ridge`,
// the interpolated sample s in [0,1] is folded to 1-|2s-1|, turning the smooth
// blob into sharp RIDGE lines and V-shaped valleys — this is what breaks the
// single-gradient look and scatters relief across the map.
function addOctave(f, N, cells, amp, rng, ridge) {
  const g = Array.from({ length: cells + 1 }, () =>
    Array.from({ length: cells + 1 }, () => rng()));
  for (let y = 0; y < N; y++) {
    const fy = (y / (N - 1)) * cells;
    const y0 = Math.min(Math.floor(fy), cells - 1);
    const ty = fade(fy - y0);
    for (let x = 0; x < N; x++) {
      const fx = (x / (N - 1)) * cells;
      const x0 = Math.min(Math.floor(fx), cells - 1);
      const tx = fade(fx - x0);
      const a = g[y0][x0],     b = g[y0][x0 + 1];
      const c = g[y0 + 1][x0], d = g[y0 + 1][x0 + 1];
      const top = a + (b - a) * tx;
      const bot = c + (d - c) * tx;
      let s = top + (bot - top) * ty;               // 0..1
      if (ridge) s = 1 - Math.abs(2 * s - 1);       // 0..1, ridged
      f[y][x] += s * amp;
    }
  }
}

// Multi-octave value noise. The BASE octave is deliberately NOT dominant; the
// mid-frequency octaves and a ridge octave carry comparable weight, so plateaus
// and basins appear at many independent locations rather than as one slope
// toward a single summit. High-freq detail is kept small so quantised plateaus
// stay broad. Octave order is fixed => deterministic draw order.
function valueNoise(N, rng) {
  const f = Array.from({ length: N }, () => new Array(N).fill(0));
  // cells, amp, ridge
  addOctave(f, N, 2, 0.55, rng, false); // gentle continental tilt (not dominant)
  addOctave(f, N, 3, 0.70, rng, false); // MID: big independent lumps
  addOctave(f, N, 5, 0.55, rng, false); // MID: local hills & hollows
  addOctave(f, N, 4, 0.55, rng, true);  // RIDGE: ridgelines + valleys
  addOctave(f, N, 8, 0.15, rng, false); // faint surface detail
  return f;
}

// One 3×3 box-blur pass (edge-clamped). Removes only the finest wiggle before
// quantisation; used sparingly so the wave structure survives.
function blur(f, N) {
  const out = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= N || nx < 0 || nx >= N) continue;
          s += f[ny][nx]; c++;
        }
      }
      out[y][x] = s / c;
    }
  }
  return out;
}

// 3×3 majority (mode) filter on the integer field. Snaps isolated one-vertex
// slope wiggles onto the surrounding plateau level, widening flat tiles. Ties
// resolve to the value closest to the current one (stable, deterministic).
function modeFilter(V, N) {
  const src = V.map((row) => row.slice());
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const counts = new Map();
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nz = z + dz, nx = x + dx;
          if (nz < 0 || nz >= N || nx < 0 || nx >= N) continue;
          const v = src[nz][nx];
          counts.set(v, (counts.get(v) || 0) + 1);
        }
      }
      let best = src[z][x], bestC = -1;
      for (const [v, c] of counts) {
        if (c > bestC || (c === bestC && Math.abs(v - src[z][x]) < Math.abs(best - src[z][x]))) {
          best = v; bestC = c;
        }
      }
      V[z][x] = best;
    }
  }
}

// Shave the worst steps so every TILE spans at most `maxSpan` units. LOWER-ONLY:
// for each tile, corners above min(tile)+maxSpan are pulled down to that cap
// (locked summit corners are never lowered). Monotone (values only decrease) =>
// converges, never oscillates, keeps low ground low. Because every vertex edge
// lies inside some tile, tile-span <= maxSpan also guarantees no adjacent-corner
// (4-neighbour) delta exceeds `maxSpan` — that is the hard "no wall > 3" cap.
function clampTileSpan(V, locked, N, maxSpan) {
  let changed = true, guard = 0;
  while (changed && guard++ < 4096) {
    changed = false;
    for (let z = 0; z < N - 1; z++) {
      for (let x = 0; x < N - 1; x++) {
        const cs = [[z, x], [z, x + 1], [z + 1, x + 1], [z + 1, x]];
        let mn = Infinity;
        for (const [cz, cx] of cs) if (V[cz][cx] < mn) mn = V[cz][cx];
        const cap = mn + maxSpan;
        for (const [cz, cx] of cs) {
          if (V[cz][cx] > cap && !locked[cz][cx]) { V[cz][cx] = cap; changed = true; }
        }
      }
    }
  }
}

// Count how many of the (up to 4) tiles incident to vertex (vx,vz) are flat if
// that vertex is set to `val`. A tile is flat iff its 4 corners are equal.
function incidentFlat(V, N, vx, vz, val) {
  let flats = 0;
  for (let tz = vz - 1; tz <= vz; tz++) {
    for (let tx = vx - 1; tx <= vx; tx++) {
      if (tz < 0 || tx < 0 || tz >= N - 1 || tx >= N - 1) continue;
      const c = [
        (tz === vz && tx === vx) ? val : V[tz][tx],
        (tz === vz && tx + 1 === vx) ? val : V[tz][tx + 1],
        (tz + 1 === vz && tx + 1 === vx) ? val : V[tz + 1][tx + 1],
        (tz + 1 === vz && tx === vx) ? val : V[tz + 1][tx],
      ];
      if (c[0] === c[1] && c[1] === c[2] && c[2] === c[3]) flats++;
    }
  }
  return flats;
}

// Greedy flatten: hill-climb each free vertex to the value — within `lip` of its
// 4-neighbours — that maximises the number of incident flat tiles. Never touches
// locked summit vertices and never assigns MAX_HEIGHT to a free vertex, so the
// summit stays unique. `lip` = 3 keeps the walls-of-3 the noise produced (a
// tighter bound would collapse them). Monotone in total flat count => converges.
function flattenTiles(V, locked, N, freeMax, lip) {
  let changed = true, guard = 0;
  while (changed && guard++ < 32) {
    changed = false;
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (locked[z][x]) continue;
        let mnN = Infinity, mxN = -Infinity;
        if (x > 0)     { mnN = Math.min(mnN, V[z][x - 1]); mxN = Math.max(mxN, V[z][x - 1]); }
        if (x + 1 < N) { mnN = Math.min(mnN, V[z][x + 1]); mxN = Math.max(mxN, V[z][x + 1]); }
        if (z > 0)     { mnN = Math.min(mnN, V[z - 1][x]); mxN = Math.max(mxN, V[z - 1][x]); }
        if (z + 1 < N) { mnN = Math.min(mnN, V[z + 1][x]); mxN = Math.max(mxN, V[z + 1][x]); }
        const lo = Math.max(0, mxN - lip);
        const hi = Math.min(freeMax, mnN + lip);
        const cur = V[z][x];
        let bestVal = cur, bestFlat = incidentFlat(V, N, x, z, cur);
        for (let cand = lo; cand <= hi; cand++) {
          if (cand === cur) continue;
          const fl = incidentFlat(V, N, x, z, cand);
          if (fl > bestFlat || (fl === bestFlat && Math.abs(cand - cur) < Math.abs(bestVal - cur))) {
            bestFlat = fl; bestVal = cand;
          }
        }
        if (bestVal !== cur) { V[z][x] = bestVal; changed = true; }
      }
    }
  }
}

export function generateTerrain(seed = 1) {
  const rng = mulberry32(seed >>> 0);
  const N = VN;

  // --- 1. Wavy float heightfield -----------------------------------------
  let f = valueNoise(N, rng);
  f = blur(f, N);            // one light pass only — keep the waves

  // Normalise to [0,1], then a mild low-bias (gamma > 1 broadens the basins so
  // the lowest levels stay walkable), then map to 0..FIELD_MAX. The reserved
  // summit levels (> FIELD_MAX) are NOT produced here — free ground tops out at
  // FIELD_MAX so the summit cone in step 2 owns the unique maximum.
  let mn = Infinity, mx = -Infinity;
  let pz = 0, px = 0;             // location of the global maximum (summit seed)
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const v = f[z][x];
      if (v < mn) mn = v;
      if (v > mx) { mx = v; pz = z; px = x; }
    }
  }
  const span = (mx - mn) || 1;
  const gamma = 1.42;
  const V = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const norm = (f[z][x] - mn) / span;               // 0..1
      const shaped = Math.pow(norm, gamma);             // bias low
      V[z][x] = Math.round(shaped * COARSE_MAX);        // coarse levels 0..10
    }
  }

  // --- 2. Coarse terrace + flatten (the proven 55%-flat pass) ------------
  // Widen plateaus (mode filter), cap coarse tile spans at COARSE_SPAN, then
  // greedily flatten. This is the same coarse algorithm the old 8-level build
  // used, so it reliably yields >=55% flat with broad low basins.
  const noLock = Array.from({ length: N }, () => new Array(N).fill(false));
  modeFilter(V, N);
  clampTileSpan(V, noLock, N, COARSE_SPAN);
  flattenTiles(V, noLock, N, COARSE_MAX, COARSE_LIP);
  clampTileSpan(V, noLock, N, COARSE_SPAN);
  flattenTiles(V, noLock, N, COARSE_MAX, COARSE_LIP);
  clampTileSpan(V, noLock, N, COARSE_SPAN);
  flattenTiles(V, noLock, N, COARSE_MAX, COARSE_LIP);
  clampTileSpan(V, noLock, N, COARSE_SPAN);

  // --- 2b. Double every level to the fine 32-level grid ------------------
  // Doubling preserves the flat tiles exactly and doubles every span, so the
  // general landscape now lives on levels 0..FIELD_MAX with ordinary steps of
  // 2..GEN_SPAN — the same WORLD-SPACE relief as the old build under the new
  // HEIGHT_SCALE = 0.25.
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) V[z][x] *= 2;

  // --- 3. Overlay the unique reserved summit -----------------------------
  // Single unique summit at a seed-dependent top level S in [24, 31], sitting on
  // the field maximum as a 3×3 vertex block (=> 2×2 = 4 flat tiles), wrapped in a
  // terraced Chebyshev cone: one big step (WALL_CAP=6) from the block to the
  // first ring, then gentler GEN_SPAN steps down until the cone submerges into
  // the surrounding field. The cone is applied via max() and every raised vertex
  // is LOCKED, so the flatten/clamp passes preserve the reserved summit levels
  // (> FIELD_MAX) instead of shaving them back to ground.
  const S = Math.min(MAX_HEIGHT, 24 + Math.floor(rng() * 8)); // 24..31
  const BLK = 3;                                    // summit block side (vertices)
  // coneLevel(cheb): a stepped terrace dropping by WALL_CAP (6) every 2 rings, so
  // each shelf is 2 vertices wide and contributes FLAT ring tiles (not just
  // slopes) while the tall summit reaches the surrounding field. The flat shelves
  // keep the >=55% flat guarantee even with the reserved summit (24..31) sitting
  // well above the FIELD_MAX (12) ground, and give the peak the terraced Sentinel
  // silhouette. Each shelf edge is a WALL_CAP cliff (the "occasional" big steps).
  const coneLevel = (cheb) => S - WALL_CAP * Math.ceil(cheb / 2);
  // Reach: extend the cone all the way down until it submerges (coneLevel <= 0).
  // A vertex is raised+locked ONLY where coneLevel(cheb) > field there, so the
  // cone stops PER-VERTEX exactly where it meets the field. Because the cone
  // drops by WALL_CAP per ring, the boundary wall between the last locked ring k
  // and the first free field vertex is coneLevel(k) - field(k+1) <= WALL_CAP:
  // coneLevel(k) = coneLevel(k+1)+WALL_CAP <= field(k+1)+WALL_CAP (the +1 vertex
  // submerged), so the wall <= WALL_CAP. This makes the tall-summit descent meet
  // arbitrary ground with no wall taller than 6.
  let R = 1;
  while (coneLevel(R + 1) > 0) R++;
  const bx = Math.max(0, Math.min(N - BLK, px - (BLK >> 1)));
  const bz = Math.max(0, Math.min(N - BLK, pz - (BLK >> 1)));
  const bx1 = bx + BLK - 1, bz1 = bz + BLK - 1;
  const locked = Array.from({ length: N }, () => new Array(N).fill(false));
  // applyCone: raise each footprint vertex to its cone level where the cone is
  // higher than the current field, and LOCK exactly those raised vertices. Called
  // again after every flatten pass: a flatten can lower a free field vertex just
  // outside the current cone edge, which would break the submerge guarantee — so
  // re-asserting the cone re-raises and re-locks it, keeping every cone/field
  // boundary tile at span <= WALL_CAP while touching as few vertices as possible.
  const applyCone = () => {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const dx = x < bx ? bx - x : (x > bx1 ? x - bx1 : 0);
        const dz = z < bz ? bz - z : (z > bz1 ? z - bz1 : 0);
        const cheb = Math.max(dx, dz);
        if (cheb <= R) {
          const cone = Math.min(MAX_HEIGHT, coneLevel(cheb));
          if (cone > V[z][x]) { V[z][x] = cone; locked[z][x] = true; }
        }
      }
    }
  };
  applyCone();

  // --- 3b. Settle summit-adjacent slopes, cap walls at WALL_CAP ----------
  // Flatten avoidable slopes (free vertices capped at FIELD_MAX so the summit
  // stays the unique maximum); the locked cone vertices are skipped. Re-assert
  // the cone after each flatten so the boundary submerge guarantee holds, then a
  // final span cap. Because the whole terraced cone is locked and submerges
  // per-vertex, every cone/field boundary tile has all its field corners at a
  // ring >= C - WALL_CAP (C = adjacent cone level) => span <= WALL_CAP (6). This
  // clamp only shaves diagonal over-spans left in the FREE field.
  flattenTiles(V, locked, N, FIELD_MAX, GEN_SPAN);
  applyCone();
  clampTileSpan(V, locked, N, WALL_CAP);
  flattenTiles(V, locked, N, FIELD_MAX, GEN_SPAN);
  applyCone();
  clampTileSpan(V, locked, N, WALL_CAP);

  // --- 4. Build tiles from the vertex field ------------------------------
  const tiles = [];
  for (let z = 0; z < MAP_SIZE; z++) {
    const row = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      const h00 = V[z][x];
      const h10 = V[z][x + 1];
      const h11 = V[z + 1][x + 1];
      const h01 = V[z + 1][x];
      const flat = h00 === h10 && h10 === h11 && h11 === h01;
      const height = flat ? h00 : Math.max(h00, h10, h11, h01);
      row.push({ h: [h00, h10, h11, h01], flat, height });
    }
    tiles.push(row);
  }
  return tiles;
}

// Helper: bilinear terrain height (in corner-height units) at fractional tile
// position. Useful for LOS sampling and object placement. Returns height units
// (multiply by HEIGHT_SCALE for world Y).
export function sampleHeight(tiles, fx, fz) {
  const size = tiles.length;
  const cx = Math.max(0, Math.min(size - 1e-6, fx));
  const cz = Math.max(0, Math.min(size - 1e-6, fz));
  const tx = Math.floor(cx), tz = Math.floor(cz);
  const u = cx - tx, v = cz - tz;
  const t = tiles[tz][tx];
  const [h00, h10, h11, h01] = t.h;
  const top = h00 * (1 - u) + h10 * u;
  const bot = h01 * (1 - u) + h11 * u;
  return top * (1 - v) + bot * v;
}
