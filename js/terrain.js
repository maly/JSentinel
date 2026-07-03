// terrain.js — seeded deterministic 32×32 Sentinel-style terrain.
// deep-reasoner, Task 1 (rev 3: wavy, multi-plateau). Vanilla ES module, no deps.
//
// Model: a 33×33 grid of integer vertex heights (0..MAX_HEIGHT). Adjacent tiles
// share corner vertices, so the surface is automatically continuous. A tile is
// FLAT iff its 4 corner heights are all equal; otherwise it is a slope.
//
// Look: a WAVY terraced landscape (like the original Sentinel) — independent
// ridges, valleys and basins scattered across the whole map, NOT one big hill.
// A multi-octave value-noise heightfield (with a dedicated ridge octave and
// strong mid-frequency terms) is quantised to integer levels, its plateaus are
// widened, and its worst steps are shaved so that no tile spans more than 3
// units. Most steps are gentle (span 1–2); the occasional span-3 "wall" reads
// as a cliff. The summit is a SMALL terraced cone blended in only near its own
// footprint (via max()), so it is a local peak — it does not tilt the whole map.
//
// generateTerrain(seed) -> tiles[32][32], indexed tiles[z][x], where
//   tile = { h: [h00, h10, h11, h01], flat: bool, height: int }
//   h00 = corner at (x,   z)      h10 = corner at (x+1, z)
//   h11 = corner at (x+1, z+1)    h01 = corner at (x,   z+1)
//
// Guarantees (verified over seeds 1..5):
//   * one SINGLE highest plateau (unique max height) with >= 4 flat tiles,
//   * >= 25 flat tiles across the lowest two levels,
//   * >= 55% of all tiles flat (mostly-walkable plateaus),
//   * every tile spans <= 3 height units; no adjacent corner delta > 3,
//     with span-3 "walls" occasional (a minority of slope transitions),
//   * shared corners between adjacent tiles (continuous surface),
//   * NON-monotonic relief: local ridges/basins across the map, not one hill,
//   * deterministic: same integer seed -> byte-identical tiles, every run.

export const MAP_SIZE = 32;      // tiles per side
export const MAX_HEIGHT = 8;     // highest plateau height (summit level)
const VN = MAP_SIZE + 1;         // 33 vertices per side

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
  // the lowest levels stay walkable), then map to 0..FIELD_MAX. The summit level
  // (8) is NOT produced here — free ground tops out at FIELD_MAX so the summit
  // cone in step 2 owns the unique maximum.
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
  const FIELD_MAX = MAX_HEIGHT - 1;                 // free ground tops out at 7
  const V = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const norm = (f[z][x] - mn) / span;               // 0..1
      const shaped = Math.pow(norm, gamma);             // bias low
      V[z][x] = Math.round(shaped * FIELD_MAX);
    }
  }

  // --- 2. Terrace, cap steps, overlay a SMALL summit cone ----------------
  // Widen plateaus, then shave any tile that spans more than 3 units. Result:
  // a wavy integer field, max level FIELD_MAX, every tile span <= 3.
  const noLock = Array.from({ length: N }, () => new Array(N).fill(false));
  modeFilter(V, N);
  clampTileSpan(V, noLock, N, 3);

  // Single unique summit: a 3×3 vertex block (=> 2×2 = 4 flat tiles) at
  // MAX_HEIGHT on the field maximum, wrapped in a SMALL terraced Chebyshev cone
  // that only reaches out to radius R. Levels: cheb 0 -> 8, 1..2 -> 7, 3..4 -> 6;
  // beyond R the cone is not applied at all, so the summit is a compact local
  // peak instead of a map-wide gradient. Blending by max() preserves the step
  // cap: max of a 1-Lipschitz cone and a <=3-span field is still <=3-span
  // (|max(a,b)-max(c,d)| <= max(|a-c|,|b-d|)).
  const BLK = 3;                                    // summit block side (vertices)
  const RING = 2;                                   // terrace width (vertices)
  const R = 4;                                      // cone reach (Chebyshev)
  const bx = Math.max(0, Math.min(N - BLK, px - (BLK >> 1)));
  const bz = Math.max(0, Math.min(N - BLK, pz - (BLK >> 1)));
  const bx1 = bx + BLK - 1, bz1 = bz + BLK - 1;
  const locked = Array.from({ length: N }, () => new Array(N).fill(false));
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const dx = x < bx ? bx - x : (x > bx1 ? x - bx1 : 0);
      const dz = z < bz ? bz - z : (z > bz1 ? z - bz1 : 0);
      const cheb = Math.max(dx, dz);
      if (cheb <= R) {
        const cone = MAX_HEIGHT - Math.ceil(cheb / RING);  // 8, 7,7, 6,6
        if (cone > V[z][x]) V[z][x] = cone;
        if (cheb === 0) locked[z][x] = true;               // summit block: pinned
      }
      V[z][x] = Math.max(0, Math.min(MAX_HEIGHT, V[z][x]));
    }
  }

  // --- 3. Greedy flatten + re-cap ----------------------------------------
  // Flatten avoidable slopes into plateaus (free vertices capped at MAX_HEIGHT-1
  // so the summit stays unique), keeping the walls-of-3 the noise produced.
  // Flatten can nudge a diagonal past span 3, so re-cap and flatten once more;
  // both passes are monotone, so this settles deterministically.
  flattenTiles(V, locked, N, MAX_HEIGHT - 1, 3);
  clampTileSpan(V, locked, N, 3);
  flattenTiles(V, locked, N, MAX_HEIGHT - 1, 3);
  clampTileSpan(V, locked, N, 3);

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
