// levels.js — bijective mapping between level numbers (0000-9999) and
// 8-digit landscape codes, in the spirit of the original's secret codes.
//
// Implementation: a balanced Feistel permutation over Z_10000 x Z_10000,
// i.e. over the whole 8-digit code space [0, 10^8). Fixed round keys make it
// deterministic; being a permutation makes it injective by construction
// (no two levels can share a code); the mixing function makes consecutive
// levels map to unrelated codes. And because a permutation is invertible,
// validating a code is just running the network backwards: a code is valid
// exactly when its preimage is < 10000.

const HALF = 10000;
const ROUND_KEYS = [0x3a1c9d, 0x7f4b21, 0x1d6e35, 0x59c8a7, 0x2b90f3, 0x6d47e9];

// Integer mixing PRF: half-domain value + round key -> half-domain value.
function mix(x, key) {
  let h = (Math.imul(x + 1, 2654435761) + key) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;   // XOR yields SIGNED int32 — force unsigned
  h = (Math.imul(h, 1103515245) + 12345) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h % HALF;
}

// Level (0-9999) -> 8-digit code (0 - 99 999 999).
export function levelToSeed(level) {
  let a = Math.floor(level / HALF) % HALF; // 0 for all valid levels
  let b = level % HALF;
  for (const key of ROUND_KEYS) {
    const next = (a + mix(b, key)) % HALF;
    a = b;
    b = next;
  }
  return a * HALF + b;
}

// 8-digit code -> level, or null when no level maps to this code.
export function seedToLevel(code) {
  if (!Number.isInteger(code) || code < 0 || code >= HALF * HALF) return null;
  let a = Math.floor(code / HALF);
  let b = code % HALF;
  for (let i = ROUND_KEYS.length - 1; i >= 0; i -= 1) {
    const prevB = a;
    const prevA = (b - mix(a, ROUND_KEYS[i]) + HALF) % HALF;
    b = prevB;
    a = prevA;
  }
  const level = a * HALF + b;
  return level < HALF ? level : null;
}

export function formatLevel(level) {
  return String(level).padStart(4, '0');
}

// Displayed as XXXX-XXXX — easier to memorize and dictate.
export function formatSeed(code) {
  const s = String(code).padStart(8, '0');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

// Parses user-supplied code text: accepts "98302101" and "9830-2101".
export function parseSeed(text) {
  if (typeof text !== 'string') return null;
  const digits = text.replace(/[\s-]/g, '');
  if (!/^\d{1,8}$/.test(digits)) return null;
  return Number.parseInt(digits, 10);
}
