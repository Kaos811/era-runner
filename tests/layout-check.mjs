// Static layout check (no browser): clear zones around gates, crates and wave spacing, Levels 1-12.
//   node tests/layout-check.mjs
import { buildLevel } from '../src/level.js';
import { WAVES } from '../src/tuning.js';
const R = WAVES.run;
let bad = 0;
for (let n = 1; n <= 12; n++) {
  const L = buildLevel(n);
  const gates = L.items.filter((i) => i.type === 'gate').map((i) => i.at);
  const crates = L.items.filter((i) => i.type === 'crate');
  const en = L.items.filter((i) => i.type === 'enemy' || i.type === 'block');
  let after = 1e9, before = 1e9, crateGap = 1e9, stacked = 0;
  for (const G of gates) for (const e of en) { const d = (e.arrive - G) / R; if (d >= 0) after = Math.min(after, d); else before = Math.min(before, -d); }
  for (const c of crates) for (const e of en) { const d = (c.at - e.arrive) / R; if (d >= 0 && d < 4) crateGap = Math.min(crateGap, d); if (d < 0 && d > -1) crateGap = -1; }
  for (let i = 0; i < en.length; i++) for (let j = i + 1; j < en.length; j++) if (Math.abs(en[i].arrive - en[j].arrive) < WAVES.inWave * R - 1 && Math.abs(en[i].x - en[j].x) < WAVES.minDx) stacked++;
  const ok = after >= WAVES.gateAfter - 0.05 && before >= WAVES.gateBefore - 0.05 && stacked === 0 && crateGap >= 0.8;
  if (!ok) bad++;
  console.log(`L${n} ${ok ? 'ok ' : 'BAD'} enemies ${en.length} chargers ${en.filter((e) => e.charger).length}  nearest arrival after a gate ${after.toFixed(2)}s, before ${before.toFixed(2)}s, before a crate ${crateGap.toFixed(2)}s  stacked pairs ${stacked}  overflow ${JSON.stringify(L.overflow)}`);
}
process.exit(bad ? 1 : 0);
