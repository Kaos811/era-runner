import { GEMS } from './tuning.js';
// Arch-meter power-ups. Easy to extend: add an entry with an id, rarity, name, short desc, icon
// (texture drawn in Boot.js -> powerupIcons; any existing 'pu_*' key works) and apply(p), which
// changes the run's power-up state `p` (see freshPowerState). Power-ups last for the rest of the
// level, stack, and also work in the boss fight.

// Rarity bands of the checkpoint meter. `size` = meter points for that band (later bands take more).
// One gem = 1 point, plus the "gems in a row" streak bonus (up to +1 per gem).
export const RARITIES = [
  { key: 'common', name: 'COMMON', color: 0xd9dde3, text: '#e9edf2', size: 5 },
  { key: 'uncommon', name: 'UNCOMMON', color: 0x4cd964, text: '#7dff9a', size: 9 },
  { key: 'rare', name: 'RARE', color: 0x3a8dff, text: '#7ab8ff', size: 14 },
  { key: 'epic', name: 'EPIC', color: 0xb052ff, text: '#d29bff', size: 22 },
  { key: 'legendary', name: 'LEGENDARY', color: 0xffc21a, text: '#ffd84d', size: 43 },
];
export const LAP = RARITIES.reduce((a, r) => a + r.size, 0); // points for one full lap (= a banked Legendary)

// band index reached with `pts` points into the current lap
export function bandOf(pts) {
  let acc = 0;
  for (let i = 0; i < RARITIES.length; i++) { acc += RARITIES[i].size; if (pts < acc) return i; }
  return RARITIES.length - 1;
}
export const bandStart = (i) => RARITIES.slice(0, i).reduce((a, r) => a + r.size, 0);

// What a checkpoint pays out for `pts` meter points: one Legendary per completed lap, plus the
// band of the final partial lap (if there is one, or if nothing else was earned).
export function payout(pts) {
  const laps = Math.floor(pts / LAP);
  const rest = pts - laps * LAP;
  const out = Array(laps).fill(RARITIES.length - 1);
  if (rest > 0 || laps === 0) out.push(bandOf(rest));
  return out;
}

export function freshPowerState() {
  return {
    dmgMul: 1, rateMul: 1, shots: 0, magnet: 1, pierce: 0, shieldMax: 0, shield: 0, shieldT: 0,
    size: 1, chain: 0, blades: 0, explode: 0, double: 0, nova: 0, drone: 0, twin: 0,
  };
}

// `look` (optional) names the visible change on the weapon (see weaponMods in checkpoint.js).
// No allies or companions: every power-up changes your one weapon (Twin Weapon is a copy of it).
export const POWERUPS = [
  // ---- common: small bumps
  { id: 'sharp', rarity: 'common', name: 'Sharpen', desc: '+6% damage', icon: 'pu_dmg', apply: (p) => { p.dmgMul *= 1.06; } },
  { id: 'quick', rarity: 'common', name: 'Quick Draw', desc: '+6% fire rate', icon: 'pu_rate', apply: (p) => { p.rateMul *= 1.06; } },
  { id: 'heal', rarity: 'common', name: 'Bandage', desc: 'Heal 20 HP', icon: 'pu_heal', apply: (p, s) => { s.hp = Math.min(s.maxHp, s.hp + 20); } },
  // ---- uncommon
  { id: 'power', rarity: 'uncommon', name: 'Power Up', desc: '+12% damage', icon: 'pu_dmg2', apply: (p) => { p.dmgMul *= 1.12; } },
  { id: 'frenzy', rarity: 'uncommon', name: 'Frenzy', desc: '+12% fire rate', icon: 'pu_rate2', apply: (p) => { p.rateMul *= 1.12; } },
  { id: 'magnet', rarity: 'uncommon', name: 'Gem Magnet', desc: 'Grab gems from farther away', icon: 'pu_magnet', apply: (p) => { p.magnet += GEMS.magnetStep; } },
  { id: 'patch', rarity: 'uncommon', name: 'Patch Up', desc: 'Heal 45 HP', icon: 'pu_heal', apply: (p, s) => { s.hp = Math.min(s.maxHp, s.hp + 45); } },
  // ---- rare: the weapon changes shape
  { id: 'extra', rarity: 'rare', name: 'Extra Barrel', desc: '+1 projectile', icon: 'pu_shot', look: 'barrel', apply: (p) => { p.shots += 1; } },
  { id: 'pierce', rarity: 'rare', name: 'Piercing Tip', desc: 'Shots go through 1 more enemy', icon: 'pu_pierce', look: 'tip', apply: (p) => { p.pierce += 1; } },
  { id: 'shield', rarity: 'rare', name: 'Bubble Shield', desc: 'Blocks a hit, recharges in 8s', icon: 'pu_shield', apply: (p) => { p.shieldMax += 1; p.shield = p.shieldMax; } },
  { id: 'big', rarity: 'rare', name: 'Heavy Ammo', desc: 'Bigger weapon and shots, +15% damage', icon: 'pu_big', look: 'big', apply: (p) => { p.size *= 1.3; p.dmgMul *= 1.15; } },
  // ---- epic
  { id: 'chain', rarity: 'epic', name: 'Chain Lightning', desc: 'Hits zap nearby enemies', icon: 'pu_chain', look: 'spark', apply: (p) => { p.chain += 1; } },
  { id: 'blades', rarity: 'epic', name: 'Orbit Blades', desc: 'Spinning blades cut and fly', icon: 'pu_blades', apply: (p) => { p.blades += 2; } },
  { id: 'boom', rarity: 'epic', name: 'Explosive Shots', desc: 'Hits blow up around them', icon: 'pu_boom', look: 'ember', apply: (p) => { p.explode += 1; } },
  // ---- legendary
  { id: 'twin', rarity: 'legendary', name: 'Twin Weapon', desc: 'A second copy of your weapon fires beside it', icon: 'pu_twin', look: 'twin', apply: (p) => { p.twin = Math.min(2, p.twin + 1); if (p.twin === 2 && p._twinMax) p.dmgMul *= 1.25; p._twinMax = p.twin === 2; } },
  { id: 'double', rarity: 'legendary', name: 'Double Shot', desc: 'Every volley fires twice', icon: 'pu_double', look: 'double', apply: (p) => { p.double += 1; } },
  { id: 'nova', rarity: 'legendary', name: 'Nova Blast', desc: 'Screen-clearing blast every few seconds', icon: 'pu_nova', apply: (p) => { p.nova += 1; } },
];

export const byRarity = (i) => POWERUPS.filter((u) => u.rarity === RARITIES[i].key);
export const rollPowerup = (band, rand = Math.random) => { const pool = byRarity(band); return pool[Math.floor(rand() * pool.length)]; };
