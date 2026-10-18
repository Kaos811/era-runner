// Screenshots for the spacing + gate-shooting changes: node tests/screens-feedback.mjs
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
import { resolve } from 'node:path';
const OUT = resolve(new URL('..', import.meta.url).pathname, 'screenshots');
const srv = await serveDist();
const url = process.argv[2] || `http://localhost:${srv.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
await sleep(500);
const info = () => page.evaluate(() => { const s = __ER.state(); const gs = __ER.scene.objs.filter((o) => o.type === 'gate').map((o) => `${o.gate.kind}:${Math.round(o.gate.value)}@${Math.round(o.z)}`); return { era: s.eraName, t: s.time.toFixed(1), hp: Math.round(s.hp), enemies: __ER.scene.objs.filter((o) => o.type === 'enemy').length, gates: gs.join(' ') }; });
const clearHints = () => page.evaluate(() => { __ER.scene.bannerC?.destroy(); return __ER.scene.children.list.filter((o) => o.type === 'Text' && /DRAG TO STEER/.test(o.text)).forEach((o) => o.destroy()); });
const shot = async (n) => { await clearHints(); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('saved', n, JSON.stringify(await info())); };

await page.evaluate(() => { __ER.start(); __ER.setBot('casual'); });
// Dense mid-game stretch (Medieval swarm + 3-pack), approached in real time
// fast-forward to the busiest moment of the early/mid game (most enemies on screen at once)
const busy = async (from, to, name) => {
  await page.evaluate(([from, to]) => {
    const s = __ER.scene; s.mode = 'won'; s.startRun(); __ER.setBot('casual');
    let best = 0, bestT = from; s.simulating = true;
    for (let i = 0; s.time < to && s.mode === 'play'; i++) { s.botSteer(1 / 60); s.step(1 / 60); const n = s.objs.filter((o) => o.type === 'enemy' && !o.dead && o.z < 1500).length; if (s.time > from && n > best) { best = n; bestT = s.time; } }
    s.simulating = false; s.mode = 'won'; s.startRun(); __ER.setBot('casual');
    __ER.sim(bestT - 0.4);
  }, [from, to]);
  await sleep(1500); await shot(name);
};
await busy(15, 30, '20-dense-bronze');
await busy(30, 45, '21-dense-medieval');

// Gate being shot: steer at the WORSE gate of the next pair (red) and keep firing into it
await page.evaluate(() => { __ER.scene.mode = 'won'; __ER.scene.startRun(); __ER.setBot(null); });
// step the game while steering at the red gate; stop when the gate reaches distance `zStop`
const aimRed = (zStop) => page.evaluate((zStop) => {
  const s = __ER.scene;
  for (let i = 0; i < 60 * 40 && s.mode === 'play'; i++) {
    const red = s.objs.find((o) => o.type === 'gate' && !o.pair.used && o.z < 1800 && (o.redStart !== undefined || o.gate.value < 0));
    if (red) { red.redStart ??= red.gate.value; s.tx = red.x; if (red.z < zStop) return { start: red.redStart, now: Math.round(red.gate.value) }; }
    s.step(1 / 60);
  }
}, zStop);
console.log('red gate', JSON.stringify(await aimRed(1000)));
await sleep(900); await shot('22-gate-being-shot');
console.log('red gate', JSON.stringify(await aimRed(380)));
await sleep(900); await shot('23-gate-turned-green');
// same thing a few eras later (more shots, faster growth)
await page.evaluate(() => { const s = __ER.scene; s.mode = 'won'; s.startRun(); __ER.setBot('smart'); __ER.sim(31); __ER.setBot(null); });
console.log('red gate', JSON.stringify(await aimRed(1000)));
console.log('red gate', JSON.stringify(await aimRed(560)));
await sleep(900); await shot('24-gate-shot-later-era');
console.log('errors', errors);
await browser.close(); srv.close();
