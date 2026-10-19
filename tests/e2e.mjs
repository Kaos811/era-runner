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
  const atBoss = await page.evaluate(() => { const s = __ER.scene; __ER.setBot('smart'); s.simulating = true; let t = 0; while (s.mode === 'play' && !s.boss && t < 120) { s.botSteer(1 / 60); s.step(1 / 60); t += 1 / 60; } s.simulating = false; s.setEraVisuals(s.era, true); s.refreshWeaponLook(); return __ER.state(); });
  check('boss appears at the end of the track', !!atBoss.boss, atBoss.boss ? `${atBoss.boss.name}, ${atBoss.boss.maxHp} HP` : `mode ${atBoss.mode}`);
  const d0 = (await page.evaluate(() => __ER.sim(1.2))).d;
  const mid = await page.evaluate(() => __ER.sim(3));
  check('track stops during the boss fight', mid.d - d0 < 40, `moved ${(mid.d - d0).toFixed(0)}`);
  check('coins were collected on the way', mid.coins > 20, `${mid.coins} coins`);
  // boss down -> the BONUS RUN: multiplier rows across the track, the track moves again
  const bon = await page.evaluate(() => { const s = __ER.scene; s.simulating = true; let t = 0; while (s.mode === 'play' && !s.bonus && t < 60) { s.botSteer(1 / 60); s.step(1 / 60); t += 1 / 60; } s.simulating = false; const st = __ER.state(); const d0 = s.d; __ER.sim(1); return { st, moved: s.d - d0 }; });
  const rows = bon.st.bonus?.rows || [];
  check('a bonus run starts after the boss is beaten', bon.st.mode === 'play' && !!bon.st.bonus && !bon.st.boss, `mode ${bon.st.mode}`);
  check('bonus rows are tagged x1.2 ... x5 and get tougher', rows.map((r) => r.mult).join(',') === '1.2,1.5,2,2.5,3,4,5' && rows.every((r, i) => !i || r.maxHp > rows[i - 1].maxHp * 1.3), rows.map((r) => `x${r.mult}:${r.maxHp}`).join(' '));
  check('the track runs again during the bonus', bon.moved > 300, `moved ${bon.moved.toFixed(0)}`);
  const end = await page.evaluate(() => __ER.sim(12));
  const res = await page.evaluate(() => __ER.scene.lastResult);
  check('bonus run is short (<= 8.5 s)', res.bonusTime > 2 && res.bonusTime <= 8.5, `${res.bonusTime.toFixed(1)}s, ${res.bonusRows} rows broken`);
  check('the bonus multiplier multiplies the level coins', res.bonusMult > 1 && res.coins === Math.round(res.coinsRaw * res.bonusMult), `${res.coinsRaw} x${res.bonusMult} = ${res.coins}`);
  check('the best bonus multiplier is saved for the level', (await save()).bonusBest?.['1'] === res.bonusMult, JSON.stringify((await save()).bonusBest));
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

  // the BEST marker: survives a reload and shows on that level's row in the next bonus run
  const bestM = await page.evaluate(() => {
    const E = __ER, s = E.scene; E.save.reload();
    const best = E.save.data.bonusBest['1'];
    E.jumpToBoss(0, { rate: 0, dmg: 0, extra: 0 }, 0, 1); E.setBot(null); E.sim(4);
    s.boss.hp = 1; s.boss.shields = []; s.boss.shieldUntil = 0; s.bossHit({ dmg: 5, noFx: true }); E.sim(2.2);
    const row = s.bonus?.rows.find((r) => r.bestT);
    const out = { best, mult: row?.mult, text: row?.bestT?.text, n: s.bonus?.rows.filter((r) => r.bestT).length };
    // a weak weapon breaks nothing -> no multiplier, best stays
    E.sim(12); out.weak = s.lastResult.bonusMult; out.after = E.save.data.bonusBest['1']; out.coins = [s.lastResult.coinsRaw, s.lastResult.coins];
    return out;
  });
  check('BEST marker persists and sits on the best row', bestM.best > 1 && bestM.mult === bestM.best && bestM.n === 1 && /^BEST: x/.test(bestM.text || ''), JSON.stringify(bestM));
  check('a worse bonus keeps the saved best', bestM.after === bestM.best && bestM.weak < bestM.best && bestM.coins[1] === Math.round(bestM.coins[0] * bestM.weak), JSON.stringify(bestM));
  // a lost run gets no bonus
  const lostB = await page.evaluate(() => { const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.hp = 1; const st = __ER.sim(60); return { mode: st.mode, bonus: s.lastResult.bonusMult }; });
  check('no bonus run on a loss', lostB.mode === 'lost' && !lostB.bonus, JSON.stringify(lostB));

  // YEAR COUNTER: shown on the HUD, climbs with XP inside the era's range, weapon 2 at a fitting year
  const yr = await page.evaluate(() => {
    const E = __ER, s = E.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); E.setBot(null);
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    const out = { start: s.yearText.text, visible: s.yearText.visible && s.hud.visible };
    const p0 = s.stats.yrsPops || 0;
    for (let i = 0; i < 12; i++) { s.collectGem({ xp: 1, x: 0, z: 0 }); s.step(1 / 60); } s.render();
    out.mid = s.yearText.text; out.y1 = s.year; out.pops = (s.stats.yrsPops || 0) - p0; out.popTexts = s.yrsPops.length;
    s.xp = 0; s.gainXp(s.level.need[0]); s.step(1 / 60); s.render(); out.unlock = s.yearText.text; out.tier = s.tier;
    s.gainXp(999); s.step(1 / 60); s.render(); out.end = s.yearText.text;
    s.closeScreen(); s.mode = 'won'; s.startRun(3); s.render(); out.l3 = s.yearText.text;
    s.closeScreen(); s.mode = 'won'; s.startRun(4); s.render(); out.l4 = s.yearText.text;
    s.closeScreen(); s.mode = 'won'; s.startRun(7); s.render(); out.l7 = s.yearText.text; out.loop = s.loopTag.text;
    s.closeScreen(); s.mode = 'won'; s.startRun(1); s.render(); out.loop1 = s.loopTag.text;
    return out;
  });
  check('HUD year counter starts at 10,000 BC in the Stone Age', yr.start === '10,000 BC' && yr.visible, JSON.stringify(yr));
  check('the year climbs as gems are grabbed, with aggregated +YRS popups', yr.y1 > -10000 && /BC$/.test(yr.mid) && yr.pops >= 1 && yr.pops <= 2 && yr.popTexts >= 1, `${yr.mid}, ${yr.pops} popup(s) for 12 gems`);
  check('weapon 2 arrives partway through the era; the era ends at 3,000 BC', yr.tier === 1 && yr.unlock === '7,000 BC' && yr.end === '3,000 BC', `${yr.unlock} -> ${yr.end}`);
  check('other eras use their own ranges (500 AD, 1450 AD); Level 7 loops with a LOOP 2 tag', yr.l3 === '500 AD' && yr.l4 === '1450 AD' && yr.l7 === '10,000 BC' && yr.loop === 'LOOP 2' && yr.loop1 === '', JSON.stringify(yr));

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
  const lap = await page.evaluate(() => [__ER.payout(2), __ER.payout(16), __ER.payout(__ER.LAP + 16), __ER.payout(__ER.LAP * 2)]);
  check('meter payout: bands by points, each full lap banks a Legendary', lap[0].join() === '0' && lap[1].join() === '2' && lap[2].join() === '4,2' && lap[3].join() === '4,4', JSON.stringify(lap));
  const cp = await page.evaluate(async () => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.hp = s.maxHp = 9999;
    __ER.toCheckpoint(0, 16);
    const before = { meter: s.meter, band: s.meterBand(), dmg: s.dmg, rate: s.rate };
    let t = 0; while (!s.stats.checkpoints.length && t < 6) { s.step(1 / 60); t += 1 / 60; }
    const c = s.stats.checkpoints[0];
    return { before, c, meter: s.meter, n: Object.values(s.puCount).reduce((a, v) => a + v, 0), paused: s.pauseT > 0, ids: c?.ids };
  });
  check('passing under the METER ARCH cashes out the meter', !!cp.c && cp.meter === 0 && cp.c.bands.join() === '2', JSON.stringify(cp.c));
  check('checkpoint pays a power-up of the band reached (Rare) with a reveal', cp.n === 1 && cp.paused && ['pierce', 'shield', 'big', 'extra'].includes(cp.ids?.[0]), `${cp.ids} paused=${cp.paused}`);
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
  check('power-ups apply: +6% damage, +1 barrel, orbit blades', Math.abs(pu.d1 / pu.d0 - 1.06) < 0.01 && pu.sh1 === pu.sh0 + 1 && pu.blades === 2, `dmg ${pu.d0.toFixed(1)}->${pu.d1.toFixed(1)} shots ${pu.sh0}->${pu.sh1}`);
  check('active power-ups show HUD icons', pu.icons >= 3, `${pu.icons} icon parts`);

  // XP comes from gems: kill an enemy in your lane; its gem pops to the side, steer onto it
  const gemRun = (steer) => page.evaluate((steer) => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null);
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    s.spawn({ type: 'enemy', at: s.d + 900, x: 0, hp: 1, size: 1.4, dmg: 12, section: 0 });
    s.tx = s.px = 0;
    const xp0 = s.xp; let t = 0; let popped = null;
    while (t < 5 && s.stats.gems === 0 && !(s.stats.gemsMissed > 0)) {
      if (s.gems[0] && popped === null) popped = s.gems[0].x;
      if (steer && s.gems[0]) s.tx = s.gems[0].x;
      s.step(1 / 60); t += 1 / 60;
    }
    return { xp0, xp: s.xp, gems: s.stats.gems, missed: s.stats.gemsMissed, t, meter: s.meter, popped };
  }, steer);
  const still = await gemRun(false);
  check('standing still: the gem pops out of reach and is missed', still.gems === 0 && Math.abs(still.popped) >= 40, `popped to x=${still.popped?.toFixed(0)}`);
  const gem = await gemRun(true);
  check('steering onto the gem picks it up: XP + checkpoint meter', gem.gems > 0 && gem.xp > gem.xp0 && gem.meter > 0, `xp ${gem.xp0} -> ${gem.xp.toFixed(1)} after ${gem.t.toFixed(1)}s`);
  const lay = await page.evaluate(() => { const L = __ER.scene.level; return { arches: L.checkpoints.length, crates: L.crates.length, gates: L.items.filter((i) => i.type === 'gate').length, last: (L.finish - L.checkpoints[L.checkpoints.length - 1]), gaps: L.checkpoints.map((c, i) => (i ? c - L.checkpoints[i - 1] : c - 700) / 330) }; });
  check('a level has 5 gem crates, 5 meter arches (last one right before the boss) and 3 gates', lay.arches === 5 && lay.crates === 5 && lay.gates === 3 && lay.last < 600 && lay.gaps.every((g) => g > 11 && g < 15), JSON.stringify(lay));
  // gem crate: shooting raises its number, reaching it bursts it into a weaving trail of that many gems
  const crate = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.hp = s.maxHp = 9999;
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    s.spawn({ type: 'crate', at: s.d + 1500, x: 0, ref: 4, idx: 0, phase: 1 });
    const c = s.objs[s.objs.length - 1]; const v0 = c.value;
    s.tx = s.px = 0; let t = 0;
    while (!c.used && t < 8) { s.step(1 / 60); t += 1 / 60; }
    const trail = s.gems.filter((g) => g.trail);
    const xs = trail.map((g) => g.x);
    const out = { v0, v: Math.floor(c.value), burst: c.used, n: trail.length, spread: Math.max(...xs) - Math.min(...xs), m0: s.meter };
    // steer through the trail like a player would
    t = 0; while (s.gems.some((g) => g.trail) && t < 10) { const g = s.gems.filter((q) => q.trail && q.z > 0).sort((a, b) => a.z - b.z)[0]; if (g) s.tx = g.x; s.step(1 / 60); t += 1 / 60; }
    out.caught = s.stats.trailGems; out.meter = s.meter; out.pops = s.popPool.length;
    return out;
  });
  check('shooting a gem crate raises its number', crate.v > crate.v0 + 5, `${crate.v0} -> ${crate.v}`);
  check('reaching the crate bursts it into a trail of that many gems that weaves across lanes', crate.burst && crate.n === crate.v && crate.spread > 200, `${crate.n} gems, spread ${crate.spread.toFixed(0)}`);
  check('steering through the trail fills the arch meter', crate.caught > crate.n * 0.7 && crate.meter > crate.n * 0.7, `caught ${crate.caught}/${crate.n}, meter ${crate.meter.toFixed(1)}`);
  check('hits pop damage / +N numbers', crate.pops > 0, `${crate.pops} number texts`);
  // Twin Weapon: a second copy of the weapon appears and fires the same volley
  const twin = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null);
    s.projs = []; s.fire(); const one = s.projs.length;
    __ER.givePowerup('twin'); s.projs.forEach((p) => p.img?.destroy()); s.projs = []; s.fire(); const two = s.projs.length;
    const img = s.twinImgs?.[0]?.list?.find((o) => o.texture && o.texture.key.startsWith('weapon_'))?.texture.key; const main0 = s.weaponImg.texture.key;
    s.gainXp(9999); s.render();
    const img2 = s.twinImgs?.[0]?.list?.find((o) => o.texture && o.texture.key.startsWith('weapon_'))?.texture.key;
    return { one, two, img, img2, main0, main1: s.weaponImg.texture.key };
  });
  check('Twin Weapon: a copy of your weapon appears and fires alongside', twin.two === twin.one * 2 && twin.img2 != null, JSON.stringify(twin));
  check('Twin Weapon updates when the weapon upgrades', twin.img === twin.main0 && twin.img2 === twin.main1 && twin.img2 !== twin.img, JSON.stringify(twin));
  await page.evaluate(() => __ER.setTestUpgrades(null, false));

  // lose: low health, no steering -> lose screen, half the coins kept
  const lost = await page.evaluate(() => { const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(1); __ER.setBot(null); s.tx = 0; s.hp = 15; s.runCoins = 40; return __ER.sim(120); });
  check('health reaching 0 shows the lose screen and keeps half the coins', lost.mode === 'lost' && lost.stats.coins === Math.ceil(lost.coins / 2), `kept ${lost.stats.coins} of ${lost.coins}`);

  // shooting a red gate turns it green before you reach it
  const gate = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; __ER.setTestUpgrades({}, true); s.startRun(1); __ER.setBot(null);
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    s.spawn({ type: 'gate', at: s.d + 1500, gates: [{ kind: 'rate', value: -20 }, { kind: 'dmg', value: -20 }], section: 0 });
    const g = s.objs.filter((o) => o.type === 'gate').slice(-2)[0];
    s.tx = s.px = g.x; const v0 = g.gate.value;
    let tt = 0; while (g.gate.value <= 0 && !g.pair.used && tt < 8) { s.step(1 / 60); tt += 1 / 60; }
    __ER.setTestUpgrades(null, false);
    return { v0, v: g.gate.value, t: tt };
  });
  check('a red -20% gate turns green before you reach it (Stone Age, 1 shot)', gate.v > 0, `${gate.v0} -> ${gate.v} in ${gate.t.toFixed(1)}s`);

  // wave layout: clear zones around gates and no stacked enemies, Levels 1-12
  const lay2 = await page.evaluate(() => {
    const W = __ER.WAVES, R = W.run, out = [];
    for (let n = 1; n <= 12; n++) {
      const L = __ER.buildLevel(n);
      const gates = L.items.filter((i) => i.type === 'gate').map((i) => i.at);
      const en = L.items.filter((i) => i.type === 'enemy' || i.type === 'block');
      let after = 99, before = 99, stacked = 0, spawnBehind = 0;
      for (const G of gates) for (const e of en) {
        const d = (e.arrive - G) / R; if (d >= 0) after = Math.min(after, d); else { before = Math.min(before, -d); if (e.at > G) spawnBehind++; }
      }
      for (let i = 0; i < en.length; i++) for (let j = i + 1; j < en.length; j++) if (Math.abs(en[i].arrive - en[j].arrive) < W.inWave * R - 1 && Math.abs(en[i].x - en[j].x) < W.minDx) stacked++;
      out.push({ n, after: +after.toFixed(2), before: +before.toFixed(2), stacked, spawnBehind, chargers: en.filter((e) => e.charger).length, enemies: en.length });
    }
    return { out, gateAfter: W.gateAfter, gateBefore: W.gateBefore };
  });
  check('every level keeps a clear zone around each gate (nothing arrives just before / after it, nothing walks through it)', lay2.out.every((l) => l.after >= lay2.gateAfter - 0.05 && l.before >= lay2.gateBefore - 0.05 && l.spawnBehind === 0), JSON.stringify(lay2.out.map((l) => [l.n, l.before, l.after])));
  check('waves are spread: no two enemies stacked in one spot (Levels 1-12)', lay2.out.every((l) => l.stacked === 0), lay2.out.map((l) => l.stacked).join(','));
  check('chargers only from Level 4, later levels have more waves', lay2.out[2].chargers === 0 && lay2.out.slice(3).every((l) => l.chargers > 0) && lay2.out[9].enemies > lay2.out[0].enemies, lay2.out.map((l) => `${l.n}:${l.enemies}/${l.chargers}`).join(' '));

  // runtime: an enemy can't close in on a gate that is still in front of it
  const hold = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(7); __ER.setBot(null);
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length;
    s.spawn({ type: 'gate', at: s.d + 1200, gates: [{ kind: 'rate', value: 10 }, { kind: 'dmg', value: 10 }], section: 0 });
    s.spawn({ type: 'enemy', at: s.d + 1600, x: 0, hp: 99999, size: 1, dmg: 1, section: 0, ref: 1e-9, walk: s.info.walk });
    const g = s.objs.find((o) => o.type === 'gate'), e = s.objs.find((o) => o.type === 'enemy');
    let minGap = 1e9;
    for (let i = 0; i < 400 && !g.pair.used; i++) { s.step(1 / 60); if (!g.pair.used) minGap = Math.min(minGap, e.z - g.z); }
    return { minGap: Math.round(minGap), want: Math.round(__ER.WAVES.holdAfter * (330 + s.info.walk)), ez: Math.round(e.z), used: g.pair.used };
  });
  check('an enemy behind a gate is held back until you pass it', hold.used && hold.minGap >= hold.want - 8 && hold.ez >= hold.want - 20, JSON.stringify(hold));

  // runtime: enemies on top of each other push apart sideways
  const sep = await page.evaluate(() => {
    const s = __ER.scene; s.closeScreen(); s.mode = 'won'; s.startRun(2); __ER.setBot(null);
    s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length; s.tx = s.px = 200;
    for (let i = 0; i < 2; i++) s.spawn({ type: 'enemy', at: s.d + 1500, x: -60, hp: 99999, size: 1, dmg: 1, section: 0, ref: 1e-9, walk: 45 });
    for (let i = 0; i < 90; i++) s.step(1 / 60);
    const e = s.objs.filter((o) => o.type === 'enemy' && !o.dead);
    return { dx: Math.round(Math.abs(e[0].x - e[1].x)) };
  });
  check('enemies spawned on the same spot spread apart', sep.dx >= 90, `dx ${sep.dx}`);

  // charger (Level 4+): telegraphs your lane, then rushes it; steering out dodges it, staying gets hit
  const charge = await page.evaluate(() => {
    const s = __ER.scene; const C = __ER.WAVES.charger;
    const run = (dodge) => {
      s.closeScreen(); s.mode = 'won'; s.startRun(4); __ER.setBot(null);
      s.objs.forEach((o) => { o.dead = true; }); s.qi = s.level.items.length; s.tx = s.px = 0;
      s.spawn({ type: 'enemy', at: s.d + 1150, x: 150, hp: 99999, size: 1.05, dmg: 16, section: 0, ref: 1e-9, walk: s.info.walk, charger: true });
      const e = s.objs.find((o) => o.charger);
      const hits0 = s.stats.hitsTaken; let aimAt = null, rushAt = null, lane = null, aimZ = null;
      for (let i = 0; i < 60 * 6 && !e.dead; i++) {
        s.step(1 / 60);
        if (e.ch && aimAt === null) { aimAt = s.time; lane = e.ch.lane; aimZ = Math.round(e.z); if (dodge) s.tx = 150; }
        if (e.ch?.phase === 'rush' && rushAt === null) rushAt = s.time;
      }
      return { aim: aimAt !== null, lane, aimZ, tele: rushAt && aimAt ? +(rushAt - aimAt).toFixed(2) : null, hit: s.stats.hitsTaken - hits0 };
    };
    return { stay: run(false), dodge: run(true), want: C.aim };
  });
  check('a charger telegraphs (marks your lane) before rushing', charge.stay.aim && charge.stay.lane === 0 && charge.stay.tele >= charge.want - 0.02 && charge.stay.aimZ >= 600, JSON.stringify(charge.stay));
  check('staying in the marked lane gets you hit, steering out dodges it', charge.stay.hit === 1 && charge.dodge.hit === 0, `stay ${charge.stay.hit} hit, dodge ${charge.dodge.hit} hit`);

  // reset progress (confirmed) wipes the save
  await page.evaluate(() => { const s = __ER.scene; s.mode = 'won'; s.showTitle(); });
  await sleep(500);
  // the headless page runs at a few fps by now, so a tap can be dropped: retry until the next button shows
  const tapTill = async (name, ok) => { for (let k = 0; k < 4; k++) { if (await ok()) return; if (await ui(name)) await tap(name); else await sleep(300); } };
  await tapTill('settings', async () => !!(await ui('reset')));
  await tapTill('reset', async () => !!(await ui('resetYes')));
  await tapTill('resetYes', async () => (await save()).coins === 0);
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
