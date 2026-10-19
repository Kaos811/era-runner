import Phaser from 'phaser';
import { RARITIES, LAP, bandOf, bandStart, payout, rollPowerup, freshPowerState, POWERUPS } from './powerups.js';
import { style, col } from './ui.js';
import { Sound } from './audio.js';

// Checkpoint meter, checkpoint gates, the rarity reveal and the in-run power-up effects.
// Mixed into GameScene (see the bottom of Game.js). World units: x across the track, z ahead.
const NOVA_EVERY = (n) => Math.max(3.5, 8 - 1.8 * (n - 1));
const SHIELD_RECHARGE = 8;

export const CheckpointMethods = {
  resetPowers() {
    this.meter = 0;
    this.pu = freshPowerState();
    this.puCount = {};
    this.puOrder = [];
    this.puT = { blade: 0, bladeThrow: 0, nova: 0, drone: 0, ang: 0 };
    this.pauseT = 0;
    (this.revealObjs || []).forEach((o) => o.active && o.destroy());
    this.revealObjs = [];
    this.revealFace = -1;
    (this.puSprites || []).forEach((s) => s.destroy());
    this.puSprites = [];
    this.refreshPuIcons?.();
  },

  addMeter(pts) { this.meter += pts; },
  meterLap() { return Math.floor(this.meter / LAP); },
  meterBand() { return bandOf(this.meter - this.meterLap() * LAP); },

  spawnCheckpoint(it, z) {
    const c = this.add.container(0, 0);
    const arch = this.add.image(0, 0, 'checkpoint').setOrigin(0.5, 1).setScale(0.5);
    const t = this.add.text(0, -338, 'CHECKPOINT', style(46, '#ffffff', 8)).setOrigin(0.5);
    c.add([arch, t]);
    this.objs.push({ type: 'checkpoint', c, img: arch, label: t, x: 0, z, halfW: 0, hittable: false, size: 1, idx: it.idx });
  },

  // ---- cash out: one reward per completed lap (Legendary) + the band of the partial lap
  cashOut(o) {
    o.used = true;
    const pts = this.meter;
    const bands = payout(pts);
    const picks = bands.map((b) => rollPowerup(b));
    picks.forEach((u) => this.applyPowerup(u));
    this.stats.checkpoints.push({ pts: Math.round(pts), bands, laps: Math.floor(pts / LAP), ids: picks.map((u) => u.id) });
    this.meter = 0;
    if (this.simulating) return;
    this.revealRewards(picks, bands, pts);
  },

  applyPowerup(u) {
    u.apply(this.pu, this);
    if (!this.puCount[u.id]) this.puOrder.push(u.id);
    this.puCount[u.id] = (this.puCount[u.id] || 0) + 1;
    if (!this.simulating) this.refreshPuIcons();
  },

  // ---- the reveal: gems fly into the gate, then one card per reward flips over
  revealRewards(picks, bands, pts) {
    const n = picks.length;
    const per = 1.35;
    const T = 0.55 + n * per + 0.45;
    const run = this.runId;
    this.pauseT = 999; // held until the reveal's last tween finishes (same clock as the cards)
    this.dragging = false;
    const D0 = 9300;
    Sound.play('checkpoint');
    // gems fly from the meter into the gate
    const k = Math.min(18, Math.max(4, Math.round(pts / 3)));
    for (let i = 0; i < k; i++) {
      const gem = this.add.image(30 + Math.random() * 480, 160 + (this.hudY || 0), 'gem').setScale(0.5).setDepth(D0);
      this.tweens.add({ targets: gem, x: 270 + (Math.random() - 0.5) * 120, y: 640, scale: 0.9, duration: 380, delay: i * 18, ease: 'Cubic.easeIn', onComplete: () => gem.destroy() });
    }
    const dim = this.add.rectangle(-540, -200, 540 * 4, 2000, 0x000000, 0).setOrigin(0).setDepth(D0 - 1);
    this.tweens.add({ targets: dim, fillAlpha: 0.5, duration: 250 });
    const header = this.add.text(270, 250, n > 1 ? `${n} POWER-UPS!` : 'POWER-UP!', style(34, '#ffffff', 7)).setOrigin(0.5).setDepth(D0 + 2).setAlpha(0);
    this.tweens.add({ targets: header, alpha: 1, duration: 200, delay: 350 });
    const cleanup = [dim, header];
    this.revealObjs = cleanup;
    this.revealFace = -1;
    picks.forEach((u, i) => {
      const band = bands[i];
      const R = RARITIES[band];
      const start = 450 + i * per * 1000;
      this.tweens.addCounter({ from: 0, to: 1, duration: 1, delay: start, onComplete: () => {
        if (!header.active || this.runId !== run) return;
        const card = this.makeCard(u, R, n > 1 ? `${i + 1} / ${n}` : '');
        card.setDepth(D0 + 3);
        cleanup.push(card);
        const back = card.getByName('back'), face = card.getByName('face');
        face.setVisible(false);
        card.setScale(0.2, 0.2);
        this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
        // flip: squash to 0 width, swap to the face, expand
        this.tweens.add({ targets: card, scaleX: 0, duration: 150, delay: 260, ease: 'Sine.easeIn', onComplete: () => {
          if (!card.active) return;
          back.setVisible(false); face.setVisible(true);
          this.revealFace = i;
          Sound.play('rarity' + band);
          if (band >= 3) this.cameras.main.flash(200, (R.color >> 16) & 255, (R.color >> 8) & 255, R.color & 255);
          this.burst(270, 470, R.color, band >= 4 ? 26 : 10 + band * 3);
          this.tweens.add({ targets: card, scaleX: 1, duration: 170, ease: 'Back.easeOut' });
        } });
        if (i < n - 1) this.tweens.add({ targets: card, x: 270 - 600, alpha: 0, delay: per * 1000 - 260, duration: 200, ease: 'Cubic.easeIn' });
      } });
    });
    this.tweens.addCounter({ from: 0, to: 1, duration: 1, delay: T * 1000, onComplete: () => {
      if (this.runId === run) this.pauseT = 0;
      cleanup.forEach((o) => { if (o.active) this.tweens.add({ targets: o, alpha: 0, duration: 200, onComplete: () => o.destroy() }); });
    } });
  },

  makeCard(u, R, counter) {
    const c = this.add.container(270, 470);
    const back = this.add.container(0, 0).setName('back');
    const bg = this.add.graphics();
    bg.fillStyle(0x1b1f2e, 1).fillRoundedRect(-130, -170, 260, 340, 24);
    bg.lineStyle(6, 0xffffff, 0.8).strokeRoundedRect(-130, -170, 260, 340, 24);
    bg.fillStyle(0xffffff, 0.08).fillRoundedRect(-110, -150, 220, 300, 18);
    back.add([bg, this.add.text(0, 0, '?', style(110, '#ffffff', 10)).setOrigin(0.5)]);
    const face = this.add.container(0, 0).setName('face');
    const fg = this.add.graphics();
    fg.fillStyle(R.color, 0.35).fillRoundedRect(-142, -182, 284, 364, 30);
    fg.fillStyle(0x161a26, 1).fillRoundedRect(-130, -170, 260, 340, 24);
    fg.fillStyle(R.color, 1).fillRoundedRect(-130, -170, 260, 56, { tl: 24, tr: 24, bl: 0, br: 0 });
    fg.lineStyle(6, R.color, 1).strokeRoundedRect(-130, -170, 260, 340, 24);
    fg.fillStyle(R.color, 0.18).fillCircle(0, -30, 70);
    face.add([fg,
      this.add.text(0, -142, R.name, style(26, '#1a1a1a', 0)).setOrigin(0.5),
      this.add.image(0, -30, u.icon).setScale(1.6),
      this.add.text(0, 66, u.name.toUpperCase(), style(u.name.length > 13 ? 22 : 26, '#ffffff', 6)).setOrigin(0.5),
      this.add.text(0, 112, u.desc, style(16, R.text, 3, { align: 'center', wordWrap: { width: 230 } })).setOrigin(0.5)]);
    if (counter) face.add(this.add.text(0, 150, counter, style(14, '#bbbbbb', 0)).setOrigin(0.5));
    c.add([back, face]);
    return c;
  },

  // ---- per-frame power-up effects
  stepPowers(dt) {
    const P = this.pu, T = this.puT;
    if (P.shieldMax && P.shield < P.shieldMax) {
      T.shield = (T.shield || 0) + dt;
      if (T.shield >= SHIELD_RECHARGE) { T.shield = 0; P.shield++; }
    }
    T.ang += dt * 4.2;
    if (P.blades) {
      T.blade -= dt;
      if (T.blade <= 0) {
        T.blade = 0.15;
        for (const b of this.bladePositions()) {
          for (const o of this.objs) {
            if (o.dead || (o.type !== 'enemy' && o.type !== 'block')) continue;
            if (Math.abs(o.x - b.x) < o.halfW + 26 && Math.abs(o.z - b.z) < 50) this.damageObj(o, this.dmg * 1.5);
          }
        }
      }
      T.bladeThrow += dt;
      const every = Math.max(0.5, 2.2 / P.blades);
      if (T.bladeThrow >= every) {
        T.bladeThrow = 0;
        this.spawnProj({ x: this.px, z: 60, speed: 1050, r: 26, dmg: this.dmg * 4, pierce: 3, tex: 'blade', spin: true, sc: 0.9 });
        if (!this.simulating) Sound.play('blade');
      }
    }
    if (P.nova) {
      T.nova += dt;
      if (T.nova >= NOVA_EVERY(P.nova)) { T.nova = 0; this.novaBlast(); }
    }
    if (P.drone) {
      T.drone -= dt;
      if (T.drone <= 0) {
        T.drone = 1 / (2.6 * P.drone);
        T.droneSide = -(T.droneSide || 1);
        const fromX = this.px + 85 * T.droneSide;
        let tx = fromX;
        if (this.boss && this.boss.obj.hittable) tx = this.boss.obj.x;
        else {
          const t = this.objs.filter((o) => (o.type === 'enemy' || o.type === 'block') && !o.dead && o.z > 40 && o.z < 1300).sort((a, b) => a.z - b.z)[0];
          if (t) tx = t.x;
        }
        this.spawnProj({ x: Phaser.Math.Clamp(tx, -230, 230), z: 50, speed: 1900, r: 10, dmg: this.dmg * 1.6, tex: 'p_drone', sc: 1 });
      }
    }
  },

  bladePositions() {
    const n = this.pu.blades;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = this.puT.ang + (i * Math.PI * 2) / n;
      out.push({ x: this.px + Math.cos(a) * 88, z: 55 + Math.sin(a) * 55, a });
    }
    return out;
  },

  novaBlast() {
    const amount = this.dmg * this.rate * this.shots * 3.2;
    let hits = 0;
    for (const o of this.objs) {
      if (o.dead || (o.type !== 'enemy' && o.type !== 'block') || o.z > 1700 || o.z < -40) continue;
      this.damageObj(o, amount, true); hits++;
    }
    if (this.boss && this.boss.obj.hittable) this.bossHit({ dmg: amount * 0.5, noFx: true });
    this.stats.novas = (this.stats.novas || 0) + 1;
    if (this.simulating) return;
    Sound.play('nova');
    this.cameras.main.flash(220, 255, 230, 140);
    const ring = this.add.circle(270 + this.px, 760, 30).setStrokeStyle(16, 0xffd84d, 1).setDepth(8400);
    this.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    if (hits) this.toast('NOVA!', '#ffd84d', 520);
  },

  // damage from power-up effects (no projectile): enemies and blocks only
  damageObj(o, amount, quiet) {
    if (o.dead) return;
    const dealt = Math.min(amount, o.hp);
    o.hp -= amount;
    o.flash = 0.05;
    this.stats.damage += dealt;
    this.stats.puDamage = (this.stats.puDamage || 0) + dealt;
    if (o.hp <= 0.0001) this.kill(o, true);
    else o.hpText?.setText(String(Math.ceil(o.hp)));
  },

  // after a projectile lands: chain lightning and explosions
  afterHit(o, p) {
    const P = this.pu;
    if (p.noFx || (!P.chain && !P.explode)) return;
    const isBoss = o.type === 'boss';
    if (P.explode) {
      const splash = p.dmg * 0.45 * (1 + 0.5 * (P.explode - 1));
      if (isBoss) this.bossHit({ dmg: p.dmg * 0.22 * P.explode, noFx: true });
      else for (const e of this.objs) {
        if (e === o || e.dead || (e.type !== 'enemy' && e.type !== 'block')) continue;
        if (Math.abs(e.x - o.x) < 95 && Math.abs(e.z - o.z) < 130) this.damageObj(e, splash);
      }
      if (!this.simulating && this.time - (this.lastBoom || 0) > 0.08) {
        this.lastBoom = this.time;
        const pr = this.projectPt(o.x, Math.max(o.z, 0));
        const ring = this.add.circle(pr.x, pr.y - 50 * pr.s, 10 * Math.max(pr.s, 0.4), 0xff9a2e, 0.85).setDepth(8300);
        this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
        Sound.play('boom');
      }
    }
    if (P.chain && Math.random() < 0.3 + 0.12 * (P.chain - 1)) {
      const n = 2 + (P.chain - 1);
      const dmg = p.dmg * 0.7;
      if (isBoss) { this.bossHit({ dmg: dmg * n * 0.5, noFx: true }); this.drawZap([{ x: o.x, z: o.z }, { x: o.x + 60, z: o.z + 200 }]); return; }
      const near = this.objs.filter((e) => e !== o && !e.dead && (e.type === 'enemy' || e.type === 'block') && e.z > -20 && e.z < 1600)
        .map((e) => ({ e, d: Math.hypot(e.x - o.x, (e.z - o.z) * 0.5) })).filter((t) => t.d < 300).sort((a, b) => a.d - b.d).slice(0, n);
      if (!near.length) return;
      const path = [{ x: o.x, z: o.z }];
      near.forEach(({ e }) => { path.push({ x: e.x, z: e.z }); this.damageObj(e, dmg); });
      this.stats.zaps = (this.stats.zaps || 0) + 1;
      this.drawZap(path);
    }
  },

  drawZap(path) {
    if (this.simulating) return;
    const g = this.add.graphics().setDepth(8350);
    const pts = path.map((q) => { const pr = this.projectPt(q.x, Math.max(q.z, 0)); return { x: pr.x, y: pr.y - 60 * pr.s }; });
    for (const [w, c, a] of [[9, 0x7fd6ff, 0.5], [4, 0xffffff, 1]]) {
      g.lineStyle(w, c, a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const A = pts[i - 1], B = pts[i];
        for (let k = 1; k <= 4; k++) {
          const t = k / 4;
          const j = k < 4 ? (Math.random() - 0.5) * 22 : 0;
          g.lineTo(A.x + (B.x - A.x) * t + j, A.y + (B.y - A.y) * t + j);
        }
      }
      g.strokePath();
    }
    Sound.play('zap');
    this.tweens.add({ targets: g, alpha: 0, duration: 180, delay: 60, onComplete: () => g.destroy() });
  },

  // returns true if the shield absorbed the hit
  shieldBlock() {
    if (!(this.pu.shield > 0)) return false;
    this.pu.shield--;
    this.puT.shield = 0;
    this.stats.blocked = (this.stats.blocked || 0) + 1;
    if (!this.simulating) { Sound.play('shield'); this.toast('BLOCKED!', '#9ff3ff'); }
    return true;
  },

  // ---- visuals for blades / drones / shield (called from render)
  renderPowers(project, FAR) {
    const P = this.pu;
    const want = P.blades + P.drone + (P.shieldMax ? 1 : 0);
    if (!this.puSprites || this.puSprites.length !== want) {
      (this.puSprites || []).forEach((s) => s.destroy());
      this.puSprites = [];
      for (let i = 0; i < P.blades; i++) this.puSprites.push(this.add.image(0, 0, 'blade').setName('blade'));
      for (let i = 0; i < P.drone; i++) this.puSprites.push(this.add.image(0, 0, 'drone').setName('drone'));
      if (P.shieldMax) this.puSprites.push(this.add.image(0, 0, 'bubble').setName('bubble'));
    }
    let bi = 0, di = 0;
    const blades = this.bladePositions();
    for (const s of this.puSprites) {
      if (s.name === 'blade') {
        const b = blades[bi++];
        const pr = project(b.x, b.z);
        s.setPosition(pr.x, pr.y - 40 * pr.s).setScale(0.5 * pr.s).setRotation(this.puT.ang * 3).setDepth(10 + FAR - b.z);
      } else if (s.name === 'drone') {
        const side = di++ % 2 ? 1 : -1;
        const pr = project(this.px + 85 * side, 10 + 30 * Math.floor(di / 2));
        s.setPosition(pr.x, pr.y - 120 + Math.sin(this.time * 4 + di) * 6).setScale(0.5).setDepth(10 + FAR + 1);
      } else {
        const pr = project(this.px, 0);
        s.setPosition(pr.x, pr.y - 60).setScale(0.62).setDepth(10 + FAR + 2).setAlpha(P.shield > 0 ? 0.55 + 0.15 * Math.sin(this.time * 5) : 0);
      }
    }
  },

  // ---- HUD: checkpoint meter + active power-up icons
  drawMeter(g, y) {
    const x0 = 20, w = 500, h = 18;
    const lap = this.meterLap();
    const inLap = this.meter - lap * LAP;
    g.fillStyle(0x111111, 0.9).fillRoundedRect(x0 - 2, y - 2, w + 4, h + 4, 9);
    RARITIES.forEach((R, i) => {
      const a = x0 + (bandStart(i) / LAP) * w, bw = (R.size / LAP) * w;
      g.fillStyle(R.color, 0.22).fillRect(a, y, bw, h);
      const f = Phaser.Math.Clamp((inLap - bandStart(i)) / R.size, 0, 1);
      if (f > 0) g.fillStyle(R.color, 1).fillRect(a, y, bw * f, h);
      if (i) g.fillStyle(0x000000, 0.8).fillRect(a - 1, y, 2, h);
    });
    g.fillStyle(0xffffff, 0.22).fillRect(x0, y + 2, (inLap / LAP) * w, 5);
    const band = this.meterBand();
    const R = RARITIES[band];
    const label = `${R.name}${lap ? `   x${lap + 1}` : ''}`;
    if (this.meterText.text !== label) { this.meterText.setText(label); this.meterText.setColor(R.text); }
  },

  refreshPuIcons() {
    if (!this.puIcons) return;
    this.puIcons.removeAll(true);
    this.puOrder.forEach((id, i) => {
      const u = POWERUPS.find((p) => p.id === id);
      const R = RARITIES.find((r) => r.key === u.rarity);
      const x = 30 + i * 46, y = 0;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.55).fillRoundedRect(x - 20, y - 20, 40, 40, 9);
      g.lineStyle(3, R.color, 1).strokeRoundedRect(x - 20, y - 20, 40, 40, 9);
      this.puIcons.add(g);
      this.puIcons.add(this.add.image(x, y, u.icon).setScale(0.62));
      const n = this.puCount[id];
      if (n > 1) this.puIcons.add(this.add.text(x + 18, y + 16, `x${n}`, style(13, '#ffffff', 4)).setOrigin(1, 1));
    });
  },
};
