// Permanent upgrades bought in the shop with coins. Applied at the start of every run.
// Head Start: starting XP per level (the weapon steps cost 15, 25, 40, 70, 120, 190, 300 ... XP)
export const HEAD_XP = [0, 60, 140, 250, 400, 600, 850];

export const UPGRADES = [
  { key: 'dmg', name: 'SHARPER WEAPONS', icon: 'icon_dmg', max: 10, base: 60, growth: 1.5, per: 10,
    effect: (l) => (l ? `+${l * 10}% damage` : 'no bonus') },
  { key: 'rate', name: 'QUICK HANDS', icon: 'icon_rate', max: 10, base: 60, growth: 1.5, per: 8,
    effect: (l) => (l ? `+${l * 8}% fire rate` : 'no bonus') },
  { key: 'hp', name: 'TOUGH HIDE', icon: 'icon_hp', max: 8, base: 50, growth: 1.55, per: 15,
    effect: (l) => `${100 + l * 15} max health` },
  { key: 'xp', name: 'HEAD START', icon: 'icon_xp', max: 6, base: 80, growth: 1.6,
    effect: (l) => (l ? `start with ${HEAD_XP[l]} XP` : 'start with 0 XP') },
  { key: 'coin', name: 'LUCKY COINS', icon: 'icon_coin', max: 5, base: 100, growth: 1.7, per: 15,
    effect: (l) => (l ? `+${l * 15}% coins` : 'no bonus') },
];

export const upgCost = (u, level) => Math.round((u.base * Math.pow(u.growth, level)) / 5) * 5;

// Run modifiers from a set of upgrade levels.
export function runMods(upg) {
  return {
    dmgMul: 1 + 0.1 * (upg.dmg || 0),
    rateMul: 1 + 0.08 * (upg.rate || 0),
    maxHp: 100 + 15 * (upg.hp || 0),
    startXp: HEAD_XP[Math.min(upg.xp || 0, HEAD_XP.length - 1)],
    coinMul: 1 + 0.15 * (upg.coin || 0),
  };
}
