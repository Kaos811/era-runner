// Stage 2 screenshots at phone size: title (coins + shop button), shop, boss fights, win screen.
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
import { resolve } from 'node:path';
const OUT = resolve(new URL('..', import.meta.url).pathname, 'screenshots');
const srv = await serveDist();
const url = process.argv[2] || `http://localhost:${srv.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
// a save that has played a few runs
await page.evaluate(() => { localStorage.setItem('eraRunner.save.v1', JSON.stringify({ coins: 1240, upg: { dmg: 2, rate: 1, hp: 1, xp: 0, coin: 0 }, best: { era: 5, wins: 3, runs: 7, bestCoins: 240, bossKills: [0, 0, 1, 0, 0, 2] }, music: true, sfx: true })); });
await page.reload();
await page.waitForFunction(() => window.__ER?.ready);
await sleep(700);
const tap = async (name) => { const p = await page.evaluate((n) => __ER.uiPoint(n), name); await page.touchscreen.tap(p.x, p.y); await sleep(400); };
const clear = () => page.evaluate(() => __ER.scene.children.list.filter((o) => o.type === 'Text' && /DRAG TO STEER/.test(o.text)).forEach((o) => o.destroy()));
const shot = async (n) => { await clear(); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('saved', n, JSON.stringify(await page.evaluate(() => { const s = __ER.state(); return { mode: s.mode, era: s.eraName, hp: Math.round(s.hp), boss: s.boss && { name: s.boss.name, hp: Math.round(s.boss.hp), max: s.boss.maxHp, phase: s.boss.phase } }; }))); };
await shot('30-title-coins-shop');
await tap('shop'); await shot('31-shop');
await tap('buy_rate'); await shot('32-shop-after-buy');
await tap('shopBack');
await tap('settings'); await shot('33-settings');
await tap('settingsClose');
await tap('play');
await page.evaluate(() => __ER.setBot('smart'));
for (const [era, name, t] of [[0, '34-boss-stone-mammoth', 3.2], [2, '35-boss-medieval-dragon', 4.4], [3, '36-boss-gunpowder-ship', 3.6], [5, '37-boss-future-robot', 5.0]]) {
  await page.evaluate((era) => { __ER.jumpToBoss(era); }, era);
  await page.evaluate((t) => __ER.sim(t, { visual: true }), t);
  await sleep(2600);
  await shot(name);
}
// finish the Future boss for the win screen
await page.evaluate(() => __ER.sim(40, { visual: true }));
await sleep(2600);
await shot('38-win-coins');
console.log('errors', errors);
await browser.close(); srv.close();
