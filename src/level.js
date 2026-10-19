import { ERAS, tierDps } from './eras.js';
import { GEMS } from './tuning.js';

// One level = one era. Level 1 Stone Age ... Level 6 Future, then Level 7+ loops back to the
// Stone Age with tougher enemies and bosses (no cap). The player starts on the era's first weapon
// and can earn the second one with XP. At ~30%, ~60% and right before the boss there is a CHECKPOINT
// gate that cashes in the gem meter for power-ups (see powerups.js / checkpoint.js).
export const START = 700;
export const LEN = 21000;          // ~64 s of running at 330 units/s, plus the boss

export function levelInfo(n) {
  n = Math.max(1, Math.floor(n));
  const era = (n - 1) % 6;
  const loop = Math.floor((n - 1) / 6);
  return {
    n, era, loop,
    name: ERAS[era].name,
    hpMul: Math.pow(1.7, loop),          // enemy HP
    dmgMul: 1 + 0.35 * loop,             // enemy / boss damage
    bossMul: Math.pow(1.4, loop),        // boss HP
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

// A level is SEGMENTS stretches of ~12-13 s each. Every stretch: enemy rows (from SEG_ROWS), then a
// GEM CRATE (shoot it to raise its number), a clear run for the gem trail it bursts into, and a METER
// ARCH that cashes the meter in for power-ups. The last stretch's arch sits right before the boss.
// To change the rhythm: edit SEGMENTS / SEG_ROWS / the CRATE_AT / ARCH_AT offsets.
export const SEGMENTS = 5;
const SEG = LEN / SEGMENTS;          // 4200 units ~ 12.7 s
const ROWS_FROM = 150, ROWS_TO = 1350; // enemy rows inside a stretch (then a clear run-up to the crate)
const CRATE_AT = 1850;               // crate, from the start of the stretch
const ARCH_AT = 3800;                // arch (after the trail)
const SEG_ROWS = [
  ['e1', 'e2', 'e1', 'e3', 'b1'],
  ['e2', 'gate', 'e3', 'swarm', 'e2'],
  ['e3', 'big', 'gate', 'swarm', 'b2'],
  ['e2', 'swarm', 'big', 'gate', 'e3'],
  ['big', 'e3', 'swarm', 'b2', 'big'],
];
const ROW_WEIGHT = { e1: 0.8, e2: 0.95, e3: 1.15, swarm: 1.35, big: 1.15, b1: 0.85, b2: 1.0, gate: 1.05 };
const CRATE_LANES = [0, 150, -150, 0, 150];

// Enemy HP over the course of a level, relative to the era's first weapon: grows with the
// gates and power-ups a decent player picks up on the way.
export const RAMP = [1.0, 3.2];
export const rampAt = (p) => RAMP[0] + (RAMP[1] - RAMP[0]) * Math.pow(Math.min(1, Math.max(0, p)), 1.1);

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
  let total = 0, gateIdx = 0;
  const checkpoints = [];
  const crates = [];
  for (let sg = 0; sg < SEGMENTS; sg++) {
    const s0 = START + sg * SEG;
    const rows = SEG_ROWS[sg % SEG_ROWS.length];
    const totalW = rows.reduce((a, row) => a + ROW_WEIGHT[row], 0);
    let cursor = 0;
    rows.forEach((row) => {
      const span = ((ROWS_TO - ROWS_FROM) * ROW_WEIGHT[row]) / totalW;
      const at = s0 + ROWS_FROM + cursor + (r() - 0.5) * 30;
      const p = (at - START) / LEN;
      cursor += span;
      const h = base * rampAt(p);
      const dmgMul = info.dmgMul;
      const section = Math.min(5, Math.floor(p * 6));
      const ref = base * rampAt(p);
      const enemy = (x, hp, size = 1, dmg = 12, off = 0) => {
        hp = Math.max(1, Math.round(hp));
        items.push({ type: 'enemy', at: at + off, x, hp, size, dmg: Math.round(dmg * dmgMul), section, ref });
        total += hp;
      };
      const block = (x, hp) => {
        hp = Math.max(2, Math.round(hp));
        items.push({ type: 'block', at, x, hp, size: 1, dmg: Math.round(18 * dmgMul), section, ref });
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
      }
    });
    const cAt = s0 + CRATE_AT;
    const crate = { type: 'crate', at: cAt, x: CRATE_LANES[sg % CRATE_LANES.length], ref: base * rampAt((cAt - START) / LEN), idx: sg, phase: r() * Math.PI * 2 };
    items.push(crate); crates.push(cAt);
    const aAt = s0 + ARCH_AT;
    items.push({ type: 'checkpoint', at: aAt, idx: checkpoints.length });
    checkpoints.push(aAt);
  }
  const finish = START + LEN;
  items.sort((a, b) => a.at - b.at);
  // per-level weapon-2 XP (bot-tuned so a typical player evolves on about half their runs)
  const XP_MUL = [1, 1.1, 1, 1, 1.5, 1.45, 1.25];
  const need = [Math.round(GEMS.xpNeed * (XP_MUL[(n - 1) % XP_MUL.length] || 1))];
  return { info, items, need, finish, checkpoints, crates, totalHP: total };
}
