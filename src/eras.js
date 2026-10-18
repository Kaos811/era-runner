// The six eras the weapon evolves through. Stats are the base values for that era's weapon;
// gate boosts are applied on top as percentages / extra projectiles.
export const ERAS = [
  {
    key: 'stone', name: 'STONE AGE', weapon: 'Sling', proj: 'rock',
    rate: 2.4, dmg: 1, pspeed: 1150, pr: 9,
    sky: [0xffd98f, 0xeb9a55], ground: 0xa86f3d, track: [0xecd9b2, 0xdcc394], rail: 0x7a4a24,
    sil: 0xbf7a42, sil2: 0xa4632f, ui: 0xe08a2e, burst: 0x8b5a2b, neon: false,
  },
  {
    key: 'bronze', name: 'BRONZE AGE', weapon: 'Spear Thrower', proj: 'spear',
    rate: 2.8, dmg: 2.2, pspeed: 1250, pr: 8,
    sky: [0xfff0b8, 0xf2b45c], ground: 0xc79a55, track: [0xf3e4ba, 0xe3cd98], rail: 0x95652a,
    sil: 0xdba25a, sil2: 0xc4863e, ui: 0xcd7f32, burst: 0xb5452f, neon: false,
  },
  {
    key: 'medieval', name: 'MEDIEVAL', weapon: 'Crossbow', proj: 'bolt',
    rate: 3.2, dmg: 4, pspeed: 1400, pr: 7,
    sky: [0xa9cbe6, 0xeadfc2], ground: 0x6f9a4b, track: [0xdcd6c8, 0xc6beac], rail: 0x6c645a,
    sil: 0x8995a3, sil2: 0x6f7b8a, ui: 0x5d86b8, burst: 0x9aa4ad, neon: false,
  },
  {
    key: 'gunpowder', name: 'GUNPOWDER', weapon: 'Cannon', proj: 'ball',
    rate: 2.0, dmg: 10, pspeed: 1300, pr: 13,
    sky: [0x8fb8d8, 0xf5d7a8], ground: 0x7f8f4e, track: [0xdcc9a4, 0xc8b28b], rail: 0x5a4632,
    sil: 0x6f8370, sil2: 0x58695a, ui: 0xc0392b, burst: 0x2c4f9e, neon: false,
  },
  {
    key: 'modern', name: 'MODERN', weapon: 'Machine Gun', proj: 'bullet',
    rate: 9, dmg: 3.2, pspeed: 1800, pr: 6,
    sky: [0x5f9fd9, 0xd3e6f4], ground: 0x5b6670, track: [0xa2abb3, 0x8f98a0], rail: 0x3a4148,
    sil: 0x6d7f96, sil2: 0x55657a, ui: 0x3f9a3f, burst: 0x5d6b3a, neon: false,
  },
  {
    key: 'future', name: 'FUTURE', weapon: 'Laser', proj: 'laser',
    rate: 7, dmg: 7, pspeed: 2200, pr: 8,
    sky: [0x120828, 0x5b2a8a], ground: 0x1d1440, track: [0x2e2766, 0x241d55], rail: 0x29f0ff,
    sil: 0x3a2470, sil2: 0x2a1858, ui: 0x29d8ff, burst: 0x29f0ff, neon: true,
  },
];

export const eraDps = (k) => ERAS[k].rate * ERAS[k].dmg;
