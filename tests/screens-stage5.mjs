// Stage 5 screenshots at phone size: gem crate, trail, arch meter, slow-mo card, twin weapon,
// damage numbers, boss fight.
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
await page.evaluate(() => { localStorage.setItem('eraRunner.save.v1', JSON.stringify({ v: 3, level: 6, coins: 300, upg: { dmg: 2, rate: 2, hp: 1, xp: 1, coin: 0 }, best: { era: 5, tier: 10, level: 5, wins: 5, runs: 9, bestCoins: 240, bossKills: [1, 1, 1, 1, 1, 0] }, music: true, sfx: true })); });
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

// 1) crate being shot (Level 2), 2) bursting into a trail, 3) gems flying into the arch meter
await start(2);
await until("s.objs.some((o) => o.type === 'crate' && !o.used && o.z < 1000)");
await vis(1.1); await sleep(300);
await shot('70-crate-being-shot');
await until("s.objs.some((o) => o.type === 'crate' && !o.used && o.z < 120)", 10);
await vis(0.35); await sleep(150);
await shot('71-crate-burst-trail');
await vis(1.6); await sleep(120);
await shot('72-gems-to-arch-meter');
// 4) slow-mo card reveal at the arch
await until("(() => { const a = s.nextArch(); return a && a.z < 260; })()", 20);
for (let i = 0; i < 300 && (await ev(() => __ER.scene.revealFace)) < 0; i++) await sleep(40);
await sleep(300);
await shot('73-slowmo-card-reveal');
for (let i = 0; i < 300 && (await ev(() => __ER.state().paused)); i++) await sleep(100);
// 5) Twin Weapon + barrels + piercing tip, 6) damage numbers (Level 4)
await start(4);
await ev(() => { ['twin', 'extra', 'pierce'].forEach((id) => __ER.givePowerup(id)); });
await until("s.d > 3000");
await ev(() => { const s = __ER.scene; s.hp = s.maxHp; });
await vis(1.0); await sleep(250);
await shot('74-twin-weapon-active');
await until("s.d > 9300", 30);
await ev(() => { __ER.givePowerup('chain'); __ER.givePowerup('boom'); });
await vis(0.9); await sleep(200);
await shot('75-damage-numbers');
// 7) boss fight (Level 3 dragon) with twin weapon
await ev(() => { __ER.jumpToBoss(2, { rate: 30, dmg: 30, extra: 1 }, 5, 3); __ER.givePowerup('twin'); __ER.setBot('smart'); });
await vis(6); await sleep(500);
await shot('76-boss-fight-twin');
console.log('errors', errors.length ? errors : 'none');
await browser.close(); srv.close();
