import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const srv = await serveDist();
const url = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
const lv = (process.env.LV || '1').split(',').map(Number);
for (const L of lv) for (const bot of (process.env.BOTS || 'human,smart').split(',')) {
  const r = await page.evaluate(([L, bot]) => {
    const E = window.__ER; const s = E.scene;
    E.setTestUpgrades({ dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 }, true);
    const out = [];
    for (let i = 0; i < 4; i++) {
      s.closeScreen(); s.mode = 'won'; s.startRun(L); E.setBot(bot); s.tx = 0;
      const st = E.sim(240);
      out.push({ mode: st.mode, lvl: st.level, tier: st.tier, t: Math.round(st.time ?? 0), boss: st.boss ? [Math.round(st.boss.t), Math.round(st.boss.hp), Math.round(st.boss.maxHp)] : null, cps: st.stats.checkpoints.map((c) => `${Math.round(c.pts)}:${c.bands.join('')}${c.laps ? 'L' + c.laps : ''}`), pu: st.powerups, coins: st.stats.coins });
    }
    return out;
  }, [L, bot]);
  console.log('L' + L, bot); r.forEach((x) => console.log('  ', JSON.stringify(x)));
}
console.log('errors', errors);
await browser.close(); srv.close();
