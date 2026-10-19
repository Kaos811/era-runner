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


// 80) bonus run mid-way: multiplier rows, BEST marker (Level 2, best x3 saved)
await start(2, 'casual');
await ev(() => { __ER.scene.hp = __ER.scene.maxHp = 400; });
await until('!!s.boss', 200);
await ev(() => __ER.givePowerup('double'));
await until('!!s.bonus && s.bonus.broken >= 2 && s.bonus.rows.some((r) => r.bestT && !r.dead && r.z < 1100)', 60);
await vis(0.05); await sleep(120);
await shot('80-bonus-run-rows');
// 81) bonus result: coin count-up with the multiplier stamp
await ev(() => __ER.sim(15));
await sleep(2700);
await shot('81-bonus-result-countup');
console.log('result', JSON.stringify(await ev(() => { const r = __ER.scene.lastResult; return { mult: r.bonusMult, raw: r.coinsRaw, coins: r.coins, t: r.bonusTime, best: r.bonusBest }; })));
// 82) HUD year counter with a +YRS popup (Level 1, real-time play)
await start(1);
await until('s.d > 2600', 30);
for (let i = 0; i < 200 && !(await ev(() => __ER.scene.yrsPops.length && __ER.scene.yrsPops[0].alpha > 0.6)); i++) await sleep(50);
await shot('82-year-counter-popup');
console.log('year', await ev(() => __ER.scene.yearText.text), await ev(() => __ER.scene.yrsPops.map((t) => t.text)));
console.log('errors', errors.length ? errors : 'none');
await browser.close(); srv.close();
