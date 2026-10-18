import { ERAS, eraDps } from './eras.js';

// Deterministic level layout. The track is split into 6 sections, one per era; enemy HP in each
// section is scaled to what that era's weapon can handle, and the XP needed to evolve out of an
// era is a fraction of the HP available in its section, so a decent run evolves roughly on pace.
export const SECTION = 4300;
export const START = 900;
export const XP_FACTOR = 0.6;

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

// Row recipes per section (one row every SECTION / rows.length units).
const PLAN = [
  ['e1', 'e1', 'e2', 'gate', 'e2', 'b1', 'e3', 'gate', 'e2'],
  ['e2', 'e3', 'gate', 'b2', 'e3', 'big', 'gate', 'e3', 'swarm'],
  ['e3', 'swarm', 'gate', 'e3', 'b2', 'big', 'gate', 'e3', 'swarm'],
  ['e3', 'big', 'gate', 'swarm', 'b2', 'e3', 'gate', 'big', 'e3'],
  ['swarm', 'e3', 'gate', 'big', 'b2', 'swarm', 'gate', 'e3', 'big'],
  ['swarm', 'e3', 'gate', 'big', 'swarm', 'b2', 'e3', 'boss'],
];

// Enemy HP grows a little faster than the base weapon to account for gate boosts.
export const HP_MULT = [1.0, 1.15, 1.3, 1.45, 1.6, 1.75];

const GOOD = {
  rate: (r) => 10 + Math.round(r() * 3) * 5, // 10..25
  dmg: (r) => 15 + Math.round(r() * 3) * 5,
  shot: () => 1,
  hp: () => 25,
};
const BAD = {
  rate: (r) => -(10 + Math.round(r() * 3) * 5),
  dmg: (r) => -(10 + Math.round(r() * 3) * 5),
  shot: () => -1,
};

function gatePair(r, k, idx) {
  const good = (kind) => ({ kind, value: GOOD[kind](r) });
  const bad = (kind) => ({ kind, value: BAD[kind](r) });
  let pair;
  if (k === 0 && idx === 0) pair = [good('shot'), bad('rate')];
  else if (k === 0) pair = [good('rate'), good('dmg')];
  else {
    const roll = r();
    const kinds = ['rate', 'dmg'];
    const g1 = kinds[Math.floor(r() * 2)];
    if (idx === 0 && (k === 2 || k === 4)) pair = [good('shot'), bad(g1)];
    else if (roll < 0.35) pair = [good(g1), bad(g1 === 'rate' ? 'dmg' : 'rate')];
    else if (roll < 0.6) pair = [good('rate'), good('dmg')];
    else if (roll < 0.8) pair = [good(g1), good('hp')];
    else pair = [good(g1), bad('shot')];
  }
  if (r() < 0.5) pair.reverse();
  return pair;
}

export function buildLevel(seed = 11) {
  const r = rng(seed);
  const items = [];
  const sectionHP = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < 6; k++) {
    const rows = PLAN[k];
    const gap = SECTION / rows.length;
    const h = eraDps(k) * HP_MULT[k];
    let gateIdx = 0;
    rows.forEach((row, i) => {
      const at = START + k * SECTION + i * gap + (r() - 0.5) * 60;
      const enemy = (x, hp, size = 1, dmg = 10, off = 0) => {
        hp = Math.max(1, Math.round(hp));
        items.push({ type: 'enemy', at: at + off, x, hp, size, dmg, section: k });
        sectionHP[k] += hp;
      };
      const block = (x, hp) => {
        hp = Math.max(2, Math.round(hp));
        items.push({ type: 'block', at, x, hp, size: 1, dmg: 15, section: k });
        sectionHP[k] += hp;
      };
      const jitter = () => (r() - 0.5) * 50;
      switch (row) {
        case 'e1': enemy((r() - 0.5) * 220, h * 1.1); break;
        case 'e2': enemy(-80 + jitter(), h * 0.85); enemy(80 + jitter(), h * 0.85, 1, 10, 60); break;
        case 'e3': [-140, 0, 140].forEach((x, j) => enemy(x + jitter() * 0.5, h * 0.65, 1, 10, j === 1 ? -50 : 0)); break;
        case 'swarm': [-150, -75, 0, 75, 150].forEach((x, j) => enemy(x, h * 0.4, 0.8, 8, Math.abs(j - 2) * 55)); break;
        case 'big': enemy((r() - 0.5) * 160, h * 2.4, 1.4, 20); break;
        case 'boss': enemy(0, h * 5, 1.9, 40); enemy(-150, h * 0.6, 1, 10, -90); enemy(150, h * 0.6, 1, 10, -90); break;
        case 'b1': block([-150, 0, 150][Math.floor(r() * 3)], h * 3); break;
        case 'b2': {
          const lanes = [-150, 0, 150];
          lanes.splice(Math.floor(r() * 3), 1);
          lanes.forEach((x) => block(x, h * 2.6));
          break;
        }
        case 'gate': items.push({ type: 'gate', at, gates: gatePair(r, k, gateIdx++), section: k }); break;
      }
    });
  }
  const finish = START + 6 * SECTION - 150;
  items.push({ type: 'finish', at: finish });
  items.sort((a, b) => a.at - b.at);
  const need = sectionHP.slice(0, 5).map((v) => Math.round(v * XP_FACTOR));
  return { items, need, finish, sectionHP };
}

export { ERAS };
