// Boss fairness check: drops each bot straight into each era's boss with that era's weapons and
// average gate boosts, and reports win rate and fight length. node tests/boss-check.mjs  (N=runs)
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const N = +(process.env.N || 20);
const srv = await serveDist();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => window.__ER?.ready);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
for (const bot of (process.env.BOTS || 'human,casual').split(',')) {
  for (let tier = 0; tier < 12; tier++) {
    const res = await page.evaluate(([bot, tier, N]) => {
      const E = window.__ER, s = E.scene; E.setTestUpgrades({}, true);
      const out = [];
      for (let i = 0; i < N; i++) {
        E.jumpToBoss(tier >> 1, { rate: 120, dmg: 120, extra: 3 }, tier); E.setBot(bot);
        const st = E.sim(80);
        out.push({ won: st.mode === 'won', t: st.boss ? st.boss.t : 0, hp: st.hp, name: st.boss?.name });
      }
      return out;
    }, [bot, tier, N]);
    const w = res.filter((r) => r.won);
    console.log(`${bot.padEnd(7)} tier ${String(tier).padStart(2)} ${res[0].name.padEnd(17)} wins ${w.length}/${N}  fight ${med(w.map((r) => +r.t.toFixed(1)))}s  hpLeft ${med(w.map((r) => Math.round(r.hp)))}`);
  }
}
await browser.close(); srv.close();
