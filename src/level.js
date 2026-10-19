import { ERAS, tierDps } from './eras.js';
import { GEMS, WAVES } from './tuning.js';

// One level = one era. Level 1 Stone Age ... Level 6 Future, then Level 7+ loops back to the
// Stone Age with tougher enemies and bosses (no cap). The player starts on the era's first weapon
// and can earn the second one with XP. At ~30%, ~60% and right before the boss there is a CHECKPOINT
// gate that cashes in the gem meter for power-ups (see powerups.js / checkpoint.js).
export const START = 700;
export const LEN = 23000;          // ~70 s of running at 330 units/s, plus the boss

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
    walk: WAVES.walk + WAVES.walkEra * era + WAVES.walkLoop * loop, // enemies walk faster later on
    waveHp: (WAVES.hpBase + WAVES.hpEra * era + WAVES.hpLoop * loop) * WAVES.hpByEra[era],              // wave enemies a bit tougher
    chargers: n >= WAVES.charger.from,
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

// A level is SEGMENTS stretches of ~14 s each. Every stretch: enemy waves (from SEG_ROWS), then a
// GEM CRATE (shoot it to raise its number), a clear run for the gem trail it bursts into, and a METER
// ARCH that cashes the meter in for power-ups. The last stretch's arch sits right before the boss.
// Waves are laid out one after another by ARRIVAL time with clear zones around gates (WAVES in
// tuning.js); spare room in a stretch is spread evenly between the waves.
// To change the rhythm: edit SEGMENTS / SEG_ROWS / the ROWS_* / CRATE_AT / ARCH_AT offsets.
export const SEGMENTS = 5;
const SEG = LEN / SEGMENTS;          // 4600 units ~ 13.9 s
const ROWS_FROM = 120, ROWS_TO = 2100; // enemy ARRIVALS inside a stretch (then a clear run-up to the crate)
const CRATE_AT = 2500;               // crate, from the start of the stretch
const ARCH_AT = 4450;                // arch (after the trail)
// rows marked '+' only from Level 2 on, '-' only before Level 4, '*' only on loops (Level 7+);
// 'charger' only from Level 4
const SEG_ROWS = [
  ['e1', 'e2', 'e1', 'e3', 'b1', 'e2+', 'e3*'],
  ['e2', 'gate', 'e3', 'swarm', 'charger', 'e2-'],
  ['e3', 'big', 'gate', 'swarm', 'b2', 'charger'],
  ['e2', 'swarm', 'big', 'gate', 'e3', 'charger'],
  ['big', 'e3', 'charger', 'swarm', 'b2', 'big', 'e3+'],
];
const CRATE_LANES = [0, 150, -150, 0, 150];

// Enemies of each wave: x and arrival offset dt (s) from the wave start. Built so two enemies of a
// wave are never stacked: either >= minDx apart sideways or >= inWave s apart along the track.
const shuffle = (r, a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function waveShape(row, r) {
  const jit = (k = 30) => (r() - 0.5) * k;
  const LANES = [-150, 0, 150];
  switch (row) {
    case 'e1': return [{ x: LANES[Math.floor(r() * 3)] * 0.75 + jit(40), dt: 0, k: 'e1' }];
    case 'e2': { const s = r() < 0.5 ? -1 : 1; return [{ x: s * 95 + jit(), dt: 0, k: 'e2' }, { x: -s * 95 + jit(), dt: 0.36, k: 'e2' }]; }
    case 'e3': return shuffle(r, [-145, 0, 145]).map((x, j) => ({ x: x + jit(20), dt: j * 0.34, k: 'e3' }));
    case 'swarm': { const flip = r() < 0.5; return [-160, -80, 0, 80, 160].map((x, j) => ({ x, dt: (flip ? 2 - Math.abs(j - 2) : Math.abs(j - 2)) * 0.31, k: 'swarm' })); }
    case 'big': return [{ x: (r() - 0.5) * 160, dt: 0, k: 'big' }];
    case 'b1': return [{ x: LANES[Math.floor(r() * 3)], dt: 0, k: 'b1' }];
    case 'b2': { const l = LANES.slice(); l.splice(Math.floor(r() * 3), 1); return l.map((x) => ({ x, dt: 0, k: 'b2' })); }
    case 'charger': return [{ x: LANES[Math.floor(r() * 3)], dt: 0, k: 'charger' }];
  }
  return [];
}
const depthOf = (shape) => Math.max(0, ...shape.map((e) => e.dt));

// arrival (track distance when it reaches you) -> spawn 'at' for something walking toward you
export function atForArrival(A, walk, charger = false) {
  const { run: RUN, spawnZ: SZ } = WAVES;
  const v = RUN + walk;
  if (charger) {
    // a charger walks to the trigger point, holds for the telegraph, then rushes: it arrives
    // earlier than a walker would, so spawn it later by the difference
    const C = WAVES.charger;
    const walker = C.trigger / v, actual = C.aim + C.trigger / (C.rush + 0);
    A += (walker - actual) * RUN;
  }
  const at = A + (SZ * walk) / v;
  return at >= SZ ? at : (A * v) / RUN;
}

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
  const base0 = tierDps(info.era * 2) * info.hpMul; // crates: the plain level reference
  const base = base0 * info.waveHp;
  const RUN = WAVES.run, v = RUN + info.walk;
  const gapA = WAVES.gap * (v / 375) * RUN;
  const lead = (WAVES.spawnZ * info.walk) / v;
  const chLead = atForArrival(10000, info.walk, true) - atForArrival(10000, info.walk);
  const items = [];
  let total = 0, gateIdx = 0;
  const checkpoints = [];
  const crates = [];
  const overflow = [];
  for (let sg = 0; sg < SEGMENTS; sg++) {
    const s0 = START + sg * SEG;
    const rows = SEG_ROWS[sg % SEG_ROWS.length]
      .filter((row) => !(row.endsWith('+') && n < 2) && !(row.endsWith('-') && n >= 4) && !(row.endsWith('*') && info.loop < 1) && !(row === 'charger' && !info.chargers))
      .map((row) => row.replace(/[+*-]$/, ''));
    // plan: each entry gets a start (arrival) and a depth; gates carry their clear zones
    const plan = rows.map((row) => {
      if (row === 'gate') return { row, before: WAVES.gateBefore * RUN, after: WAVES.gateAfter * RUN, depth: 0 };
      const shape = waveShape(row, r);
      // a charger right after a gate would start its telegraph while the gate still hides it
      return { row, shape, depth: depthOf(shape) * RUN, before: 0, after: 0 };
    });
    // spacing between consecutive entries: gate zones replace the normal wave gap
    const gaps = plan.slice(1).map((p, i) => {
      const prev = plan[i];
      // anything arriving before a gate must also SPAWN in front of it (walkers spawn ~lead units
      // later than they arrive), or it would walk through the gate while hidden behind it
      if (p.row === 'gate') return Math.max(p.before, lead + 40 + (prev.row === 'charger' ? chLead : 0));
      if (prev.row === 'gate') return prev.after + (p.row === 'charger' ? 1.0 * RUN : 0);
      return gapA + (prev.row === 'b1' || prev.row === 'b2' ? 0.25 * RUN : 0);
    });
    const need = plan.reduce((a, p) => a + p.depth, 0) + gaps.reduce((a, g) => a + g, 0);
    const room = ROWS_TO - ROWS_FROM;
    const slack = Math.max(0, room - need);
    if (need > room) overflow.push({ sg, over: Math.round(need - room) });
    const extra = gaps.length ? Math.min(slack / gaps.length, 0.8 * RUN) : 0;
    let cursor = s0 + ROWS_FROM;
    plan.forEach((p, i) => {
      if (i) cursor += gaps[i - 1] + extra + (r() - 0.5) * 12;
      const A0 = cursor;
      cursor += p.depth;
      const p01 = (A0 - START) / LEN;
      const section = Math.min(5, Math.floor(p01 * 6));
      if (p.row === 'gate') { items.push({ type: 'gate', at: A0, gates: gatePair(r, gateIdx++), section }); return; }
      const ref = base * rampAt(p01);
      const h = ref;
      const dmgMul = info.dmgMul;
      for (const e of p.shape) {
        const A = A0 + e.dt * RUN;
        const x = Math.max(-190, Math.min(190, e.x));
        if (e.k === 'b1' || e.k === 'b2') {
          const hp = Math.max(2, Math.round(h * (e.k === 'b1' ? 3 : 2.6)));
          items.push({ type: 'block', at: A, arrive: A, x, hp, size: 1, dmg: Math.round(18 * dmgMul), section, ref });
          total += hp;
          continue;
        }
        const S = { e1: [1.1, 1, 12], e2: [0.85, 1, 12], e3: [0.65, 1, 12], swarm: [0.4, 0.8, 8], big: [2.4, 1.4, 16], charger: [WAVES.charger.hp, 1.05, WAVES.charger.dmg] }[e.k];
        const hp = Math.max(1, Math.round(h * S[0]));
        const charger = e.k === 'charger';
        items.push({ type: 'enemy', at: atForArrival(A, info.walk, charger), arrive: A, x, hp, size: S[1], dmg: Math.round(S[2] * dmgMul), section, ref, walk: info.walk, charger });
        total += hp;
      }
    });
    const cAt = s0 + CRATE_AT;
    const crate = { type: 'crate', at: cAt, x: CRATE_LANES[sg % CRATE_LANES.length], ref: base0 * rampAt((cAt - START) / LEN), idx: sg, phase: r() * Math.PI * 2 };
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
  return { info, items, need, finish, checkpoints, crates, totalHP: total, overflow };
}
