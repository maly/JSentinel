// difficulty.js — level -> difficulty knobs. Shared by the game (main.js) and
// the terrain tests (test/terrain.test.mjs), so both use ONE formula.
//
// Difficulty rises in steps of 200 levels and maxes out at level 2000:
// tier 0 = levels 0000-0199 (today's balance), tier 10 = harshest.
// Harder tiers mean rougher terrain, fewer trees and more sentries.
export function difficultyFor(level) {
  const tier = Math.min(Math.floor(level / 200), 10);
  const t = tier / 10;
  return {
    tier,
    ruggedness: t,                                  // terrain generator knob
    treeDensity: 0.25 - 0.15 * t,                   // 25% -> 10% of free flats
    minSentries: tier >= 6 ? 3 : (tier >= 3 ? 2 : 1),
  };
}
