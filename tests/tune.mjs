// Balance check: runs the level headlessly with a 'smart' and a 'casual' bot and prints results.
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
const srv = await serveDist();
const url = process.argv[2] || `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
for (const bot of ['smart', ...Array(10).fill('casual'), null]) {
  const r = await page.evaluate((bot) => {
    const E = window.__ER; const s = E.scene;
    if (s.mode !== 'title') { s.mode = 'won'; }
    s.screen?.destroy(); s.screen = null; s.mode = 'won'; s.startRun(); E.setBot(bot);
    const st = E.sim(120);
    return { bot, ...st, need: s.level.need, secHP: s.level.sectionHP.map(Math.round) };
  }, bot);
  console.log(JSON.stringify({ bot: r.bot, mode: r.mode, era: r.eraName, hp: Math.round(r.hp), t: r.time.toFixed(1), prog: (r.d / r.finish).toFixed(2), eraTimes: r.eraTimes.map((x) => x.toFixed(0)).join(','), rate: r.rate.toFixed(1), dmg: r.dmg.toFixed(1), shots: r.shots, ...r.stats, damage: Math.round(r.stats.damage) }));
}
const need = await page.evaluate(() => [__ER.scene.level.need, __ER.scene.level.sectionHP.map(Math.round)]);
console.log('need', JSON.stringify(need), 'errors', errors);
await browser.close(); srv.close();
