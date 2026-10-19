// Bonus run + coin economy: a fresh-save CAMPAIGN per bot (same spending rule as tune4.mjs).
// Reports per level: win rate, upgrades on arrival, coins per WIN (median), and the bonus-run
// multiplier reached (distribution), plus a fixed-upgrade sweep showing upgrades push the bonus up.
//   CAMPAIGNS=12 MAXLV=7 BOTS=human,casual,smart node tests/tune-bonus.mjs
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const srv = await serveDist();
const url = `http://localhost:${srv.address().port}/`;
const C = +(process.env.CAMPAIGNS || 12), MAXLV = +(process.env.MAXLV || 7), CAP = +(process.env.CAP || 60);
const bots = (process.env.BOTS || 'human,casual,smart').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
const dist = (a) => { const m = {}; a.forEach((v) => { m[v] = (m[v] || 0) + 1; }); return Object.keys(m).sort((x, y) => x - y).map((k) => `x${k}:${Math.round((100 * m[k]) / a.length)}%`).join(' '); };
for (const bot of bots) {
  const runs = [];
  for (let c = 0; c < C; c++) {
    runs.push(...await page.evaluate(([bot, MAXLV, CAP]) => {
      const E = window.__ER; const s = E.scene; const S = E.save;
      S.reset(); s.testUpg = null; s.noSave = true;
      const keys = ['dmg', 'rate', 'hp', 'xp'];
      const out = [];
      for (let i = 0; i < CAP && S.data.level <= MAXLV; i++) {
        const L = S.data.level;
        const upgN = keys.reduce((a, k) => a + S.data.upg[k], 0);
        s.closeScreen(); s.mode = 'won'; s.startRun(L); E.setBot(bot === 'null' ? null : bot); s.tx = 0;
        const st = E.sim(280);
        const r = s.lastResult || {};
        out.push({ L, won: st.mode === 'won', upgN, coins: st.stats.coins, mult: r.bonusMult || 0, bt: r.bonusTime || 0, tier: st.tier });
        for (;;) {
          const opts = keys.map((k) => { const u = E.upgrades.find((x) => x.key === k); return { u, lvl: S.data.upg[k], cost: E.upgCost(u, S.data.upg[k]) }; }).filter((o) => o.lvl < o.u.max && o.cost <= S.data.coins).sort((a, b) => a.cost - b.cost);
          if (!opts.length) break;
          S.data.coins -= opts[0].cost; S.data.upg[opts[0].u.key]++;
        }
      }
      return out;
    }, [bot, MAXLV, CAP]));
  }
  console.log(`\n== ${bot}: ${C} fresh-save campaigns`);
  for (let L = 1; L <= MAXLV; L++) {
    const a = runs.filter((r) => r.L === L); if (!a.length) continue;
    const w = a.filter((r) => r.won);
    console.log(`  L${L} win ${w.length}/${a.length} (${Math.round((100 * w.length) / a.length)}%)  upg ${med(a.map((r) => r.upgN))}  coins/win ${med(w.map((r) => r.coins))}  weapon2 ${Math.round((100 * a.filter((r) => r.tier % 2).length) / a.length)}%  bonus median x${med(w.map((r) => r.mult))} [${dist(w.map((r) => r.mult))}] bonus ${med(w.map((r) => +r.bt.toFixed(1)))}s`);
  }
  const w = runs.filter((r) => r.won);
  console.log(`  ALL wins ${w.length}/${runs.length}  coins/win median ${med(w.map((r) => r.coins))}  total coins ${runs.reduce((a, r) => a + r.coins, 0) / C | 0}/campaign  bonus median x${med(w.map((r) => r.mult))} [${dist(w.map((r) => r.mult))}]`);
}
// shop upgrades push the bonus up: fresh Level 1 human with fixed upgrade levels
if (!process.env.NOSWEEP) {
  console.log('\n== Level 1 human bot, bonus multiplier by shop upgrades (20 runs each)');
  for (const u of [0, 2, 4, 6]) {
    const r = await page.evaluate((u) => {
      const E = window.__ER; const s = E.scene; E.save.reset(); s.noSave = true; s.testUpg = { dmg: u, rate: u, hp: 0, xp: 0, coin: 0 };
      const out = [];
      for (let i = 0; i < 20; i++) { s.closeScreen(); s.mode = 'won'; s.startRun(1); E.setBot('human'); s.tx = 0; const st = E.sim(280); if (st.mode === 'won') out.push(s.lastResult.bonusMult || 0); }
      s.testUpg = null; return out;
    }, u);
    console.log(`  dmg+rate upgrades ${u}/${u}: wins ${r.length}/20  bonus median x${med(r)} [${dist(r)}]`);
  }
}
console.log('\nerrors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close(); srv.close();
