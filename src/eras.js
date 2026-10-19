// The six eras: scenery, enemy look and boss. Weapons (two per era) are in WEAPONS below;
// gate boosts are applied on top of a weapon's stats as percentages / extra projectiles.
export const ERAS = [
  {
    key: 'stone', name: 'STONE AGE',
    sky: [0xffd98f, 0xeb9a55], ground: 0xa86f3d, track: [0xecd9b2, 0xdcc394], rail: 0x7a4a24,
    sil: 0xbf7a42, sil2: 0xa4632f, ui: 0xe08a2e, burst: 0x8b5a2b, neon: false,
  },
  {
    key: 'bronze', name: 'BRONZE AGE',
    sky: [0xfff0b8, 0xf2b45c], ground: 0xc79a55, track: [0xf3e4ba, 0xe3cd98], rail: 0x95652a,
    sil: 0xdba25a, sil2: 0xc4863e, ui: 0xcd7f32, burst: 0xb5452f, neon: false,
  },
  {
    key: 'medieval', name: 'MEDIEVAL',
    sky: [0xa9cbe6, 0xeadfc2], ground: 0x6f9a4b, track: [0xdcd6c8, 0xc6beac], rail: 0x6c645a,
    sil: 0x8995a3, sil2: 0x6f7b8a, ui: 0x5d86b8, burst: 0x9aa4ad, neon: false,
  },
  {
    key: 'gunpowder', name: 'GUNPOWDER',
    sky: [0x8fb8d8, 0xf5d7a8], ground: 0x7f8f4e, track: [0xdcc9a4, 0xc8b28b], rail: 0x5a4632,
    sil: 0x6f8370, sil2: 0x58695a, ui: 0xc0392b, burst: 0x2c4f9e, neon: false,
  },
  {
    key: 'modern', name: 'MODERN',
    sky: [0x5f9fd9, 0xd3e6f4], ground: 0x5b6670, track: [0xa2abb3, 0x8f98a0], rail: 0x3a4148,
    sil: 0x6d7f96, sil2: 0x55657a, ui: 0x3f9a3f, burst: 0x5d6b3a, neon: false,
  },
  {
    key: 'future', name: 'FUTURE',
    sky: [0x120828, 0x5b2a8a], ground: 0x1d1440, track: [0x2e2766, 0x241d55], rail: 0x29f0ff,
    sil: 0x3a2470, sil2: 0x2a1858, ui: 0x29d8ff, burst: 0x29f0ff, neon: true,
  },
];

// Twelve weapons, two per era. The era (scenery, enemies, boss) is tier >> 1.
// Within an era the second weapon is ~25% stronger; each new era is a bigger (~1.6-1.8x) jump.
//   key: texture 'weapon_<key>', shot sound 'shot_<key>'; proj: texture 'p_<proj>'
export const WEAPONS = [
  { key: 'rock',     name: 'Thrown Rock',        proj: 'pebble',   rate: 1.8, dmg: 1.0,  pspeed: 1000, pr: 11, spacing: 24, recoil: 5 },
  { key: 'stone',    name: 'Sling',              proj: 'rock',     rate: 2.4, dmg: 1.2,  pspeed: 1150, pr: 9,  spacing: 22, recoil: 6 },
  { key: 'javelin',  name: 'Javelin',            proj: 'javelin',  rate: 2.0, dmg: 2.6,  pspeed: 1200, pr: 8,  spacing: 24, recoil: 7 },
  { key: 'bronze',   name: 'Spear Thrower',      proj: 'spear',    rate: 2.8, dmg: 2.6,  pspeed: 1250, pr: 8,  spacing: 22, recoil: 6 },
  { key: 'medieval', name: 'Crossbow',           proj: 'bolt',     rate: 3.0, dmg: 3.8,  pspeed: 1400, pr: 7,  spacing: 22, recoil: 6 },
  { key: 'repeater', name: 'Repeating Crossbow', proj: 'rbolt',    rate: 4.6, dmg: 3.1,  pspeed: 1450, pr: 7,  spacing: 20, recoil: 4 },
  { key: 'musket',   name: 'Musket',             proj: 'musket',   rate: 1.8, dmg: 10.5, pspeed: 1600, pr: 8,  spacing: 24, recoil: 10 },
  { key: 'gunpowder', name: 'Cannon',            proj: 'ball',     rate: 2.2, dmg: 10.5, pspeed: 1300, pr: 13, spacing: 30, recoil: 12 },
  { key: 'rifle',    name: 'Rifle',              proj: 'round',    rate: 4.0, dmg: 7.0,  pspeed: 1900, pr: 6,  spacing: 22, recoil: 7 },
  { key: 'modern',   name: 'Machine Gun',        proj: 'bullet',   rate: 10,  dmg: 3.4,  pspeed: 1800, pr: 6,  spacing: 22, recoil: 6 },
  { key: 'future',   name: 'Laser Pistol',       proj: 'laser',    rate: 6.0, dmg: 7.5,  pspeed: 2200, pr: 8,  spacing: 22, recoil: 6 },
  { key: 'plasma',   name: 'Plasma Cannon',      proj: 'plasma',   rate: 4.5, dmg: 13,   pspeed: 1700, pr: 12, spacing: 28, recoil: 10 },
];
export const MAX_TIER = WEAPONS.length - 1;
export const tierDps = (t) => WEAPONS[t].rate * WEAPONS[t].dmg;
// kept for the era-based code paths: DPS of the era's first weapon
export const eraDps = (k) => tierDps(k * 2);
