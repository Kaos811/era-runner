// Bonus run + year counter screenshots at phone size.
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ER?.ready);
await page.evaluate(() => { localStorage.setItem('eraRunner.save.v1', JSON.stringify({ v: 3, level: 6, coins: 300, upg: { dmg: 2, rate: 2, hp: 1, xp: 1, coin: 0 }, best: { era: 5, tier: 10, level: 5, wins: 5, runs: 9, bestCoins: 240, bossKills: [1, 1, 1, 1, 1, 0] }, bonusBest: { 2: 4 }, music: true, sfx: true })); });
await page.reload();
await page.waitForFunction(() => window.__ER?.ready);
await sleep(600);
const ev = (f, a) => page.evaluate(f, a);
const clear = () => ev(() => { const s = __ER.scene; s.children.list.filter((o) => o.type === 'Text' && /DRAG TO STEER/.test(o.text)).forEach((o) => o.destroy()); if (s.bannerC?.active && s.time > 3) s.bannerC.destroy(); });
const shot = async (n) => { await clear(); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('saved', n, JSON.stringify(await ev(() => { const s = __ER.state(); return { L: s.level, weapon: s.weapon, meter: Math.round(s.meter), band: s.band, pu: s.powerups, crates: s.stats.crates, boss: s.boss && Math.round(s.boss.hp) }; }))); };
// fast-forward (headless) until cond(scene) is true
const until = (cond, max = 120) => ev(([c, max]) => { const s = __ER.scene; const f = new Function('s', 'return ' + c); s.simulating = true; let t = 0; while (!f(s) && t < max && s.mode === 'play') { if (s.bot) s.botSteer(1 / 60); s.step(1 / 60); t += 1 / 60; } s.simulating = false; s.refreshWeaponLook(); s.refreshPuIcons(); s.setEraVisuals(s.era, true); s.updateHud(true); return t; }, [cond, max]);
const vis = (sec) => ev((sec) => __ER.sim(sec, { visual: true }), sec);
const start = (L, bot = 'smart') => ev(([L, bot]) => { const s = __ER.scene; s.closeScreen(); s.mode = 'won'; __ER.setTestUpgrades(null, true); s.startRun(L); __ER.setBot(bot); }, [L, bot]);

// 90) Level 8 (loop 2): a gate coming up with the clear zone behind it, the next wave further back
await start(8, 'smart');
await ev(() => { __ER.scene.hp = __ER.scene.maxHp = 600; });
await until('s.objs.some((o) => o.type === "gate" && !o.pair.used && o.z < 560 && o.z > 400 && s.levelN === 8 && s.d > 14800 && !(s.pauseT > 0))', 120);
await vis(0.05); await sleep(150);
await shot('90-gate-clear-zone-L8');
// 91) Level 10: a charger marking your lane (red), with a spread wave
await start(10, 'smart');
await ev(() => { __ER.scene.hp = __ER.scene.maxHp = 600; __ER.setBot(null); });
await until('s.objs.some((o) => o.ch && o.ch.phase === "aim" && o.ch.t > 0.3)', 120);
await vis(0.02); await sleep(150);
await shot('91-charger-telegraph-L10');
console.log('errors', errors.length ? errors : 'none');
await browser.close(); srv.close();
