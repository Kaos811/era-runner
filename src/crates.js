import Phaser from 'phaser';
import { ERAS } from './eras.js';
import { CRATES, GEMS } from './tuning.js';
import { style } from './ui.js';
import { Sound } from './audio.js';

// Gem crates (shoot to raise the number, reach to burst into a weaving gem trail), damage numbers,
// and the visible weapon changes from power-ups. Mixed into GameScene (see the bottom of Game.js).
const MAX_POPS = 26;     // damage numbers on screen at once
const POP_EVERY = 0.22;  // rapid hits on one target are summed into one number this often
const fmtNum = (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, ''));

export const CrateMethods = {
  // ---------------------------------------------------------------- crates
  spawnCrate(it, z) {
    const key = ERAS[this.info.era].key;
    const c = this.add.container(0, 0);
    const sh = this.add.image(0, 0, 'shadow').setScale(0.6, 0.45);
    const img = this.add.image(0, 0, 'crate_' + key).setOrigin(0.5, 1).setScale(0.5);
    const num = this.add.text(0, -150, String(CRATES.start), style(40, '#ffffff', 8)).setOrigin(0.5);
    const tag = this.add.text(0, -196, 'GEMS', style(20, '#9ff3ff', 5)).setOrigin(0.5);
    c.add([sh, img, tag, num]);
    this.objs.push({ type: 'crate', c, img, num, tag, x: it.x, z, value: CRATES.start, ref: it.ref || 1, phase: it.phase || 0, halfW: 62, hittable: true, size: 1, idx: it.idx });
  },

  hitCrate(o, p) {
    const before = Math.floor(o.value);
    const gain = Phaser.Math.Clamp((CRATES.perSec * p.dmg) / Math.max(1e-6, o.ref), 0.2, CRATES.maxPerHit);
    o.value = Math.min(CRATES.cap, o.value + gain);
    o.flash = 0.05;
    const now = Math.floor(o.value);
    if (now !== before) {
      o.num.setText(String(now));
      if (!this.simulating) {
        o.pop = 1.35;
        this.addPop(o, now - before, 'crate');
        Sound.play('crateHit', now / CRATES.cap);
      }
    }
  },

  burstCrate(o) {
    o.used = true; o.dead = true;
    const n = Math.floor(o.value);
    const dz = CRATES.trailStartZ;
    for (let i = 0; i < n; i++) {
      // weave: a smooth lane-to-lane wave, starting from the crate's lane
      const x = Phaser.Math.Clamp(o.x * Math.cos((i / CRATES.weavePeriod) * Math.PI * 2) + CRATES.weaveAmp * Math.sin((i / CRATES.weavePeriod) * Math.PI * 2 + o.phase) * Math.min(1, i / 6), -200, 200);
      this.gems.push({ x, z: dz + i * CRATES.trailSpacing, xp: 1, trail: true, pull: false, img: null, t: i * 0.5 });
    }
    this.trailRun = 0;
    this.stats.crates.push(n);
    if (this.simulating) return;
    Sound.play('crateBurst');
    const pr = this.projectPt(o.x, Math.max(o.z, 0));
    this.burst(pr.x, pr.y - 60 * pr.s, 0x7fe8ff, 22);
    this.cameras.main.shake(140, 0.006);
    this.toast(`+${n} GEMS!`, '#9ff3ff', pr.y - 140);
  },

  // ---------------------------------------------------------------- damage numbers
  addPop(o, v, kind = 'dmg') {
    if (this.simulating || !(v > 0)) return;
    o.popAcc = (o.popAcc || 0) + v;
    o.popKind = kind;
    if (!this.popList.includes(o)) this.popList.push(o);
  },

  stepPops(dt) {
    if (this.simulating) return;
    for (const o of this.popList) {
      o.popT = (o.popT || 0) - dt;
      if (o.popT > 0 || !(o.popAcc > 0)) continue;
      const boss = o.type === 'boss';
      o.popT = boss ? POP_EVERY * 1.7 : POP_EVERY;
      const v = o.popAcc; o.popAcc = 0;
      const z = boss ? o.z : Math.max(o.z, 0);
      const pr = this.projectPt(o.x + (Math.random() - 0.5) * (boss ? 220 : 50), z);
      const y = pr.y - (boss ? 260 : o.type === 'crate' ? 120 : 90 * (o.size || 1)) * pr.s - 10;
      this.spawnPop(pr.x, y, o.popKind === 'crate' ? `+${v}` : fmtNum(v), o.popKind === 'crate' ? '#7fe8ff' : boss ? '#ffe14d' : '#ffffff', boss ? 26 : 20);
    }
    this.popList = this.popList.filter((o) => !o.dead || o.popAcc > 0);
  },

  spawnPop(x, y, text, color, size) {
    let t = this.popPool.find((p) => !p.visible);
    if (!t) {
      if (this.popPool.length >= MAX_POPS) return;
      t = this.add.text(0, 0, '', style(20, '#ffffff', 5)).setOrigin(0.5).setDepth(8200);
      this.popPool.push(t);
    }
    t.setText(text).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setScale(0.6).setVisible(true);
    this.tweens.killTweensOf(t);
    this.tweens.add({ targets: t, scale: 1, duration: 110, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, delay: 160, duration: 480, ease: 'Cubic.easeIn', onComplete: () => t.setVisible(false) });
  },

  clearPops() {
    (this.popPool || []).forEach((t) => t.destroy());
    this.popPool = [];
    this.popList = [];
  },

  // ---------------------------------------------------------------- the weapon's look
  // Rebuilt whenever a power-up or weapon change could alter it: extra barrels, glowing piercing tip,
  // ember glow (explosive), sparks (chain), golden muzzle rings (double shot), bigger weapon (heavy
  // ammo) and the Twin Weapon copies beside it.
  refreshWeaponLook(pop) {
    if (!this.modC) return;
    this.modC.removeAll(true);
    this.twinC.removeAll(true);
    const P = this.pu;
    const key = 'weapon_' + this.weapon.key;
    const big = Math.min(1.45, Math.pow(P.size, 0.6));
    this.weaponImg.setTexture(key).setScale(0.5 * big);
    const h = this.weaponImg.height * 0.5 * big * 0.92; // weapon height on screen (origin is near the base)
    this.lookTipY = -6 - h;
    const add = (o) => { this.modC.add(o); return o; };
    if (P.explode) add(this.add.image(0, -6 - h * 0.35, 'mod_ember').setScale(0.55 + 0.12 * P.explode).setName('ember'));
    const nb = Math.min(4, P.shots);
    for (let i = 0; i < nb; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      add(this.add.image(side * (24 + k * 15), -6 - h * (0.55 - 0.05 * k), 'mod_barrel').setScale(0.5).setOrigin(0.5, 1).setAngle(side * (8 + k * 6)));
    }
    if (P.pierce) add(this.add.image(0, this.lookTipY + 4, 'mod_tip').setScale(0.42 + 0.08 * P.pierce).setName('tip'));
    if (P.double) add(this.add.image(0, this.lookTipY + 10, 'mod_ring').setScale(0.5).setName('ring'));
    if (P.chain) add(this.add.graphics().setName('spark'));
    // twin copies (a separate container so they can slide to whichever side has room)
    this.twinImgs = [];
    for (let i = 0; i < P.twin; i++) {
      const tw = this.add.container(0, 0);
      tw.add(this.add.image(0, 2, 'shadow').setScale(0.42, 0.34));
      const im = this.add.image(0, -6, key).setOrigin(0.5, 0.92).setScale(0.43 * big);
      tw.add(im);
      if (P.pierce) tw.add(this.add.image(0, -6 - im.height * 0.43 * big * 0.92 + 4, 'mod_tip').setScale(0.36));
      this.twinC.add(tw);
      this.twinImgs.push(tw);
    }
    if (pop && !this.simulating) {
      this.tweens.add({ targets: this.weaponImg, scale: { from: 0.5 * big * 1.35, to: 0.5 * big }, duration: 380, ease: 'Back.easeOut' });
      this.burst(270 + this.px, 760, 0xffffff, 12);
    }
  },

  // world x offsets of the twin weapons: they sit beside you on the side with more room
  twinOffsets() {
    const n = this.pu.twin;
    if (!n) return [];
    const want = this.px > 40 ? -1 : this.px < -40 ? 1 : (this.twinSide || 1);
    this.twinSide = want;
    return n === 1 ? [want * 78] : [-78, 78];
  },

  renderWeaponLook() {
    if (!this.modC) return;
    const P = this.pu;
    const offs = this.twinOffsets();
    this.twinX = this.twinX || [];
    (this.twinImgs || []).forEach((tw, i) => {
      this.twinX[i] = (this.twinX[i] ?? offs[i]) + (offs[i] - (this.twinX[i] ?? offs[i])) * 0.15;
      tw.setPosition(this.twinX[i], this.recoil * 0.8);
    });
    for (const m of this.modC.list) {
      if (m.name === 'tip') m.setAlpha(0.75 + 0.25 * Math.sin(this.time * 10));
      if (m.name === 'ember') m.setAlpha(0.6 + 0.3 * Math.sin(this.time * 13 + Math.sin(this.time * 7))).setAngle(this.time * 40);
      if (m.name === 'ring') m.setAngle(this.time * 90);
      if (m.name === 'spark') {
        m.clear();
        if (Math.random() < 0.5) {
          m.lineStyle(3, 0xbfe9ff, 0.9);
          const y0 = this.lookTipY * (0.3 + Math.random() * 0.6);
          let x = (Math.random() < 0.5 ? -1 : 1) * 18, y = y0;
          m.beginPath(); m.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 26; y -= 8 + Math.random() * 10; m.lineTo(x, y); }
          m.strokePath();
        }
      }
    }
    this.modC.setPosition(0, this.weaponImg.y + 6).setAngle(this.weaponImg.angle);
    void P;
  },
};
