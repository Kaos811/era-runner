// Bonus run after the boss (wins only): a short stretch of multiplier rows. See BONUS in tuning.js.
import Phaser from 'phaser';
import { BONUS } from './tuning.js';
import { tierDps } from './eras.js';
import { Save } from './save.js';
import { Sound } from './audio.js';
import { style } from './ui.js';

const ROW_TINT = [0x7fd0ff, 0x6fe08a, 0xc2e35a, 0xffd34d, 0xff9a3d, 0xff5a6e, 0xd86bff];
export const fmtMult = (m) => 'x' + (Math.round(m * 10) / 10);

export const BonusMethods = {
  bonusBest(level = this.levelN) { return (Save.data.bonusBest || {})[level] || 0; },

  rowHp(i) {
    const ref = tierDps(this.info.era * 2) * this.info.hpMul;
    return Math.max(1, Math.round(ref * BONUS.hpBase * Math.pow(BONUS.hpGrowth, i)));
  },

  startBonus() {
    const b = this.boss;
    this.bossDone = b;
    b.obj.dead = true; b.obj.c?.destroy();
    this.objs = this.objs.filter((o) => o !== b.obj);
    this.boss = null;
    this.bprojs.forEach((p) => p.img?.destroy()); this.bprojs = []; this.bossWarns = [];
    this.projs.forEach((p) => p.img?.destroy()); this.projs = [];
    this.qi = this.level.items.length; // nothing else spawns
    const P = this.pu;
    const F = this.rate * this.dmg * this.shots * (1 + P.double) * (1 + P.twin) * (1 + 0.22 * P.explode + 0.2 * P.chain);
    this.bonus = { t: 0, broken: -1, over: false, endAt: 0, rows: [], fire: F / (tierDps(this.info.era * 2) * this.info.hpMul) };
    const best = this.bonusBest();
    BONUS.mults.forEach((m, i) => this.spawnRow(i, m, BONUS.firstZ + i * BONUS.spacing, best));
    this.runSpeed = BONUS.speed;
    if (this.simulating) return;
    Sound.setSong('run');
    this.banner('BONUS RUN!', 'Break the rows to multiply your coins', 0xffc21a, 'BOSS DEFEATED!');
    if (!this.bonusLabel) this.bonusLabel = this.add.text(270, 272, '', style(34, '#ffe14d', 7)).setOrigin(0.5).setDepth(8600);
    this.bonusLabel.setVisible(true).setText('COINS x1');
  },

  spawnRow(i, mult, z, best) {
    const hp = this.rowHp(i);
    const c = this.add.container(0, 0);
    const key = 'block_' + ['stone', 'bronze', 'medieval', 'gunpowder', 'modern', 'future'][this.info.era];
    const imgs = [-157, 0, 157].map((x) => this.add.image(x, 0, key).setOrigin(0.5, 1).setScale(0.5 * 1.55, 0.5 * 1.25).setTint(ROW_TINT[i]));
    const isBest = best > 0 && Math.abs(best - mult) < 0.01;
    const g = this.add.graphics();
    if (isBest) { g.fillStyle(0xffe14d, 0.95).fillRect(-245, -10, 490, 20); g.lineStyle(6, 0xffe14d, 1).strokeRect(-245, -140, 490, 130); }
    // middle block: the row's HP; side blocks: its coin multiplier
    const hpText = this.add.text(0, -62, String(hp), style(44, '#ffffff', 8)).setOrigin(0.5);
    const tcol = '#' + ROW_TINT[i].toString(16).padStart(6, '0');
    const tag = this.add.container(0, 0, [-157, 157].map((x) => this.add.text(x, -62, fmtMult(mult), style(40, tcol, 8)).setOrigin(0.5)));
    c.add([g, ...imgs, hpText, tag]);
    let bestT = null;
    if (isBest) { bestT = this.add.text(0, -168, `BEST: ${fmtMult(best)}`, style(30, '#ffe14d', 7)).setOrigin(0.5); c.add(bestT); }
    const o = { type: 'brow', c, img: imgs[1], imgs, hpText, tag, bestT, x: 0, z, hp, maxHp: hp, idx: i, mult, halfW: 240, hittable: true, size: 1.5, tint: ROW_TINT[i] };
    this.objs.push(o);
    this.bonus.rows.push(o);
  },

  hitRow(o, p) {
    const P = this.pu;
    // explosions / chain lightning count against a row like they do against a boss
    let dmg = p.dmg * (1 + 0.22 * P.explode);
    if (P.chain && Math.random() < 0.3 + 0.12 * (P.chain - 1)) dmg += p.dmg * 0.7 * (2 + P.chain - 1) * 0.5;
    this.damageRow(o, dmg);
  },

  damageRow(o, dmg) {
    if (o.dead || o.used) return;
    const dealt = Math.min(dmg, o.hp);
    o.hp -= dmg; o.flash = 0.06;
    this.stats.damage += dealt;
    this.addPop(o, dealt);
    if (o.hp <= 0.0001) this.breakRow(o);
    else { o.hpText.setText(String(Math.ceil(o.hp))); if (!this.simulating) Sound.play('hit'); }
  },

  breakRow(o) {
    o.dead = true; o.used = true;
    this.bonus.broken = Math.max(this.bonus.broken, o.idx);
    const last = o.idx === BONUS.mults.length - 1;
    if (last) this.endBonus(false);
    if (this.simulating) return;
    Sound.play('smash'); Sound.play('bandup', Math.min(5, 1 + Math.floor(o.idx * 0.7)));
    const pr = this.projectPt(0, Math.max(o.z, 0));
    for (const x of [-150, 0, 150]) this.burst(pr.x + x * pr.s, pr.y - 50 * pr.s, o.tint, 8);
    this.bonusLabel?.setText('COINS ' + fmtMult(o.mult));
    this.callout(fmtMult(o.mult) + '!', o.tint, 0.8 + 0.08 * o.idx);
  },

  callout(text, color, scale = 1) {
    const t = this.add.text(270, 640, text, style(72, '#' + color.toString(16).padStart(6, '0'), 12)).setOrigin(0.5).setDepth(8650).setScale(0.3 * scale);
    this.tweens.add({ targets: t, scale: scale, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: 590, delay: 450, duration: 400, onComplete: () => t.destroy() });
  },

  endBonus(bumped) {
    const B = this.bonus;
    if (B.over) return;
    B.over = true; B.bumped = bumped; B.endAt = B.t + BONUS.endDelay;
    this.runSpeed = 0;
    if (this.simulating) return;
    if (bumped) { Sound.play('hurt'); this.cameras.main.shake(180, 0.006); }
    this.recoil = 22;
  },

  bonusMult() { const B = this.bonus; return B && B.broken >= 0 ? BONUS.mults[B.broken] : 1; },

  // called from step() while the bonus is on
  bonusStep(dt) {
    const B = this.bonus;
    B.t += dt;
    if (B.over) { if (B.t >= B.endAt) this.finishBonus(); return; }
    for (const o of B.rows) {
      if (o.dead || o.used) continue;
      if (o.z < 40) { o.used = true; this.endBonus(true); break; }
    }
    if (!B.over && B.t >= BONUS.maxTime) this.endBonus(false);
  },

  finishBonus() {
    const mult = this.bonusMult();
    const S = Save.data;
    S.bonusBest = S.bonusBest || {};
    this.bonusNewBest = mult > (S.bonusBest[this.levelN] || 0) && this.bonus.broken >= 0;
    if (this.bonusNewBest) S.bonusBest[this.levelN] = mult;
    this.bonusLabel?.setVisible(false);
    for (const o of this.bonus.rows) { o.dead = true; o.c.destroy(); }
    this.objs = this.objs.filter((o) => o.type !== 'brow');
    this.win();
  },
};
