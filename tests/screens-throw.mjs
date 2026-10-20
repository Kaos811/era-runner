// Mid-throw screenshots: Thrown Rock (Level 1 start) and Sling, painted Stone Age
import { chromium } from 'playwright-core';
import { serveDist } from './serve.mjs';
import { resolve } from 'node:path';
const OUT = resolve(new URL('..', import.meta.url).pathname, 'screenshots');
const srv = await serveDist();
const url = `http://localhost:${srv.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__ER?.ready);
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const s = __ER.scene; s.closeScreen(); s.mode = 'won'; __ER.setTestUpgrades(null, true); s.startRun(1); __ER.setBot('smart'); });
await sleep(2500);
// pause the scene right after a throw starts
const grab = async (name, frac) => {
  for (let i = 0; i < 200; i++) { const u = await ev(() => { const s = __ER.scene; return s.throwAt == null ? 9 : (s.time - s.throwAt) / s.throwDur; }); if (u > frac && u < frac + 0.25) break; await sleep(15); }
  // freeze exactly at this point of the swing (polling latency would otherwise overshoot)
  await ev((frac) => { const s = __ER.scene; s.scene.pause(); s.throwAt = s.time - frac * s.throwDur; s.render(); }, frac + 0.12); await sleep(150);
  await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('saved', name);
  await ev(() => __ER.scene.scene.resume());
};
await grab('85-rock-mid-throw', 0.15);
await ev(() => { const s = __ER.scene; while (s.tier < 1) s.evolve(); });
await sleep(800);
await grab('86-sling-release', 0.3);
console.log('errors', errors.length ? errors : 'none');
await browser.close(); srv.close();
