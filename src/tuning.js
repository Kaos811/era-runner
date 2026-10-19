// Gameplay knobs for gems, gem crates and the arch meter, in one place so they are easy to retune.
// (Rarity band sizes and the power-up pool live in powerups.js; the level layout in level.js.)
export const GEMS = {
  reachX: 40,        // sideways pickup reach for loose gems (lanes are 150 apart)
  trailReachX: 46,   // sideways pickup reach for crate-trail gems
  reachZ: 130,       // how far ahead a gem gets sucked in once you're lined up
  spread: 46,        // extra sideways spacing per gem when an enemy drops more than one
  pop: [42, 78],     // loose gems pop 42-78 units sideways, AWAY from you: standing still never picks them up
  homing: 10,        // how fast enemies drift toward your lane
  perKill: { enemy: 0.15, big: 1, block: 1 }, // gems dropped (fractions = chance of one gem)
  xpNeed: 62,        // gem XP for the era's second weapon (one gem = 1 XP x streak)
  comboGain: 0.05,   // streak: each gem +5% XP / meter points (up to x2) ...
  comboMiss: 0.25,   // ... each missed gem knocks it back down
  magnetStep: 1.0,   // Gem Magnet power-up: +100% pickup reach per stack
};

// Gem crates: shoot them to raise the number, reach them to burst into a trail of that many gems.
export const CRATES = {
  start: 6,          // number on a fresh crate
  cap: 40,           // highest number
  perSec: 9,         // number gained per second of hits at the level's reference firepower
  maxPerHit: 3,      // one hit adds at most this much (and at least 1)
  trailStartZ: 240,  // first trail gem this far ahead of the burst
  trailSpacing: 40,  // track distance between trail gems
  weaveAmp: 140,     // trail weaves left/right this far ...
  weavePeriod: 22,   // ... over this many gems
};

// Bonus run after a boss win: rows of numbered blocks spanning the track, each tagged with a coin
// multiplier. Break a row before you reach it to bank its multiplier; the first row you can't
// break (you just bump into it, no damage) or clearing the last row ends the bonus.
// Row i HP = ref * hpBase * hpGrowth^i, where ref = the level's base weapon DPS (weapon 1, no
// boosts) so your real firepower (gates, weapon 2, power-ups, shop upgrades) decides how far you get.
export const BONUS = {
  mults: [1.2, 1.5, 2, 2.5, 3, 4, 5],
  speed: 560,        // track speed during the bonus (units / s)
  firstZ: 1000,      // first row this far ahead when the bonus starts
  spacing: 540,      // track distance between rows (~1 s apart)
  hpBase: 11.5,
  hpGrowth: 1.6,
  maxTime: 8.5,      // hard cap; a full clear takes ~7.5 s
  endDelay: 0.9,     // beat after the bump / last row before the result screen
};
// Base coin values are scaled so the bonus multiplier doesn't flood the shop (see README).
// kill: enemy / block coins on top of that (waves are spread out now, so you kill more of them)
export const COINS = { scale: 0.62, kill: 0.72 };

// Enemy waves (level.js lays them out, Game.js moves them). Times are seconds of running.
// Waves are placed by ARRIVAL time (when a thing reaches you), since enemies walk toward you and
// would otherwise catch up with gates. Gates and gem crates block shots, so nothing arrives
// within gateBefore s before / gateAfter s after a gate, and at runtime an enemy can't close in
// on a gate that is still in front of it (holdAfter s of running behind it).
export const WAVES = {
  run: 330,          // track speed (Game.js RUN)
  spawnZ: 1900,      // Game.js SPAWN_Z
  walk: 45,          // enemy walking speed toward you (units / s) ...
  walkEra: 3,        // ... + this per era (Level 1-6) ...
  walkLoop: 10,      // ... + this per loop (Level 7+)
  gateBefore: 0.6,   // clear zone before a gate (s)
  gateAfter: 1.8,    // clear zone after a gate: the first enemy behind it is ~650 units out when you pass
  holdAfter: 1.5,    // runtime: enemies stay at least this far (s of closing) behind a gate in front of them
  crateBefore: 1.0,  // last enemy arrives this long before a gem crate
  gap: 0.45,         // minimum gap between waves (s), scaled by closing speed / 375
  inWave: 0.3,       // enemies in a wave closer than minDx sideways must be this far apart (s)
  minDx: 110,        // ... sideways spacing that counts as "not stacked"
  sepDz: 90, sepDx: 100, sepSpeed: 80, // runtime: enemies this close push apart sideways
  hpBase: 1.2,       // wave enemy HP x this (fewer cheap hits now, so enemies are a bit tougher) ...
  hpEra: 0.03,       // ... +3% per era ...
  hpLoop: 0.06,      // ... and +6% per loop (on top of the loop multiplier)
  hpByEra: [1.4, 1.16, 1.15, 0.88, 1.32, 1.06], // bot-tuned per era (also on loops)
  charger: {
    from: 4,         // first level with chargers (and all loops)
    hp: 0.8,         // x row HP
    dmg: 16,
    trigger: 950,    // starts its telegraph this far out
    aim: 0.65,       // telegraph: stops, flashes and marks your lane (s)
    rush: 1000,      // then rushes down that lane at this closing speed
    minZ: 600,       // too close when it could start (e.g. a gate was in the way): acts as a normal enemy
  },
};
