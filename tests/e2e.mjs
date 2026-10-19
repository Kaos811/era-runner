// End-to-end tests at a phone viewport (390x844, touch).
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
const ready = () => page.waitForFunction(() => window.__ER?.ready, null, { timeout: 30000 });
const ui = (name) => page.evaluate((n) => __ER.uiPoint(n), name);
const tap = async (name) => { const p = await ui(name); if (!p) throw new Error('no button ' + name); await page.touchscreen.tap(p.x, p.y); await sleep(350); };
const state = () => page.evaluate(() => __ER.state());
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('eraRunner.save.v1') || 'null'));

try {
  const resp = await page.goto(url);
  check('page loads', resp.ok(), `HTTP ${resp.status()}`);
  await ready();
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await ready(); await sleep(500);
  check('game boots to title screen', (await state()).mode === 'title');
  const box = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('canvas fills the phone screen', box.w >= 389 && box.h >= 843, `${box.w}x${box.h}`);
  check('title has PLAY, UPGRADES and settings buttons', !!(await ui('play')) && !!(await ui('shop')) && !!(await ui('settings')));

  // ---- a Stage 2 save (v1: no weapon tiers) still loads and keeps its coins and upgrades
  await page.evaluate(() => localStorage.setItem('eraRunner.save.v1', JSON.stringify({ coins: 1234, upg: { dmg: 3, rate: 2, hp: 1, xp: 1, coin: 0 }, best: { era: 4, wins: 5, runs: 9, bestCoins: 210, bossKills: [0, 0, 1, 1, 3, 0] }, music: true, sfx: false })));
  await page.reload(); await ready(); await sleep(300);
  const mig = await page.evaluate(() => __ER.save.data);
  check('Stage 2 save migrates without losing coins or upgrades', mig.coins === 1234 && mig.upg.dmg === 3 && mig.upg.xp === 1 && mig.best.tier === 9 && mig.best.wins === 5 && mig.v === 3 && mig.sfx === false && mig.level === 6,
    `coins ${mig.coins}, best tier ${mig.best.tier}, v${mig.v}, unlocked L${mig.level}`);
  // ---- a Stage 3 save (v2, one long track) maps its best era / boss kills to unlocked levels
  await page.evaluate(() => localStorage.setItem('eraRunner.save.v1', JSON.stringify({ v: 2, coins: 777, upg: { dmg: 2, rate: 1, hp: 3, xp: 2, coin: 1 }, best: { era: 2, tier: 5, wins: 2, runs: 6, bestCoins: 90, bossKills: [1, 1, 0, 0, 0, 0] }, music: false, sfx: true })));
  await page.reload(); await ready(); await sleep(400);
  const mig3 = await page.evaluate(() => __ER.save.data);
  check('Stage 3 save -> v3: keeps coins, upgrades, settings; unlocks Level 3', mig3.v === 3 && mig3.coins === 777 && mig3.upg.hp === 3 && mig3.upg.xp === 2 && mig3.music === false && mig3.level === 3,
    `coins ${mig3.coins}, unlocked L${mig3.level}, music ${mig3.music}`);
  // ---- title level select: starts on the highest unlocked level, arrows pick earlier ones
  const t0 = await page.evaluate(() => __ER.scene.selLevel);
  check('title level select defaults to the highest unlocked level', t0 === 3 && !!(await ui('levelPrev')) && !!(await ui('levelNext')), `L${t0}`);
  await tap('levelNext');
  check('cannot pick a locked level', (await page.evaluate(() => __ER.scene.selLevel)) === 3);
  await tap('levelPrev');
  check('◀ picks an earlier level', (await page.evaluate(() => __ER.scene.selLevel)) === 2);
  await tap('play');
  const l2 = await state();
  check('PLAY starts the picked level (L2 = Bronze Age, Javelin)', l2.mode === 'play' && l2.level === 2 && l2.era === 1 && l2.weapon === 'Javelin', `L${l2.level} ${l2.eraName} ${l2.weapon}`);
  await page.evaluate(() => { const s = __ER.scene; s.mode = 'won'; s.showTitle(); });

  // ---- shop: give coins, buy an upgrade, reload, still bought
  await page.evaluate(() => { localStorage.setItem('eraRunner.save.v1', JSON.stringify({ coins: 500 })); });
  await page.reload(); await ready(); await sleep(400);
  await tap('shop');
  check('shop opens', (await state()).mode === 'shop');
  await tap('buy_dmg');
  let sv = await save();
  check('buying an upgrade spends coins', sv.upg.dmg === 1 && sv.coins === 440, `dmg lv ${sv.upg.dmg}, coins ${sv.coins}`);
  await page.reload(); await ready(); await sleep(400);
  sv = await page.evaluate(() => __ER.save.data);
  check('purchase persists after reload', sv.upg.dmg === 1 && sv.coins === 440);
  await tap('shop'); await tap('buy_hp'); await tap('shopBack');
  check('back from shop returns to title', (await state()).mode === 'title');

  // ---- settings: mute music persists; reset needs a confirm
  await tap('settings');
  await tap('toggle_music');
  await page.reload(); await ready(); await sleep(400);
  check('music mute persists after reload', (await save()).music === false);
  await tap('settings'); await tap('reset');
  check('reset asks for confirmation first', (await save()).coins > 0 && !!(await ui('resetYes')));
  await tap('resetNo');
  check('"NO" keeps progress', (await save()).upg.dmg === 1);
  await tap('settingsClose');

  // ---- play
  await tap('play');
  const st0 = await state();
  check('tap PLAY starts a run with upgrades applied', st0.mode === 'play' && st0.maxHp === 115, `maxHp ${st0.maxHp}`);
  check('audio unlocks after the first tap', await page.evaluate(() => __ER.sound.ready));
  const cdp = await ctx.newCDPSession(page);
  const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await t('touchStart', 150, 700);
  for (let i = 1; i <= 10; i++) { await t('touchMove', 150 + i * 12, 700); await sleep(30); }
  await t('touchEnd');
  await sleep(400);
  const px = await page.evaluate(() => __ER.scene.tx);
  check('touch drag steers the weapon', px > 60, `target x ${px.toFixed(0)}`);
  await sleep(1200);
  const s1 = await state();
  check('weapon auto-fires and the track scrolls', s1.d > 100 && s1.projs + s1.stats.damage > 0, `d=${s1.d.toFixed(0)}`);

  // fast-forward to the end of the track: the boss appears and the track stops
  const coinsBefore = (await save()).coins;
  const atBoss = await page.evaluate(() => { __ER.setBot('smart'); return __ER.sim(95); });
  check('boss appears at the end of the track', !!atBoss.boss, atBoss.boss ? `${atBoss.boss.name}, ${atBoss.boss.maxHp} HP` : `mode ${atBoss.mode}`);
  const d0 = atBoss.d;
  const mid = await page.evaluate(() => __ER.sim(3));
  check('track stops during the boss fight', mid.d - d0 < 40, `moved ${(mid.d - d0).toFixed(0)}`);
  check('coins were collected on the way', mid.coins > 50, `${mid.coins} coins`);
  const end = await page.evaluate(() => __ER.sim(60));
  check('beating the boss wins the level', end.mode === 'won', `mode=${end.mode} era=${end.eraName} boss fight ${end.boss?.t.toFixed(1)}s`);
  check('Level 1 is the Stone Age with the Woolly Mammoth', end.level === 1 && end.era === 0 && atBoss.boss?.name === 'WOOLLY MAMMOTH');
  await sleep(600);
  sv = await save();
  check('winning Level 1 unlocks Level 2 (saved)', sv.level === 2, `unlocked L${sv.level}`);
  check('end screen has NEXT LEVEL and MENU', !!(await ui('play')) && !!(await ui('menu')));
  check('coins earned are saved', sv.coins > coinsBefore && sv.best.wins === 1, `${coinsBefore} -> ${sv.coins}`);
  check('end screen has UPGRADES', !!(await ui('shop')));
  await page.evaluate(() => { __ER.setBot(null); const s = __ER.scene; s.finishRun(false); });
  await sleep(300); await tap('play');
  check('tapping RETRY while the coin counter runs starts a new run', (await state()).mode === 'play');

  // weapon tiers: each level starts on its era's weapon 1, XP earns weapon 2 (and no further)
  const tiers = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; __ER.setTestUpgrades({}, true); s.startRun(1); __ER.setBot(null);
    const out = { start: [s.tier, s.era, s.weapon.name] };
    s.gainXp(s.level.need[0] + 0.1);
    out.step1 = [s.tier, s.era, s.weapon.name, s.bannerC?.list?.map((t) => t.text).filter(Boolean).join(' ')];
    s.gainXp(9999);
    out.step2 = [s.tier, s.era, s.weapon.name];
    out.need = s.level.need;
    const L1 = s.level.totalHP;
    s.closeScreen(); s.mode = 'won'; s.startRun(4); out.l4 = [s.era, s.weapon.name, s.boss];
    s.closeScreen(); s.mode = 'won'; s.startRun(7); out.l7 = [s.era, s.weapon.name, s.level.totalHP / L1, s.info.dmgMul];
    return out;
  });
  check('Level 1 starts with the Thrown Rock in the Stone Age', tiers.start[0] === 0 && tiers.start[2] === 'Thrown Rock');
  check('XP earns the era\'s second weapon (Sling, UPGRADED! banner)', tiers.step1[0] === 1 && tiers.step1[1] === 0 && /UPGRADED/.test(tiers.step1[3]), tiers.step1.join(' / '));
  check('more XP does not leave the era', tiers.step2[0] === 1 && tiers.step2[1] === 0, tiers.step2.join(' / '));
  check('Level 4 is the Gunpowder Age with the Musket', tiers.l4[0] === 3 && tiers.l4[1] === 'Musket', tiers.l4.join(' / '));
  check('Level 7 loops back to the Stone Age with tougher enemies', tiers.l7[0] === 0 && tiers.l7[1] === 'Thrown Rock' && tiers.l7[2] > 1.5 && tiers.l7[3] > 1, `HP x${tiers.l7[2].toFixed(2)}, dmg x${tiers.l7[3]}`);

  // checkpoint: gems fill the meter, passing the gate cashes it out for power-ups
  const lap = await page.evaluate(() => [__ER.payout(5), __ER.payout(30), __ER.payout(__ER.LAP + 12), __ER.payout(__ER.LAP * 2)]);
  check('meter payout: bands by points, each full lap banks a Legendary', lap[0].join() === '0' && lap[1].join() === '2' && lap[2].join() === '4,1' && lap[3].join() === '4,4', JSON.stringify(lap));
  const cp = await page.evaluate(async () => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.hp = s.maxHp = 9999;
    __ER.toCheckpoint(0, 30);
    const before = { meter: s.meter, band: s.meterBand(), dmg: s.dmg, rate: s.rate };
    let t = 0; while (!s.stats.checkpoints.length && t < 6) { s.step(1 / 60); t += 1 / 60; }
    const c = s.stats.checkpoints[0];
    return { before, c, meter: s.meter, n: Object.values(s.puCount).reduce((a, v) => a + v, 0), paused: s.pauseT > 0, ids: c?.ids };
  });
  check('passing the CHECKPOINT cashes out the meter', !!cp.c && cp.meter === 0 && cp.c.bands.join() === '2', JSON.stringify(cp.c));
  check('checkpoint pays a power-up of the band reached (Rare) with a reveal', cp.n === 1 && cp.paused && ['pierce', 'shield', 'big'].includes(cp.ids?.[0]), `${cp.ids} paused=${cp.paused}`);
  for (let i = 0; i < 40 && (await state()).paused; i++) await sleep(250);
  check('reveal finishes and the run continues', (await state()).paused === false && (await state()).mode === 'play');
  const pu = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.hp = s.maxHp = 9999;
    const d0 = s.dmg, sh0 = s.shots;
    __ER.givePowerup('sharp'); __ER.givePowerup('extra'); __ER.givePowerup('blades');
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    s.spawn({ type: 'enemy', at: s.d + 160, x: 80, hp: 1e6, size: 1, dmg: 0, section: 0 });
    const e = s.objs[s.objs.length - 1];
    let t = 0; while (t < 1.5) { s.step(1 / 60); t += 1 / 60; }
    return { d0, d1: s.dmg, sh0, sh1: s.shots, blades: s.pu.blades, icons: s.puIcons?.list?.length || 0, dmgTaken: 1e6 - e.hp };
  });
  check('power-ups apply: +10% damage, +1 shot, orbit blades', Math.abs(pu.d1 / pu.d0 - 1.1) < 0.01 && pu.sh1 === pu.sh0 + 1 && pu.blades === 2, `dmg ${pu.d0.toFixed(1)}->${pu.d1.toFixed(1)} shots ${pu.sh0}->${pu.sh1}`);
  check('active power-ups show HUD icons', pu.icons >= 3, `${pu.icons} icon parts`);

  // XP comes from gems: kill an enemy in your lane, drive over its gem
  const gem = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null);
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    s.spawn({ type: 'enemy', at: s.d + 900, x: 0, hp: 1, size: 1, dmg: 12, section: 0 });
    s.tx = s.px = 0;
    const xp0 = s.xp; let t = 0;
    while (t < 5 && s.stats.gems === 0) { s.step(1 / 60); t += 1 / 60; }
    return { xp0, xp: s.xp, gems: s.stats.gems, t, meter: s.meter };
  });
  check('killing an enemy drops an XP gem that also fills the checkpoint meter', gem.gems > 0 && gem.xp > gem.xp0 && gem.meter > 0, `xp ${gem.xp0} -> ${gem.xp.toFixed(1)} after ${gem.t.toFixed(1)}s`);
  await page.evaluate(() => __ER.setTestUpgrades(null, false));

  // lose: low health, no steering -> lose screen, half the coins kept
  const lost = await page.evaluate(() => { const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.tx = 0; s.hp = 15; s.runCoins = 40; return __ER.sim(120); });
  check('health reaching 0 shows the lose screen and keeps half the coins', lost.mode === 'lost' && lost.stats.coins === Math.ceil(lost.coins / 2), `kept ${lost.stats.coins} of ${lost.coins}`);

  // shooting a red gate turns it green before you reach it
  const gate = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; __ER.setTestUpgrades({}, true); s.startRun(1); __ER.setBot(null);
    s.spawn({ type: 'gate', at: s.d + 1500, gates: [{ kind: 'rate', value: -20 }, { kind: 'dmg', value: -20 }], section: 0 });
    const g = s.objs.filter((o) => o.type === 'gate').slice(-2)[0];
    s.tx = s.px = g.x; const v0 = g.gate.value;
    let tt = 0; while (g.gate.value <= 0 && !g.pair.used && tt < 8) { s.step(1 / 60); tt += 1 / 60; }
    __ER.setTestUpgrades(null, false);
    return { v0, v: g.gate.value, t: tt };
  });
  check('a red -20% gate turns green before you reach it (Stone Age, 1 shot)', gate.v > 0, `${gate.v0} -> ${gate.v} in ${gate.t.toFixed(1)}s`);

  // reset progress (confirmed) wipes the save
  await page.evaluate(() => { const s = __ER.scene; s.mode = 'won'; s.showTitle(); });
  await sleep(500);
  await tap('settings');
  if (!(await ui('reset'))) { console.log('  (settings tap missed, retrying)', JSON.stringify(await state()).slice(0, 120)); await tap('settings'); } await tap('reset'); await tap('resetYes');
  sv = await save();
  check('confirmed reset wipes coins and upgrades', sv.coins === 0 && sv.upg.dmg === 0 && sv.music === false);
  await sleep(300);
  check('no console errors at 390x844', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('test ran without exceptions', false, e.message + ' errors: ' + errors.join(' | '));
}
await ctx.close();

// desktop: mouse click to start and mouse drag to steer
try {
  const dpage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  dpage.on('pageerror', (e) => errors.push('desktop: ' + e.message));
  await dpage.goto(url);
  await dpage.waitForFunction(() => window.__ER?.ready, null, { timeout: 30000 });
  await sleep(500);
  const b = await dpage.evaluate(() => __ER.uiPoint('play'));
  await dpage.mouse.click(b.x, b.y);
  await sleep(400);
  await dpage.mouse.move(640, 600); await dpage.mouse.down();
  for (let i = 1; i <= 10; i++) { await dpage.mouse.move(640 - i * 12, 600); await sleep(30); }
  await dpage.mouse.up(); await sleep(300);
  const dst = await dpage.evaluate(() => ({ mode: __ER.state().mode, tx: __ER.scene.tx }));
  check('desktop: mouse click starts, mouse drag steers', dst.mode === 'play' && dst.tx < -60, `mode=${dst.mode} x=${dst.tx.toFixed(0)}`);
} catch (e) { check('desktop test ran', false, e.message); }
await browser.close();
srv?.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
