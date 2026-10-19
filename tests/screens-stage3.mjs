// Stage 3 screenshots at phone size: 12-weapon title lineup, tier-upgrade banner, new weapons in
// action, and boss fights reached naturally (bots playing a fresh save).
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
// a Stage 2 (v1) save: no weapon tiers yet -> migrates to best tier 7 (Cannon)
await page.evaluate(() => { localStorage.setItem('eraRunner.save.v1', JSON.stringify({ coins: 860, upg: { dmg: 2, rate: 1, hp: 1, xp: 0, coin: 0 }, best: { era: 3, wins: 3, runs: 7, bestCoins: 240, bossKills: [0, 0, 1, 2, 0, 0] }, music: true, sfx: true })); });
await page.reload();
await page.waitForFunction(() => window.__ER?.ready);
await sleep(700);
const clear = () => page.evaluate(() => __ER.scene.children.list.filter((o) => o.type === 'Text' && /DRAG TO STEER/.test(o.text)).forEach((o) => o.destroy()));
const shot = async (n) => { await clear(); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('saved', n, JSON.stringify(await page.evaluate(() => { const s = __ER.state(); return { mode: s.mode, era: s.eraName, weapon: s.weapon, tier: s.tier, xp: Math.round(s.xp), boss: s.boss && { name: s.boss.name, hp: Math.round(s.boss.hp), max: s.boss.maxHp } }; }))); };
console.log('migrated save', JSON.stringify(await page.evaluate(() => __ER.save.data)));
await shot('40-title-12-weapons');
const p = await page.evaluate(() => __ER.uiPoint('play'));
await page.touchscreen.tap(p.x, p.y);
await sleep(300);
await page.evaluate(() => __ER.setBot('smart'));
// thrown rock at the start of a run
await page.evaluate(() => __ER.sim(4.5, { visual: true }));
await sleep(900);
await shot('41-weapon-thrown-rock');
// tier step inside the Stone Age: rock -> sling
await page.evaluate(() => { const s = __ER.scene; s.gainXp(s.level.need[s.tier] - s.xp + 0.5); });
await sleep(450);
await shot('42-tier-upgrade-banner');
// weapons in action: fast-forward to a section, set a weapon, play a moment visually
const weaponAt = async (tier, d, name) => {
  await page.evaluate(([tier, d]) => {
    const E = __ER, s = E.scene;
    s.simulating = true;
    while (s.d < d && s.mode === 'play') { s.botSteer(1 / 60); s.step(1 / 60); }
    s.simulating = false;
    s.tier = tier; s.rateB = 60; s.dmgB = 60; s.extra = 2; s.hp = s.maxHp;
    s.setEraVisuals(s.era, true); s.weaponImg.setTexture('weapon_' + s.weapon.key); s.updateHud(true);
    s.gems.forEach((g) => { g.img?.destroy(); g.img = null; });
    s.objs.forEach((o) => o.c.setVisible(true));
  }, [tier, d]);
  await page.evaluate(() => __ER.sim(1.4, { visual: true }));
  await sleep(1100);
  await shot(name);
};
await weaponAt(5, 900 + 2 * 4600 + 1500, '43-weapon-repeating-crossbow');
await weaponAt(6, 900 + 3 * 4600 + 1400, '44-weapon-musket');
await weaponAt(11, 900 + 5 * 4600 + 1200, '45-weapon-plasma-cannon');
// natural boss fights: a fresh save played by a bot until the boss shows up
const natural = async (bot, wantEra, name, tries = 12) => {
  const got = await page.evaluate(([bot, wantEra, tries]) => {
    const E = __ER, s = E.scene;
    E.setTestUpgrades({ dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 }, true);
    for (let i = 0; i < tries; i++) {
      s.closeScreen(); s.mode = 'won'; s.startRun(); E.setBot(bot); s.tx = 0;
      s.simulating = true;
      while (!s.boss && s.mode === 'play') { s.botSteer(1 / 60); s.step(1 / 60); }
      s.simulating = false;
      if (s.boss && s.era === wantEra) break;
    }
    s.setEraVisuals(s.era, true); s.weaponImg.setTexture('weapon_' + s.weapon.key); s.updateHud(true);
    if (s.boss) { s.showBossBar(true); s.boss.obj.c.setVisible(true); }
    E.setTestUpgrades(null, true);
    return { era: s.era, tier: s.tier, boss: s.boss?.def.name };
  }, [bot, wantEra, tries]);
  console.log(name, JSON.stringify(got));
  await page.evaluate(() => __ER.sim(3.2, { visual: true }));
  await sleep(2200);
  await shot(name);
};
await natural('human', 3, '46-boss-natural-galleon');
await natural('casual', 4, '47-boss-natural-tank');
console.log('errors', errors);
await browser.close(); srv.close();
