// Gameplay knobs for gems and the checkpoint meter, in one place so they are easy to retune.
// (Rarity band sizes and the power-up pool live in powerups.js; the level layout in level.js.)
export const GEMS = {
  reachX: 40,        // sideways pickup reach (lanes are 150 apart): you have to steer onto gems
  reachZ: 130,       // how far ahead a gem gets sucked in once you're lined up
  spread: 46,        // extra sideways spacing per gem when an enemy drops more than one
  pop: [42, 78],     // gems pop 42-78 units sideways, AWAY from you: standing still never picks them up
  homing: 10,        // how fast enemies drift toward your lane
  perKill: { enemy: 1, big: 2, block: 2 }, // gems dropped
  xpShare: 0.25,     // XP for weapon 2, as a share of the level's total enemy HP (gem XP = enemy HP)
  comboGain: 0.05,   // streak: each gem +5% XP / meter points (up to x2) ...
  comboMiss: 0.35,   // ... each missed gem knocks it back down
  magnetStep: 1.0,   // Gem Magnet power-up: +100% pickup reach per stack
};
