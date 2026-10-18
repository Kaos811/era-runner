// End-to-end smoke test at a phone viewport (390x844, touch).
//   npm run build && npm test            -> tests the local dist/ build
//   node tests/e2e.mjs https://...        -> tests a deployed URL
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };

const srv = process.argv[2] ? null : await serveDist();
const url = process.argv[2] || `http://localhost:${srv.address().port}/`;
console.log('testing', url);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

try {
  const resp = await page.goto(url);
  check('page loads', resp.ok(), `HTTP ${resp.status()}`);
  await page.waitForFunction(() => window.__ER?.ready, null, { timeout: 30000 });
  await sleep(600);
  check('game boots to title screen', (await page.evaluate(() => __ER.state().mode)) === 'title');
  const box = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('canvas fills the phone screen', box.w >= 389 && box.h >= 843, `${box.w}x${box.h}`);

  // tap the TAP TO PLAY button (game y=790 in the 540x960 design space)
  const btn = await page.evaluate(() => { const c = __ER.scene.cameras.main; const r = document.querySelector('canvas').getBoundingClientRect(); const k = r.width / __ER.scene.scale.gameSize.width; return { x: (270 - c.worldView.x) * c.zoom * k + r.x, y: (790 - c.worldView.y) * c.zoom * k + r.y }; });
  await page.touchscreen.tap(btn.x, btn.y);
  await sleep(400);
  check('tap starts the run', (await page.evaluate(() => __ER.state().mode)) === 'play');

  // drag right with touch -> weapon steers right
  const cdp = await ctx.newCDPSession(page);
  const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await t('touchStart', 150, 700);
  for (let i = 1; i <= 10; i++) { await t('touchMove', 150 + i * 12, 700); await sleep(30); }
  await t('touchEnd');
  await sleep(500);
  const px = await page.evaluate(() => __ER.scene.tx);
  check('touch drag steers the weapon', px > 60, `target x ${px.toFixed(0)}`);

  await sleep(1500);
  const s1 = await page.evaluate(() => __ER.state());
  check('weapon auto-fires and the track scrolls', s1.d > 100 && s1.projs + s1.stats.damage > 0, `d=${s1.d.toFixed(0)} projs=${s1.projs}`);

  // fast-forward a full run with the auto-pilot and check the level can be finished
  const end = await page.evaluate(() => { __ER.setBot('smart'); return __ER.sim(120); });
  check('a good run reaches the finish', end.mode === 'won', `mode=${end.mode} era=${end.eraName} t=${end.time.toFixed(1)}s`);
  check('a good run evolves to the Future era', end.era === 5, `era times ${end.eraTimes.map((x) => x.toFixed(0)).join(',')}`);

  // retry, then stand still -> lose screen
  await page.evaluate(() => { __ER.scene.startRun(); __ER.setBot(null); __ER.scene.tx = 0; });
  const lost = await page.evaluate(() => __ER.sim(120));
  check('doing nothing loses (health reaches 0)', lost.mode === 'lost' && lost.hp === 0, `d=${(lost.d / lost.finish * 100).toFixed(0)}%`);
  await sleep(500);

  await ctx.close();
  // desktop: mouse click to start and mouse drag to steer
  const dpage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  dpage.on('pageerror', (e) => errors.push('desktop: ' + e.message));
  await dpage.goto(url);
  await dpage.waitForFunction(() => window.__ER?.ready, null, { timeout: 30000 });
  await sleep(500);
  const dbtn = await dpage.evaluate(() => { const c = __ER.scene.cameras.main; const r = document.querySelector('canvas').getBoundingClientRect(); const k = r.width / __ER.scene.scale.gameSize.width; return { x: (270 - c.worldView.x) * c.zoom * k + r.x, y: (790 - c.worldView.y) * c.zoom * k + r.y }; });
  await dpage.mouse.click(dbtn.x, dbtn.y);
  await sleep(400);
  await dpage.mouse.move(640, 600); await dpage.mouse.down();
  for (let i = 1; i <= 10; i++) { await dpage.mouse.move(640 - i * 12, 600); await sleep(30); }
  await dpage.mouse.up(); await sleep(300);
  const dst = await dpage.evaluate(() => ({ mode: __ER.state().mode, tx: __ER.scene.tx }));
  check('desktop: mouse click starts, mouse drag steers', dst.mode === 'play' && dst.tx < -60, `mode=${dst.mode} x=${dst.tx.toFixed(0)}`);
  check('no console errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('test ran without exceptions', false, e.message);
}
await browser.close();
srv?.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
