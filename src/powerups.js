// Checkpoint power-ups. Easy to extend: add an entry with an id, rarity, name, short desc, icon
// (texture drawn in Boot.js -> powerupIcons; any existing 'pu_*' key works) and apply(p), which
// changes the run's power-up state `p` (see freshPowerState). Power-ups last for the rest of the
// level, stack, and also work in the boss fight.

// Rarity bands of the checkpoint meter. `size` = meter points for that band (later bands take more).
// One gem = 1 point, plus the "gems in a row" streak bonus (up to +1 per gem).
export const RARITIES = [
  { key: 'common', name: 'COMMON', color: 0xd9dde3, text: '#e9edf2', size: 10 },
  { key: 'uncommon', name: 'UNCOMMON', color: 0x4cd964, text: '#7dff9a', size: 14 },
  { key: 'rare', name: 'RARE', color: 0x3a8dff, text: '#7ab8ff', size: 21 },
  { key: 'epic', name: 'EPIC', color: 0xb052ff, text: '#d29bff', size: 27 },
  { key: 'legendary', name: 'LEGENDARY', color: 0xffc21a, text: '#ffd84d', size: 35 },
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
    size: 1, chain: 0, blades: 0, explode: 0, double: 0, nova: 0, drone: 0,
  };
}

export const POWERUPS = [
  // ---- common: small bumps
  { id: 'sharp', rarity: 'common', name: 'Sharpen', desc: '+10% damage', icon: 'pu_dmg', apply: (p) => { p.dmgMul *= 1.1; } },
  { id: 'quick', rarity: 'common', name: 'Quick Draw', desc: '+10% fire rate', icon: 'pu_rate', apply: (p) => { p.rateMul *= 1.1; } },
  { id: 'heal', rarity: 'common', name: 'Bandage', desc: 'Heal 25 HP', icon: 'pu_heal', apply: (p, s) => { s.hp = Math.min(s.maxHp, s.hp + 25); } },
  // ---- uncommon: bigger bumps
  { id: 'power', rarity: 'uncommon', name: 'Power Up', desc: '+22% damage', icon: 'pu_dmg2', apply: (p) => { p.dmgMul *= 1.22; } },
  { id: 'frenzy', rarity: 'uncommon', name: 'Frenzy', desc: '+22% fire rate', icon: 'pu_rate2', apply: (p) => { p.rateMul *= 1.22; } },
  { id: 'extra', rarity: 'uncommon', name: 'Extra Shot', desc: '+1 projectile', icon: 'pu_shot', apply: (p) => { p.shots += 1; } },
  { id: 'magnet', rarity: 'uncommon', name: 'Gem Magnet', desc: 'Grab gems from farther away', icon: 'pu_magnet', apply: (p) => { p.magnet += 0.7; } },
  // ---- rare
  { id: 'pierce', rarity: 'rare', name: 'Piercing', desc: 'Shots go through 1 more enemy', icon: 'pu_pierce', apply: (p) => { p.pierce += 1; } },
  { id: 'shield', rarity: 'rare', name: 'Bubble Shield', desc: 'Blocks a hit, recharges in 8s', icon: 'pu_shield', apply: (p) => { p.shieldMax += 1; p.shield = p.shieldMax; } },
  { id: 'big', rarity: 'rare', name: 'Heavy Ammo', desc: 'Bigger shots, +20% damage', icon: 'pu_big', apply: (p) => { p.size *= 1.4; p.dmgMul *= 1.2; } },
  // ---- epic
  { id: 'chain', rarity: 'epic', name: 'Chain Lightning', desc: 'Hits zap nearby enemies', icon: 'pu_chain', apply: (p) => { p.chain += 1; } },
  { id: 'blades', rarity: 'epic', name: 'Orbit Blades', desc: 'Spinning blades cut and fly', icon: 'pu_blades', apply: (p) => { p.blades += 2; } },
  { id: 'boom', rarity: 'epic', name: 'Explosive Shots', desc: 'Hits blow up around them', icon: 'pu_boom', apply: (p) => { p.explode += 1; } },
  // ---- legendary
  { id: 'double', rarity: 'legendary', name: 'Double Shot', desc: 'Every volley fires twice', icon: 'pu_double', apply: (p) => { p.double += 1; } },
  { id: 'nova', rarity: 'legendary', name: 'Nova Blast', desc: 'Screen-clearing blast every few seconds', icon: 'pu_nova', apply: (p) => { p.nova += 1; } },
  { id: 'drone', rarity: 'legendary', name: 'Drone Buddy', desc: 'A drone that fires with you', icon: 'pu_drone', apply: (p) => { p.drone += 1; } },
];

export const byRarity = (i) => POWERUPS.filter((u) => u.rarity === RARITIES[i].key);
export const rollPowerup = (band, rand = Math.random) => { const pool = byRarity(band); return pool[Math.floor(rand() * pool.length)]; };
