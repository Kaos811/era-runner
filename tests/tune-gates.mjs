// Gate clear zones / wave spacing / chargers: a fresh-save CAMPAIGN per bot (same spending rule as
// tune4.mjs) up to MAXLV, reporting per level: win rate, hits taken per run, hits taken within
// AFTER s of passing a gate, and enemies sitting close behind a gate (z < 700) when you pass it.
//   CAMPAIGNS=10 MAXLV=10 BOTS=human,casual,smart node tests/tune-gates.mjs
//   DIST_DIR=/tmp/dist-before ... measures an older build
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const srv = await serveDist();
const url = `http://localhost:${srv.address().port}/`;
const C = +(process.env.CAMPAIGNS || 10), MAXLV = +(process.env.MAXLV || 10), CAP = +(process.env.CAP || 70), AFTER = +(process.env.AFTER || 2.5);
const bots = (process.env.BOTS || 'human,casual,smart').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-');
const all = {};
for (const bot of bots) {
  const runs = [];
  for (let c = 0; c < C; c++) {
    runs.push(...await page.evaluate(([bot, MAXLV, CAP, AFTER]) => {
      const E = window.__ER; const s = E.scene; const S = E.save;
      if (!s.__gateProbe) {
        s.__gateProbe = true;
        const tg = s.takeGate.bind(s), hu = s.hurt.bind(s);
        s.takeGate = (pair) => { const g = s.__g; g.lastGate = s.time; g.gates++; const near = s.objs.filter((o) => (o.type === 'enemy' || o.type === 'block') && !o.dead && o.z > 0); g.shadow += near.filter((o) => o.z < 700).length; g.shadow5 += near.filter((o) => o.z < 500).length; return tg(pair); };
        s.hurt = (a) => { const g = s.__g; if (!s.boss && !s.bonus) { g.hits++; if (s.time - g.lastGate < AFTER) g.near++; if (s.time - g.lastGate < 1.5) g.near15++; } return hu(a); };
      }
      S.reset(); s.testUpg = null; s.noSave = true;
      const keys = ['dmg', 'rate', 'hp', 'xp'];
      const out = [];
      for (let i = 0; i < CAP && S.data.level <= MAXLV; i++) {
        const L = S.data.level;
        s.closeScreen(); s.mode = 'won'; s.startRun(L); E.setBot(bot); s.tx = 0;
        s.__g = { lastGate: -99, gates: 0, shadow: 0, shadow5: 0, hits: 0, near: 0, near15: 0 };
        const st = E.sim(280);
        const g = s.__g;
        out.push({ L, won: st.mode === 'won', boss: !!st.boss, hits: g.hits, near: g.near, near15: g.near15, shadow: g.shadow, shadow5: g.shadow5, coins: st.stats.coins, chargers: st.stats.chargers || 0, gates: g.gates, hp: st.hp, maxHp: st.maxHp });
        for (;;) {
          const opts = keys.map((k) => { const u = E.upgrades.find((x) => x.key === k); return { u, lvl: S.data.upg[k], cost: E.upgCost(u, S.data.upg[k]) }; }).filter((o) => o.lvl < o.u.max && o.cost <= S.data.coins).sort((a, b) => a.cost - b.cost);
          if (!opts.length) break;
          S.data.coins -= opts[0].cost; S.data.upg[opts[0].u.key]++;
        }
      }
      return out;
    }, [bot, MAXLV, CAP, AFTER]));
  }
  all[bot] = runs;
  console.log(`\n== ${bot}: ${C} fresh-save campaigns (hits = run hits before the boss; near = within ${AFTER}s after a gate)`);
  for (let L = 1; L <= MAXLV; L++) {
    const a = runs.filter((r) => r.L === L); if (!a.length) continue;
    const w = a.filter((r) => r.won);
    console.log(`  L${String(L).padEnd(2)} win ${String(w.length).padStart(2)}/${String(a.length).padEnd(2)} (${String(Math.round((100 * w.length) / a.length)).padStart(3)}%)  hits/run ${avg(a.map((r) => r.hits))}  near-gate hits/run ${avg(a.map((r) => r.near))} (<1.5s ${avg(a.map((r) => r.near15))})  behind gate <700/<500 ${avg(a.map((r) => r.shadow))}/${avg(a.map((r) => r.shadow5))}  lost@boss ${a.filter((r) => !r.won && r.boss).length}  coins/win ${med(w.map((r) => r.coins))}  chargers ${avg(a.map((r) => r.chargers))}`);
  }
  console.log(`  ALL: runs ${runs.length}  hits/run ${avg(runs.map((r) => r.hits))}  near-gate hits/run ${avg(runs.map((r) => r.near))}  (${Math.round(100 * runs.reduce((x, r) => x + r.near, 0) / Math.max(1, runs.reduce((x, r) => x + r.hits, 0)))}% of hits)  (<1.5s ${avg(runs.map((r) => r.near15))})  behind gate <700/<500 ${avg(runs.map((r) => r.shadow))}/${avg(runs.map((r) => r.shadow5))}  coins/win ${med(runs.filter((r) => r.won).map((r) => r.coins))}  furthest L${Math.max(...runs.map((r) => r.L))}`);
}
console.log('\nerrors', errors.length ? errors.slice(0, 5) : 'none');
if (process.env.JSON) (await import('node:fs')).writeFileSync(process.env.JSON, JSON.stringify(all));
await browser.close(); srv.close();
