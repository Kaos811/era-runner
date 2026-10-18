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
const N = +(process.env.N || 10);
const summary = {};
for (const bot of ['smart', ...Array(N).fill('casual'), ...Array(N).fill('human'), null]) {
  const r = await page.evaluate((bot) => {
    const E = window.__ER; const s = E.scene;
    if (s.mode !== 'title') { s.mode = 'won'; }
    s.screen?.destroy(); s.screen = null; s.mode = 'won'; s.startRun(); E.setBot(bot);
    const st = E.sim(120);
    return { bot, ...st, need: s.level.need, secHP: s.level.sectionHP.map(Math.round) };
  }, bot);
  const sm = (summary[bot] ||= { runs: 0, wins: 0, future: 0, hp: [], futureAt: [], hurt: [0, 0, 0, 0, 0, 0] });
  sm.runs++; if (r.mode === 'won') { sm.wins++; sm.hp.push(Math.round(r.hp)); } if (r.era === 5) { sm.future++; sm.futureAt.push(Math.round(r.eraTimes[5])); }
  r.stats.hurtBySection.forEach((v, i) => { sm.hurt[i] += v; });
  if (process.env.QUIET) continue;
  console.log(JSON.stringify({ bot: r.bot, mode: r.mode, era: r.eraName, hp: Math.round(r.hp), t: r.time.toFixed(1), prog: (r.d / r.finish).toFixed(2), eraTimes: r.eraTimes.map((x) => x.toFixed(0)).join(','), rate: r.rate.toFixed(1), dmg: r.dmg.toFixed(1), shots: r.shots, ...r.stats, damage: Math.round(r.stats.damage) }));
}
for (const [b, sm] of Object.entries(summary)) console.log(`${b.padEnd(6)} wins ${sm.wins}/${sm.runs}  reachedFuture ${sm.future}/${sm.runs}  futureAt(s) ${sm.futureAt.join(',')}  hpLeftOnWins ${sm.hp.join(',')}  avgDamageTakenPerSection ${sm.hurt.map((v) => (v / sm.runs).toFixed(0)).join('/')}`);
const need = await page.evaluate(() => [__ER.scene.level.need, __ER.scene.level.sectionHP.map(Math.round)]);
console.log('need', JSON.stringify(need), 'errors', errors);
await browser.close(); srv.close();
