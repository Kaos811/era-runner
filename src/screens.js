import Phaser from 'phaser';
import { ERAS, WEAPONS } from './eras.js';
import { UPGRADES, upgCost } from './upgrades.js';
import { Save } from './save.js';
import { Sound } from './audio.js';
import { style, col, makeBtn } from './ui.js';

const W = 540, H = 960;
const fmt = (n) => Math.floor(n).toLocaleString('en-US');

// Title, shop, settings and end-of-run screens. Each screen is one container in this.screen;
// popups (shop/settings) replace the screen and come back to where they were opened from.
export const ScreenMethods = {
  closeScreen() {
    (this.screenTweens || []).forEach((t) => t.remove());
    this.screenTweens = [];
    if (this.screen) { this.screen.destroy(); this.screen = null; }
  },

  newScreen(dimAlpha = 0.45) {
    this.closeScreen();
    const c = this.add.container(W / 2, 0).setDepth(9000);
    c.add(this.add.rectangle(0, H / 2, W * 4, H * 3, 0x000000, dimAlpha).setInteractive()); // swallow taps
    this.screen = c;
    return c;
  },

  coinPill(c, x, y, amount, size = 26) {
    const w = 70 + String(fmt(amount)).length * size * 0.62;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5).fillRoundedRect(x - w / 2, y - size * 0.85, w, size * 1.7, size * 0.85);
    const ic = this.add.image(x - w / 2 + size * 0.95, y, 'coin').setScale(size / 40);
    const t = this.add.text(x - w / 2 + size * 1.75, y, fmt(amount), style(size, '#ffe14d', 5)).setOrigin(0, 0.5);
    c.add([g, ic, t]);
    return t;
  },

  canAffordSomething() {
    return UPGRADES.some((u) => Save.data.upg[u.key] < u.max && Save.data.coins >= upgCost(u, Save.data.upg[u.key]));
  },

  gearButton(c, from, x = 225, y = Math.max(52, this.top + 52)) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5).fillCircle(x, y, 30);
    const ic = this.add.image(x, y, 'icon_gear').setScale(0.6);
    const z = this.add.zone(x, y, 66, 66).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => { Sound.play('click'); this.showSettings(from); });
    c.add([g, ic, z]);
    this.ui.settings = z;
  },

  // ------------------------------------------------------------ title
  showTitle() {
    this.mode = 'title';
    this.hud.setVisible(false);
    this.showBossBar?.(false);
    Sound.setSong('run');
    const c = this.newScreen(0.35);
    const topY = Math.max(52, this.top + 52);
    this.coinPill(c, -150, topY, Save.data.coins);
    this.gearButton(c, 'title');
    const t1 = this.add.text(0, 215, 'ERA', style(96, '#ffe14d', 14)).setOrigin(0.5);
    const t2 = this.add.text(0, 303, 'RUNNER', style(84, '#ffffff', 14)).setOrigin(0.5);
    const sub = this.add.text(0, 372, 'Evolve your weapon from the\nStone Age to the Future!', style(21, '#ffffff', 5)).setOrigin(0.5);
    c.add([t1, t2, sub]);
    const row = this.add.graphics();
    row.fillStyle(0x000000, 0.4).fillRoundedRect(-256, 410, 512, 106, 20);
    c.add(row);
    // 12 weapons: one column per era, its two weapons side by side, era name underneath
    const bestTier = Save.data.best.tier;
    const short = ['STONE', 'BRONZE', 'MEDIEVAL', 'GUNPOWDER', 'MODERN', 'FUTURE'];
    ERAS.forEach((e, i) => {
      const x = -213 + i * 85.2;
      for (let j = 0; j < 2; j++) {
        const t = i * 2 + j;
        c.add(this.add.image(x - 17 + j * 34, 450, 'weapon_' + WEAPONS[t].key).setScale(0.165).setAlpha(t <= bestTier || t === 0 ? 1 : 0.45));
      }
      c.add(this.add.text(x, 498, short[i], style(11, col(e.ui), 3)).setOrigin(0.5));
      if (i < 5) c.add(this.add.text(x + 42.6, 452, '›', style(26, '#ffe14d', 4)).setOrigin(0.5));
    });
    const b = Save.data.best;
    const bestLine = b.runs ? `BEST: ${b.tier >= 0 ? WEAPONS[b.tier].name.toUpperCase() : '-'}   WINS: ${b.wins}   BOSSES: ${b.bossKills.reduce((a, v) => a + v, 0)}` : 'Beat the boss at the end to win!';
    c.add(this.add.text(0, 530, bestLine, style(17, '#ffe9b0', 4)).setOrigin(0.5));
    const how = this.add.text(0, 610,
      'DRAG left / right to steer\nDefeat enemies for XP and COINS\nSteer through GREEN gates (shoot red ones!)\nDodge the boss\'s red lanes', style(18, '#ffffff', 5, { lineSpacing: 6 })).setOrigin(0.5);
    c.add(how);
    makeBtn(this, c, 0, 745, 310, 86, 'PLAY', { size: 40, pulse: true, name: 'play', cb: () => { Sound.play('click'); this.startRun(); } });
    const shop = makeBtn(this, c, 0, 845, 310, 72, 'UPGRADES', { shade: 'gold', size: 30, name: 'shop', cb: () => { Sound.play('click'); this.showShop('title'); } });
    if (this.canAffordSomething()) this.badge(c, 140, 815);
    this.screenTweens.push(this.tweens.add({ targets: [t1, t2], y: '-=8', yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut' }));
    void shop;
  },

  badge(c, x, y) {
    const b = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xe5483d, 1).fillCircle(0, 0, 16);
    g.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 16);
    b.add([g, this.add.text(0, 0, '!', style(20, '#ffffff', 0)).setOrigin(0.5)]);
    c.add(b);
    this.screenTweens.push(this.tweens.add({ targets: b, scale: 1.15, yoyo: true, repeat: -1, duration: 500 }));
  },

  // ------------------------------------------------------------ shop
  showShop(from) {
    this.mode = 'shop';
    this.hud.setVisible(false);
    const c = this.newScreen(0.72);
    this.shopFrom = from;
    const topY = Math.max(60, this.top + 60);
    c.add(this.add.text(0, Math.max(150, topY + 80), 'UPGRADES', style(48, '#ffe14d', 9)).setOrigin(0.5));
    c.add(this.add.text(0, Math.max(150, topY + 80) + 42, 'Permanent - they apply at the start of every run', style(15, '#d0d0d0', 3)).setOrigin(0.5));
    this.coinPill(c, 0, topY, Save.data.coins, 28);
    const y0 = Math.max(272, topY + 192);
    UPGRADES.forEach((u, i) => {
      const y = y0 + i * 112;
      const lvl = Save.data.upg[u.key];
      const maxed = lvl >= u.max;
      const cost = upgCost(u, lvl);
      const g = this.add.graphics();
      g.fillStyle(0x1b1b24, 0.95).fillRoundedRect(-255, y - 50, 510, 100, 18);
      g.lineStyle(3, maxed ? 0xffe14d : 0x3a3a4a, 1).strokeRoundedRect(-255, y - 50, 510, 100, 18);
      c.add(g);
      c.add(this.add.image(-215, y, u.icon).setScale(0.55));
      c.add(this.add.text(-178, y - 30, u.name, style(19, '#ffffff', 4)).setOrigin(0, 0.5));
      // level pips
      const pip = this.add.graphics();
      for (let k = 0; k < u.max; k++) {
        pip.fillStyle(k < lvl ? 0xffe14d : 0x44475a, 1).fillRoundedRect(-178 + k * 17, y - 12, 13, 10, 3);
      }
      c.add(pip);
      c.add(this.add.text(-178 + u.max * 17 + 6, y - 7, `LV ${lvl}/${u.max}`, style(13, '#bbbbbb', 0)).setOrigin(0, 0.5));
      const now = u.effect(lvl);
      const next = maxed ? 'MAXED OUT' : `Next: ${u.effect(lvl + 1)}`;
      c.add(this.add.text(-178, y + 18, now, style(15, '#9fe8a9', 0)).setOrigin(0, 0.5));
      c.add(this.add.text(-178, y + 37, next, style(13, maxed ? '#ffe14d' : '#d0d0d0', 0)).setOrigin(0, 0.5));
      const afford = Save.data.coins >= cost;
      makeBtn(this, c, 182, y, 128, 62, maxed ? 'MAX' : fmt(cost), {
        shade: maxed ? 'gray' : afford ? 'green' : 'gray', size: 24, icon: maxed ? null : 'coin', name: 'buy_' + u.key,
        cb: () => this.buyUpgrade(u),
      });
    });
    makeBtn(this, c, 0, y0 + 5 * 112 + 14, 240, 66, 'BACK', { shade: 'blue', size: 28, name: 'shopBack', cb: () => { Sound.play('click'); this.backFromPopup(); } });
  },

  buyUpgrade(u) {
    const lvl = Save.data.upg[u.key];
    const cost = upgCost(u, lvl);
    if (lvl >= u.max || Save.data.coins < cost) { Sound.play('deny'); this.cameras.main.shake(100, 0.003); return false; }
    Save.data.coins -= cost;
    Save.data.upg[u.key] = lvl + 1;
    Save.write();
    Sound.play('buy');
    this.showShop(this.shopFrom);
    return true;
  },

  backFromPopup() {
    if (this.shopFrom === 'end' && this.lastResult) this.showEnd(this.lastResult);
    else this.showTitle();
  },

  // ------------------------------------------------------------ settings
  showSettings(from, confirmReset = false) {
    this.shopFrom = from;
    this.mode = 'settings';
    const c = this.newScreen(0.72);
    const g = this.add.graphics();
    g.fillStyle(0x1b1b24, 0.97).fillRoundedRect(-220, 250, 440, 470, 26);
    g.lineStyle(4, 0x3a8dde, 1).strokeRoundedRect(-220, 250, 440, 470, 26);
    c.add(g);
    c.add(this.add.text(0, 300, 'SETTINGS', style(40, '#ffffff', 8)).setOrigin(0.5));
    const d = Save.data;
    const toggle = (y, label, key, apply) => {
      c.add(this.add.text(-180, y, label, style(24, '#ffffff', 4)).setOrigin(0, 0.5));
      const h = makeBtn(this, c, 120, y, 130, 58, d[key] ? 'ON' : 'OFF', { shade: d[key] ? 'green' : 'gray', size: 26, name: 'toggle_' + key, cb: () => {
        d[key] = !d[key]; Save.write(); apply(d[key]); Sound.play('click'); h.set(d[key] ? 'ON' : 'OFF', d[key] ? 'green' : 'gray');
      } });
    };
    toggle(385, 'MUSIC', 'music', (on) => Sound.setMusic(on));
    toggle(465, 'SOUND FX', 'sfx', (on) => Sound.setSfx(on));
    if (!confirmReset) {
      makeBtn(this, c, 0, 565, 300, 58, 'RESET PROGRESS', { shade: 'red', size: 22, name: 'reset', cb: () => { Sound.play('click'); this.showSettings(from, true); } });
    } else {
      c.add(this.add.text(0, 548, 'Erase all coins, upgrades\nand best stats?', style(19, '#ff8a80', 4)).setOrigin(0.5));
      makeBtn(this, c, -90, 610, 150, 54, 'YES', { shade: 'red', size: 24, name: 'resetYes', cb: () => { Save.reset(); Sound.play('lose'); this.lastResult = null; this.showSettings('title'); this.toast('PROGRESS RESET', '#ff8a80', 470); } });
      makeBtn(this, c, 90, 610, 150, 54, 'NO', { shade: 'blue', size: 24, name: 'resetNo', cb: () => { Sound.play('click'); this.showSettings(from); } });
    }
    makeBtn(this, c, 0, 670, 200, 52, 'CLOSE', { shade: 'blue', size: 24, name: 'settingsClose', cb: () => { Sound.play('click'); this.backFromPopup(); } });
    if (confirmReset) this.ui.settingsClose.disableInteractive().setVisible(false);
  },

  // ------------------------------------------------------------ end of run
  showEnd(r) {
    this.mode = r.won ? 'won' : 'lost';
    this.lastResult = r;
    this.hud.setVisible(true);
    const c = this.newScreen(0.55);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    const g = this.add.graphics();
    g.fillStyle(0x1b1b24, 0.95).fillRoundedRect(-240, 205, 480, 650, 28);
    g.lineStyle(5, r.won ? 0xffe14d : 0xff5a4f, 1).strokeRoundedRect(-240, 205, 480, 650, 28);
    c.add(g);
    this.gearButton(c, 'end', 196, 249);
    c.add(this.add.text(0, 255, r.won ? 'VICTORY!' : 'DEFEATED', style(r.won ? 52 : 54, r.won ? '#ffe14d' : '#ff6b6b', 9)).setOrigin(0.5));
    const sub = r.won ? `You beat the ${r.bossName}!` : r.bossName ? `The ${r.bossName} got you` : `Fell at ${r.pct}% of the track`;
    c.add(this.add.text(0, 300, sub, style(19, '#ffffff', 4)).setOrigin(0.5));
    const e = ERAS[r.era];
    const w = WEAPONS[r.tier ?? r.era * 2];
    c.add(this.add.image(-150, 372, 'weapon_' + w.key).setScale(0.34));
    c.add(this.add.text(-95, 344, 'REACHED', style(15, '#bbbbbb', 0)).setOrigin(0, 0.5));
    c.add(this.add.text(-95, 372, e.name, style(28, col(e.ui === 0x29d8ff ? 0x29f0ff : 0xffffff), 6)).setOrigin(0, 0.5));
    c.add(this.add.text(-95, 401, w.name.toUpperCase(), style(16, '#ffe9b0', 3)).setOrigin(0, 0.5));
    if (r.newBest) c.add(this.add.text(-95, 424, 'NEW BEST WEAPON!', style(14, '#7dff9a', 3)).setOrigin(0, 0.5));
    // coins earned
    const cg = this.add.graphics();
    cg.fillStyle(0x000000, 0.45).fillRoundedRect(-210, 440, 420, 92, 18);
    c.add(cg);
    c.add(this.add.image(-160, 486, 'coin').setScale(1.15));
    const coinT = this.add.text(-110, 474, '+0', style(40, '#ffe14d', 7)).setOrigin(0, 0.5);
    c.add(coinT);
    c.add(this.add.text(-110, 510, r.won ? 'coins earned' : `coins kept (half of ${r.coinsRaw})`, style(15, '#d0d0d0', 0)).setOrigin(0, 0.5));
    c.add(this.add.text(200, 474, `TOTAL\n${fmt(Save.data.coins)}`, style(16, '#ffffff', 3, { align: 'right' })).setOrigin(1, 0.5));
    this.screenTweens.push(this.tweens.addCounter({ from: 0, to: r.coins, duration: 900, delay: 250, onUpdate: (tw) => { if (coinT.active) coinT.setText('+' + fmt(tw.getValue())); } }));
    const lines = [
      ['Enemies defeated', r.kills],
      ['Gates taken', r.gates],
      [r.won ? 'Boss fight' : 'Distance', r.won ? `${r.bossTime.toFixed(1)}s` : `${r.pct}%`],
      ['Run time', `${r.time.toFixed(1)}s`],
    ];
    lines.forEach(([k, v], i) => {
      c.add(this.add.text(-195, 565 + i * 31, k, style(19, '#d0d0d0', 0)).setOrigin(0, 0.5));
      c.add(this.add.text(195, 565 + i * 31, String(v), style(20, '#ffffff', 0)).setOrigin(1, 0.5));
    });
    makeBtn(this, c, 0, 718, 300, 76, r.won ? 'PLAY AGAIN' : 'RETRY', { size: 34, pulse: true, name: 'play', cb: () => { Sound.play('click'); this.startRun(); } });
    makeBtn(this, c, 0, 805, 300, 60, 'UPGRADES', { shade: 'gold', size: 26, name: 'shop', cb: () => { Sound.play('click'); this.showShop('end'); } });
    if (this.canAffordSomething()) this.badge(c, 140, 780);
  },
};

export { Phaser };
