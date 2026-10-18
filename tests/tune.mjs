// Balance check: plays the whole level (including the boss) headlessly with auto-pilot bots.
//   node tests/tune.mjs            N=runs per bot (default 20), UPG=fresh|all presets
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const srv = await serveDist();
const url = `http://localhost:${srv.address().port}/`;
const N = +(process.env.N || 20);
const PRESETS = {
  fresh: { dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 },
  '3 upgrades': { dmg: 1, rate: 1, hp: 1, xp: 0, coin: 0 },
  '6 upgrades': { dmg: 2, rate: 2, hp: 2, xp: 0, coin: 0 },
  '10 upgrades': { dmg: 3, rate: 3, hp: 3, xp: 1, coin: 0 },
  '20 upgrades': { dmg: 6, rate: 6, hp: 5, xp: 3, coin: 0 },
};
const presets = (process.env.UPG || 'fresh').split(',').flatMap((p) => (p === 'all' ? Object.keys(PRESETS) : [p]));
const bots = (process.env.BOTS || 'smart,casual,human,null').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
for (const preset of presets) {
  console.log(`\n== upgrades: ${preset} ${JSON.stringify(PRESETS[preset])}`);
  for (const bot of bots) {
    const runs = bot === 'smart' || bot === 'null' ? Math.min(5, N) : N;
    const res = await page.evaluate(([bot, runs, upg]) => {
      const E = window.__ER; const s = E.scene;
      E.setTestUpgrades(upg, true);
      const out = [];
      for (let i = 0; i < runs; i++) {
        s.closeScreen(); s.mode = 'won'; s.startRun(); E.setBot(bot === 'null' ? null : bot); s.tx = 0;
        const st = E.sim(200);
        out.push({ won: st.mode === 'won', era: st.era, reachedBoss: !!st.boss, bossT: st.boss ? st.boss.t : 0, bossHpLeft: st.boss ? st.boss.hp / st.boss.maxHp : 1,
          hp: st.hp, coins: st.stats.coins, dps: st.stats.bossDps, hpAtBoss: st.stats.hpAtBoss, futureAt: st.eraTimes[5], bossDmg: st.stats.bossDamageTaken || 0 });
      }
      return out;
    }, [bot, runs, PRESETS[preset]]);
    const wins = res.filter((r) => r.won);
    const lostAtBoss = res.filter((r) => !r.won && r.reachedBoss).length;
    const eras = res.map((r) => r.era);
    console.log(`${(bot || 'null').padEnd(7)} wins ${wins.length}/${runs} (${Math.round((wins.length / runs) * 100)}%)  lost-to-boss ${lostAtBoss}  lost-on-track ${runs - wins.length - lostAtBoss}  ` +
      `boss-fight-s(median win) ${med(wins.map((r) => +r.bossT.toFixed(1)))}  era@end ${[0, 1, 2, 3, 4, 5].map((e) => eras.filter((x) => x === e).length).join('/')}  ` +
      `dps@boss median ${med(res.map((r) => Math.round(r.dps || 0)))} min ${Math.min(...res.map((r) => Math.round(r.dps || 0)))}  coins/run median ${med(res.map((r) => r.coins))}  hpLeft(median win) ${med(wins.map((r) => Math.round(r.hp)))}`);
  }
}
console.log('\nerrors', errors.length ? errors : 'none');
await browser.close(); srv.close();
