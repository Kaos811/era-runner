import { ERAS, tierDps } from './eras.js';

// One level = one era. Level 1 Stone Age ... Level 6 Future, then Level 7+ loops back to the
// Stone Age with tougher enemies and bosses (no cap). The player starts on the era's first weapon
// and can earn the second one with XP. Halfway and right before the boss there is a CHECKPOINT
// gate that cashes in the gem meter for power-ups (see powerups.js / checkpoint.js).
export const START = 700;
export const LEN = 21000;          // ~64 s of running at 330 units/s, plus the boss
export const CHECKPOINT_AT = 0.47; // first checkpoint, as a share of the track

export function levelInfo(n) {
  n = Math.max(1, Math.floor(n));
  const era = (n - 1) % 6;
  const loop = Math.floor((n - 1) / 6);
  return {
    n, era, loop,
    name: ERAS[era].name,
    hpMul: Math.pow(1.7, loop),          // enemy HP
    dmgMul: 1 + 0.35 * loop,             // enemy / boss damage
    bossMul: Math.pow(1.45, loop),       // boss HP
    coinMul: 1 + 0.4 * (n - 1),          // coins scale with the level so the shop keeps pace
  };
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Row recipes for the two halves of a level ('cp' = checkpoint gate with breathing room around it).
// Rows get track space in proportion to how much they throw at the player (ROW_WEIGHT).
const PLAN = [
  'e1', 'e1', 'e2', 'gate', 'e2', 'b1', 'e3', 'e2', 'swarm', 'gate', 'e3', 'big', 'e2', 'b2', 'e3', 'swarm', 'e2', 'e3', 'cp',
  'e2', 'gate', 'e3', 'big', 'swarm', 'b2', 'e3', 'e2', 'gate', 'big', 'swarm', 'e3', 'b2', 'e3', 'gate', 'big', 'swarm', 'e3', 'big', 'cp2',
];
const ROW_WEIGHT = { e1: 0.8, e2: 0.95, e3: 1.15, swarm: 1.35, big: 1.15, b1: 0.85, b2: 1.0, gate: 1.05, cp: 1.6, cp2: 1.3 };

// Enemy HP over the course of a level, relative to the era's first weapon: grows with the
// gates and power-ups a decent player picks up on the way.
export const RAMP = [1.0, 3.2];
export const rampAt = (p) => RAMP[0] + (RAMP[1] - RAMP[0]) * Math.pow(Math.min(1, Math.max(0, p)), 1.1);
export const XP_SHARE = 0.4; // XP for the era's second weapon, as a share of the level's total enemy HP

const GOOD = {
  rate: (r) => 15 + Math.round(r() * 3) * 5, // 15..30
  dmg: (r) => 20 + Math.round(r() * 3) * 5,
  shot: () => 1,
  hp: () => 30,
};
const BAD = {
  rate: (r) => -(10 + Math.round(r() * 3) * 5),
  dmg: (r) => -(10 + Math.round(r() * 3) * 5),
  shot: () => -1,
};

function gatePair(r, idx) {
  const good = (kind) => ({ kind, value: GOOD[kind](r) });
  const bad = (kind) => ({ kind, value: BAD[kind](r) });
  let pair;
  if (idx === 0) pair = [good('shot'), bad('rate')];
  else if (idx === 1) pair = [good('rate'), good('dmg')];
  else if (idx === 2) pair = [good('shot'), good('hp')];
  else {
    const roll = r();
    const kinds = ['rate', 'dmg'];
    const g1 = kinds[Math.floor(r() * 2)];
    if (roll < 0.4) pair = [good(g1), bad(g1 === 'rate' ? 'dmg' : 'rate')];
    else if (roll < 0.7) pair = [good('rate'), good('dmg')];
    else pair = [good(g1), bad('shot')];
  }
  if (r() < 0.5) pair.reverse();
  return pair;
}

export function buildLevel(n = 1) {
  const info = levelInfo(n);
  const r = rng(11 + info.era * 7 + info.loop * 101);
  const base = tierDps(info.era * 2) * info.hpMul;
  const items = [];
  let total = 0;
  const totalW = PLAN.reduce((a, row) => a + ROW_WEIGHT[row], 0);
  let cursor = 0, gateIdx = 0;
  const checkpoints = [];
  PLAN.forEach((row) => {
    const span = (LEN * ROW_WEIGHT[row]) / totalW;
    const at = START + cursor + (row.startsWith('cp') ? span / 2 : (r() - 0.5) * 40);
    const p = cursor / LEN;
    cursor += span;
    const h = base * rampAt(p);
    const dmgMul = info.dmgMul;
    const section = Math.min(5, Math.floor(p * 6));
    const enemy = (x, hp, size = 1, dmg = 12, off = 0) => {
      hp = Math.max(1, Math.round(hp));
      items.push({ type: 'enemy', at: at + off, x, hp, size, dmg: Math.round(dmg * dmgMul), section, ref: base * rampAt(p) });
      total += hp;
    };
    const block = (x, hp) => {
      hp = Math.max(2, Math.round(hp));
      items.push({ type: 'block', at, x, hp, size: 1, dmg: Math.round(18 * dmgMul), section, ref: base * rampAt(p) });
      total += hp;
    };
    const jitter = () => (r() - 0.5) * 50;
    switch (row) {
      case 'e1': enemy((r() - 0.5) * 220, h * 1.1); break;
      case 'e2': enemy(-80 + jitter(), h * 0.85); enemy(80 + jitter(), h * 0.85, 1, 12, 120); break;
      case 'e3': [-140, 0, 140].forEach((x, j) => enemy(x + jitter() * 0.5, h * 0.65, 1, 12, [0, 110, 220][j])); break;
      case 'swarm': [-150, -75, 0, 75, 150].forEach((x, j) => enemy(x, h * 0.4, 0.8, 8, Math.abs(j - 2) * 85)); break;
      case 'big': enemy((r() - 0.5) * 160, h * 2.4, 1.4, 16); break;
      case 'b1': block([-150, 0, 150][Math.floor(r() * 3)], h * 3); break;
      case 'b2': {
        const lanes = [-150, 0, 150];
        lanes.splice(Math.floor(r() * 3), 1);
        lanes.forEach((x) => block(x, h * 2.6));
        break;
      }
      case 'gate': items.push({ type: 'gate', at, gates: gatePair(r, gateIdx++), section }); break;
      case 'cp': case 'cp2': {
        const cp = { type: 'checkpoint', at, idx: checkpoints.length };
        checkpoints.push(at);
        items.push(cp);
        break;
      }
    }
  });
  const finish = START + LEN;
  items.sort((a, b) => a.at - b.at);
  const need = [Math.round((total * XP_SHARE) / 5) * 5];
  return { info, items, need, finish, checkpoints, totalHP: total };
}

export { ERAS };
