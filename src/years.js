// Year counter: the weapon's "year" climbs through the level's era as you earn XP (gems).
// Weapon 2 arrives at a fitting year partway through (at); after that
// the year keeps climbing to the era's end over POST x the weapon-2 XP. Loop levels reuse the ranges.
import { style } from './ui.js';

export const ERA_YEARS = [
  { from: -10000, to: -3000, at: -7000 }, // sling
  { from: -3000, to: -800, at: -1800 },    // spear thrower
  { from: 500, to: 1450, at: 1100 },       // repeating crossbow
  { from: 1450, to: 1850, at: 1650 },      // cannon
  { from: 1900, to: 2025, at: 1960 },      // machine gun
  { from: 2100, to: 2400, at: 2250 },      // plasma cannon
].map((r) => ({ ...r, unlock: (r.at - r.from) / (r.to - r.from) }));
const POST = 1.4;
const POP_EVERY = 0.5;

export function fmtYear(y) {
  return y < 0 ? `${Math.abs(y).toLocaleString('en-US')} BC` : `${y} AD`;
}

export const YearMethods = {
  yearFrac() {
    const R = ERA_YEARS[this.info.era];
    const need = this.level.need[0];
    if (this.tier % 2 === 0) return R.unlock * Math.min(1, Math.max(0, this.xp / need));
    return R.unlock + (1 - R.unlock) * Math.min(1, Math.max(0, this.xp / (need * POST)));
  },
  yearNow() {
    const R = ERA_YEARS[this.info.era];
    const y = R.from + (R.to - R.from) * this.yearFrac();
    return y < 0 ? Math.round(y / 10) * 10 : Math.round(y);
  },

  createYearHud() {
    const wrap = (o) => { this.hud.add(o); return o; };
    this.yearText = wrap(this.add.text(0, 96, '', style(16, '#ffe14d', 4)).setOrigin(0, 0.5));
    this.loopTag = wrap(this.add.text(0, 70, '', style(14, '#ff9de2', 4)).setOrigin(0, 0.5));
    this.yearFloat = this.add.text(270, 0, '', style(16, '#ffffff', 4)).setOrigin(0.5).setAlpha(0.85).setDepth(7990);
    this.yrsPops = [];
  },

  resetYears() {
    this.year = this.yearNow();
    this.yrsAcc = 0; this.yrsT = 0;
    (this.yrsPops || []).forEach((t) => t.destroy());
    this.yrsPops = [];
  },

  // gems raise XP -> the year; collect the change and pop '+N YRS' at most every POP_EVERY s
  stepYears(dt) {
    const y = this.yearNow();
    if (y > this.year) this.yrsAcc += y - this.year;
    this.year = y;
    this.yrsT -= dt;
    if (this.yrsT <= 0 && this.yrsAcc > 0) {
      this.yrsT = POP_EVERY;
      const n = this.yrsAcc; this.yrsAcc = 0;
      this.stats.yrsPops = (this.stats.yrsPops || 0) + 1;
      if (!this.simulating && this.yearText) this.popYears(n);
    }
  },

  popYears(n) {
    const t = this.add.text(this.yearText.x + this.yearText.width + 8, 96, `+${n.toLocaleString('en-US')} YRS`, style(14, '#7dff9a', 4)).setOrigin(0, 0.5);
    this.hud.add(t);
    this.yrsPops.push(t);
    this.tweens.add({ targets: t, y: 74, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.easeOut', onComplete: () => { t.destroy(); this.yrsPops = this.yrsPops.filter((q) => q !== t); } });
  },

  updateYearHud() {
    if (!this.yearText) return;
    const s = fmtYear(this.year ?? this.yearNow());
    if (this.yearText.text !== s) {
      this.yearText.setText(s);
      this.yearFloat.setText(s);
      this.yearText.setScale(1.15);
      this.tweens.add({ targets: this.yearText, scale: 1, duration: 140 });
    }
    this.yearText.x = this.weapText.x + this.weapText.width + 14;
    const lp = this.info.loop ? `LOOP ${this.info.loop + 1}` : '';
    if (this.loopTag.text !== lp) this.loopTag.setText(lp);
    this.loopTag.x = this.eraText.x + this.eraText.width + 10;
    this.yearFloat.setPosition(270 + this.px, 830 + 44).setVisible(this.mode === 'play');
  },
};
