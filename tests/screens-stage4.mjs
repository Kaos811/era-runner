// Stage 4 screenshots at phone size: level select, checkpoint meter, reveals, power-ups, boss, unlock.
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
// a Stage 3 (v2) save that beat the Mammoth, Chariot and Dragon -> Level 4 unlocked
await page.evaluate(() => { localStorage.setItem('eraRunner.save.v1', JSON.stringify({ v: 2, coins: 640, upg: { dmg: 2, rate: 2, hp: 1, xp: 1, coin: 0 }, best: { era: 3, tier: 6, wins: 4, runs: 9, bestCoins: 240, bossKills: [1, 2, 1, 0, 0, 0] }, music: true, sfx: true })); });
await page.reload();
await page.waitForFunction(() => window.__ER?.ready);
await sleep(700);
const clear = () => page.evaluate(() => { const s = __ER.scene; s.children.list.filter((o) => o.type === 'Text' && /DRAG TO STEER/.test(o.text)).forEach((o) => o.destroy()); if (s.bannerC?.active && s.time > 3) s.bannerC.destroy(); });
const shot = async (n) => { await clear(); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('saved', n, JSON.stringify(await page.evaluate(() => { const s = __ER.state(); return { mode: s.mode, L: s.level, era: s.eraName, weapon: s.weapon, meter: Math.round(s.meter), band: s.band, lap: s.lap, pu: s.powerups, boss: s.boss && { name: s.boss.name, hp: Math.round(s.boss.hp), max: s.boss.maxHp } }; }))); };
const ev = (f, a) => page.evaluate(f, a);
await shot('50-title-level-select');
// mid-run HUD with a part-filled meter (smart bot, Level 4)
await ev(() => { const E = __ER, s = E.scene; s.closeScreen(); s.mode = 'won'; s.startRun(4); E.setBot('smart'); E.sim(32); });
await ev(() => __ER.sim(1.2, { visual: true })); await sleep(900);
await shot('51-hud-meter-mid-run');
// common reveal: almost empty meter, run into the gate in real time
// names[0]: the gate ahead (or null); names[1..]: shot when card i's face is showing
const reveal = async (meter, names) => {
  await ev(([m]) => { const E = __ER, s = E.scene; E.toCheckpoint(0, m, 260); s.hp = s.maxHp; }, [meter]);
  await sleep(350);
  if (names[0]) await shot(names[0]);
  for (let c = 1; c < names.length; c++) {
    for (let i = 0; i < 500 && (await ev(() => __ER.scene.revealFace)) < c - 1; i++) await sleep(40);
    await sleep(320);
    await shot(names[c]);
  }
  for (let i = 0; i < 300 && (await ev(() => __ER.state().paused)); i++) await sleep(100);
};
await ev(() => { const E = __ER, s = E.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); E.setBot('smart'); E.sim(5); });
await reveal(2, ['52-checkpoint-gate-ahead', '53-reveal-common']);
// legendary loop: meter wrapped once (x2) + some -> Legendary + Rare
await ev(() => { const E = __ER, s = E.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); E.setBot('smart'); E.sim(5); });
await ev(() => { __ER.scene.meter = __ER.LAP + 12; __ER.scene.updateHud(true); });
await ev(() => { const E = __ER; E.toCheckpoint(0, null, 1300); E.sim(0.6, { visual: true }); }); await sleep(300);
await shot('54-meter-looped-x2');
await reveal(null, [null, '55-reveal-legendary-loop', '56-reveal-loop-second-card']);
// power-ups in action
const action = async (L, ids, d, name, pre) => {
  await ev(([L, ids, d]) => {
    const E = __ER, s = E.scene; s.closeScreen(); s.mode = 'won'; s.startRun(L); E.setBot('smart');
    s.simulating = true; while (s.d < d && s.mode === 'play') { s.botSteer(1 / 60); s.step(1 / 60); } s.simulating = false;
    ids.forEach((id) => E.givePowerup(id)); s.hp = s.maxHp;
    s.gems.forEach((g) => { g.img?.destroy(); g.img = null; });
    s.setEraVisuals(s.era, true); s.weaponImg.setTexture('weapon_' + s.weapon.key); s.updateHud(true);
  }, [L, ids, d]);
  if (pre) await ev(pre);
  await ev(() => __ER.sim(1.0, { visual: true })); await sleep(700);
  await shot(name);
};
await action(3, ['blades', 'blades', 'chain', 'chain', 'pierce'], 5200, '57-powerups-blades-chain');
// chain lightning: step in small visual slices until a zap fires, shoot right away
await ev(() => { const s = __ER.scene; s.givePu = 1; __ER.givePowerup('chain'); __ER.givePowerup('chain'); });
for (let i = 0; i < 40; i++) {
  const z = await ev(() => { const s = __ER.scene; const z0 = s.stats.zaps || 0; __ER.sim(0.05, { visual: true }); return (s.stats.zaps || 0) > z0; });
  if (z) { await sleep(40); await shot('57b-powerup-chain-lightning'); break; }
  await sleep(30);
}
await action(5, ['drone', 'drone', 'boom', 'double'], 14000, '58-powerups-drone-explosive-double');
await action(6, ['nova', 'shield', 'big'], 6500, '59-powerup-shield-heavy-ammo');
await ev(() => { __ER.scene.puT.nova = 99; __ER.sim(0.05, { visual: true }); }); await sleep(120);
await shot('59b-powerup-nova-blast');
// Level 1 Mammoth boss and the level-complete / unlock screen on a fresh save
await ev(() => { __ER.save.reset(); __ER.jumpToBoss(0, { rate: 30, dmg: 30, extra: 1 }, 1, 1); __ER.givePowerup('blades'); __ER.setBot('smart'); __ER.sim(6.5, { visual: true }); });
await sleep(800);
await shot('60-level1-mammoth-boss');
await ev(() => __ER.sim(80)); await sleep(1600);
await shot('61-level-complete-unlock');
await ev(() => { const s = __ER.scene; s.selLevel = 2; s.closeScreen(); s.mode = 'won'; s.showTitle(); }); await sleep(600);
await shot('62-title-level2-unlocked');
console.log('errors', errors.length ? errors : 'none');
await browser.close(); srv.close();
