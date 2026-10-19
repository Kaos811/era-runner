// Stage 4 balance: a fresh-save CAMPAIGN per bot. The bot always plays the highest unlocked level,
// and after every run buys the cheapest of dmg/rate/hp/head-start it can afford (like a player who
// spends everything). Reports per-level win rate, upgrades owned on arrival, coins, run length,
// boss-fight length, and checkpoint rarity / loop stats.
//   CAMPAIGNS=8 MAXLV=9 BOTS=human,casual,smart node tests/tune4.mjs
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const srv = await serveDist();
const url = `http://localhost:${srv.address().port}/`;
const C = +(process.env.CAMPAIGNS || 8), MAXLV = +(process.env.MAXLV || 9), CAP = +(process.env.CAP || 60);
const bots = (process.env.BOTS || 'human,casual,smart').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
const BANDS = ['C', 'U', 'R', 'E', 'L'];
for (const bot of bots) {
  const runs = [];
  for (let c = 0; c < C; c++) {
    const r = await page.evaluate(([bot, MAXLV, CAP]) => {
      const E = window.__ER; const s = E.scene; const S = E.save;
      S.reset(); s.testUpg = null; s.noSave = true;
      const keys = ['dmg', 'rate', 'hp', 'xp'];
      const out = [];
      for (let i = 0; i < CAP && S.data.level <= MAXLV; i++) {
        const L = S.data.level;
        const upgN = keys.reduce((a, k) => a + S.data.upg[k], 0);
        s.closeScreen(); s.mode = 'won'; s.startRun(L); E.setBot(bot === 'null' ? null : bot); s.tx = 0;
        const st = E.sim(260);
        out.push({ L, won: st.mode === 'won', upgN, coins: st.stats.coins, bank: S.data.coins, t: st.time, bossT: st.boss ? st.boss.t : 0, reachedBoss: !!st.boss, tier: st.tier, era: st.era,
          cps: st.stats.checkpoints.map((k) => ({ pts: k.pts, band: k.bands[k.bands.length - 1], laps: k.laps })), crates: st.stats.crates, trail: [st.stats.trailGems, st.stats.trailMissed] });
        // spend: cheapest affordable first
        for (;;) {
          const opts = keys.map((k) => { const u = E.upgrades.find((x) => x.key === k); return { u, lvl: S.data.upg[k], cost: E.upgCost(u, S.data.upg[k]) }; }).filter((o) => o.lvl < o.u.max && o.cost <= S.data.coins).sort((a, b) => a.cost - b.cost);
          if (!opts.length) break;
          S.data.coins -= opts[0].cost; S.data.upg[opts[0].u.key]++;
        }
      }
      return out;
    }, [bot, MAXLV, CAP]);
    runs.push(...r);
  }
  console.log(`\n== ${bot}: ${C} fresh-save campaigns`);
  for (let L = 1; L <= MAXLV; L++) {
    const a = runs.filter((r) => r.L === L);
    if (!a.length) continue;
    const w = a.filter((r) => r.won);
    console.log(`  L${L} win ${w.length}/${a.length} (${Math.round((100 * w.length) / a.length)}%)  upgrades on arrival ${med(a.map((r) => r.upgN))}  coins/run ${med(a.map((r) => r.coins))}  ` +
      `run ${med(w.map((r) => Math.round(r.t)))}s (boss ${med(w.map((r) => Math.round(r.bossT)))}s)  weapon2 ${Math.round((100 * a.filter((r) => r.tier % 2 === 1).length) / a.length)}%  lost@boss ${a.filter((r) => !r.won && r.reachedBoss).length}`);
  }
  const cps = runs.flatMap((r) => r.cps.map((k, i) => ({ ...k, i })));
  for (const i of [0, 1, 2, 3, 4]) {
    const k = cps.filter((x) => x.i === i);
    const dist = BANDS.map((b, j) => `${b} ${Math.round((100 * k.filter((x) => !x.laps && x.band === j).length) / k.length)}%`).join(' ');
    console.log(`  checkpoint ${i + 1}: n=${k.length} pts median ${med(k.map((x) => Math.round(x.pts)))}  no-loop band: ${dist}  LOOPED ${Math.round((100 * k.filter((x) => x.laps).length) / k.length)}% (x2+: ${k.filter((x) => x.laps >= 1 && x.pts >= 0).length}, x3+: ${k.filter((x) => x.laps >= 2).length})`);
  }
  console.log(`  crate number median ${med(runs.flatMap((r) => r.crates))}  trail gems caught ${Math.round(100 * runs.reduce((a, r) => a + r.trail[0], 0) / Math.max(1, runs.reduce((a, r) => a + r.trail[0] + r.trail[1], 0)))}%`);
  const lv = Math.max(...runs.map((r) => r.L));
  console.log(`  total runs ${runs.length}, furthest level ${lv}`);
}
// fresh save, Level 1 only, every bot including no steering
console.log('\n== fresh save, Level 1 only (40 runs each)');
for (const bot of ['smart', 'casual', 'human', 'null']) {
  const r = await page.evaluate((bot) => {
    const E = window.__ER; const s = E.scene; E.save.reset(); s.noSave = true; s.testUpg = { dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 };
    const out = [];
    for (let i = 0; i < 40; i++) { s.closeScreen(); s.mode = 'won'; s.startRun(1); E.setBot(bot === 'null' ? null : bot); s.tx = 0; const st = E.sim(260); out.push({ won: st.mode === 'won', cps: st.stats.checkpoints.map((k) => k.bands[k.bands.length - 1] + (k.laps ? 'L' : '')), tier: st.tier, crates: st.stats.crates }); }
    s.testUpg = null; return out;
  }, bot);
  const cps = r.flatMap((x) => x.cps);
  console.log(`  ${bot.padEnd(7)} win ${r.filter((x) => x.won).length}/40  weapon2 ${r.filter((x) => x.tier === 1).length}/40  checkpoint results: ${['0', '1', '2', '3', '4'].map((b, i) => `${'CUREL'[i]} ${cps.filter((c) => c === b).length}`).join(' ')} loops ${cps.filter((c) => c.endsWith('L')).length} (of ${cps.length})  crate median ${med(r.flatMap((x) => x.crates))}`);
}
console.log('\nerrors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close(); srv.close();
