import Phaser from 'phaser';
import { ERAS, eraDps } from '../eras.js';
import { buildLevel, HP_MULT } from '../level.js';

// ---- layout / fake-3D projection ----
const W = 540, H = 960, CX = 270;
const HY = 300;          // horizon line (screen y at infinite distance)
const PY = 830;          // screen y of the ground under the player
const D = 380;           // camera distance: scale = D / (D + z)
const HALF = 235;        // half track width at the player
const FAR = 6000;        // how far the track is drawn
const SPAWN_Z = 1900;    // objects appear this far ahead
const RANGE = 1550;      // projectile range
const RUN = 330;         // run speed (units / s)
const TILE = 150;
const MAX_X = 205;
const TK = 0.5;          // textures are generated at 2x

const project = (x, z) => { const s = D / (D + z); return { s, x: CX + x * s, y: HY + (PY - HY) * s }; };
const col = (c) => '#' + c.toString(16).padStart(6, '0');
const FONT = '"Arial Black", "Arial Bold", "Helvetica Neue", Arial, sans-serif';
const style = (size, color = '#ffffff', stroke = 6, extra = {}) => ({
  fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color, stroke: '#1a1a1a', strokeThickness: stroke, resolution: 2, align: 'center', ...extra,
});
const KIND_LABEL = { rate: 'FIRE RATE', dmg: 'DAMAGE', shot: 'SHOTS', hp: 'HEALTH' };
const fmtGate = (kind, v) => {
  const n = Math.round(v);
  const sign = n > 0 ? '+' : '';
  return kind === 'rate' || kind === 'dmg' ? `${sign}${n}%` : `${sign}${n}`;
};

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.top = 0;

    this.bgOld = this.add.graphics().setDepth(0);
    this.bg = this.add.graphics().setDepth(1);
    this.track = this.add.graphics().setDepth(2);
    this.fog = this.add.graphics().setDepth(3);
    this.fx = this.add.layer().setDepth(6500);

    this.createPlayer();
    this.createHud();

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', () => { this.dragging = false; });
    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,A,D,SPACE,ENTER');

    this.layout();
    this.scale.on('resize', () => this.layout());

    this.bot = null;
    this.simulating = false;
    this.mode = 'title';
    this.resetRun();
    this.showTitle();
    this.exposeHooks();
  }

  // The camera always shows the 540x960 design area; extra screen space (tall phones, desktop)
  // extends the sky above and the track below, and the HUD sticks to the top edge.
  layout() {
    const cam = this.cameras.main;
    const gw = this.scale.gameSize.width, gh = this.scale.gameSize.height;
    cam.setSize(gw, gh);
    cam.setZoom(Math.min(gw / W, gh / H));
    cam.centerOn(W / 2, H / 2);
    const vh = gh / cam.zoom;
    this.top = Math.min(0, H / 2 - vh / 2);
    this.viewH = vh;
    // a little breathing room under the phone's status bar when there is spare height
    this.hudY = this.top + Math.min(-this.top, 14);
    if (this.hud) this.hud.y = this.hudY;
    if (this.hurtFlash) this.hurtFlash.setSize(W * 4, vh + 40).setPosition(-W * 1.5, this.top - 20);
  }

  // ------------------------------------------------------------------ run state
  resetRun() {
    (this.objs || []).forEach((o) => o.c.destroy());
    (this.projs || []).forEach((p) => p.img.destroy());
    this.fx.removeAll(true);
    this.level = buildLevel();
    this.qi = 0;
    this.objs = [];
    this.projs = [];
    this.d = 0; this.px = 0; this.tx = 0;
    this.hp = 100; this.maxHp = 100;
    this.era = 0; this.xp = 0;
    this.rateB = 0; this.dmgB = 0; this.extra = 0;
    this.fireT = 0.3; this.time = 0; this.recoil = 0;
    this.stats = { kills: 0, blocks: 0, gates: 0, damage: 0, hitsTaken: 0 };
    this.eraTimes = [0];
    this.finishPassed = false;
    this.setEraVisuals(0, true);
    this.weaponImg.setTexture('weapon_' + ERAS[0].key);
    this.updateHud(true);
  }

  get rate() { return ERAS[this.era].rate * Math.max(0.4, 1 + this.rateB / 100); }
  get dmg() { return ERAS[this.era].dmg * Math.max(0.4, 1 + this.dmgB / 100); }
  get shots() { return Phaser.Math.Clamp(1 + this.extra, 1, 5); }

  // ------------------------------------------------------------------ input
  onDown(p) {
    if (this.mode !== 'play') return;
    this.dragging = true;
    this.dragX = p.x / 2;
    this.dragStart = this.tx;
  }
  onMove(p) {
    if (this.mode !== 'play' || !this.dragging || !p.isDown) return;
    this.tx = Phaser.Math.Clamp(this.dragStart + (p.x / 2 - this.dragX) * 1.35, -MAX_X, MAX_X);
  }

  // ------------------------------------------------------------------ main loop
  update(_t, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (this.mode === 'play') {
      if (this.keys) {
        const k = this.keys;
        const dir = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
        if (dir) this.tx = Phaser.Math.Clamp(this.tx + dir * 520 * dt, -MAX_X, MAX_X);
      }
      if (this.bot) this.botSteer(dt);
      this.step(dt);
    } else {
      // attract mode / end screen: keep the track scrolling gently
      this.d += (this.mode === 'title' ? 120 : 40) * dt;
    }
    this.render();
  }

  step(dt) {
    this.time += dt;
    this.d += RUN * dt;
    const L = this.level;

    // spawn
    while (this.qi < L.items.length && L.items[this.qi].at - this.d < SPAWN_Z) this.spawn(L.items[this.qi++]);

    // player steering (smoothed)
    this.px += (this.tx - this.px) * Math.min(1, dt * 14);

    // move objects
    for (const o of this.objs) {
      if (o.dead) continue;
      o.z -= (RUN + (o.walk || 0)) * dt;
      if (o.type === 'enemy' && o.z < 1100 && o.z > 60) {
        const dx = this.px - o.x;
        o.x += Math.sign(dx) * Math.min(Math.abs(dx), 32 * dt);
      }
      if (o.flash > 0) o.flash -= dt;
    }

    // fire
    this.fireT -= dt;
    while (this.fireT <= 0) { this.fire(); this.fireT += 1 / this.rate; }

    // projectiles
    for (const p of this.projs) {
      if (p.dead) continue;
      const nz = p.z + p.speed * dt;
      let best = null;
      for (const o of this.objs) {
        if (o.dead || o.used || !o.hittable) continue;
        if (Math.abs(o.x - p.x) > o.halfW + p.r) continue;
        if (o.z < p.z - 45 || o.z > nz + 20) continue;
        if (!best || o.z < best.z) best = o;
      }
      p.z = nz;
      if (best) { this.hit(best, p); p.dead = true; }
      else if (p.z > RANGE) p.dead = true;
    }

    // collisions with the player
    for (const o of this.objs) {
      if (o.dead) continue;
      if (o.type === 'gate') {
        if (!o.pair.used && o.z <= 0) this.takeGate(o.pair);
      } else if ((o.type === 'enemy' || o.type === 'block') && o.z < 30 && o.z > -40 && Math.abs(o.x - this.px) < o.halfW + 30) {
        this.hurt(o.dmg);
        this.kill(o, false);
      } else if (o.type === 'finish' && o.z <= 0 && !this.finishPassed) {
        this.finishPassed = true;
        this.win();
        return;
      }
      if (o.z < -260) o.dead = true;
    }

    // cleanup
    this.objs = this.objs.filter((o) => { if (o.dead && !o.dying) o.c.destroy(); return !o.dead || o.dying; });
    this.projs = this.projs.filter((p) => { if (p.dead) p.img.destroy(); return !p.dead; });

    if (this.hp <= 0) this.lose();
  }

  fire() {
    const e = ERAS[this.era];
    const n = this.shots;
    const spacing = e.key === 'gunpowder' ? 30 : 22;
    for (let i = 0; i < n; i++) {
      const x = this.px + (i - (n - 1) / 2) * spacing;
      const img = this.add.image(0, 0, 'p_' + e.proj).setOrigin(0.5, 0.5);
      this.projs.push({ img, x, z: 40, speed: e.pspeed, r: e.pr, dmg: this.dmg });
    }
    this.recoil = e.key === 'gunpowder' ? 12 : 6;
  }

  hit(o, p) {
    o.flash = 0.06;
    if (o.type === 'gate') {
      const g = o.gate;
      const per = 2.4 / this.rate;
      if (g.kind === 'shot') g.prog = (g.prog || 0) + per / 7;
      else g.prog = (g.prog || 0) + per * (g.kind === 'hp' ? 1 : 0.9);
      if (g.prog >= 1) {
        const inc = Math.floor(g.prog);
        g.prog -= inc;
        g.value = Math.min(g.kind === 'shot' ? 2 : g.kind === 'hp' ? 50 : 50, g.value + inc);
        this.refreshGate(o);
      }
      return;
    }
    const dealt = Math.min(p.dmg, o.hp);
    o.hp -= p.dmg;
    this.stats.damage += dealt;
    this.gainXp(dealt);
    if (o.hp <= 0.0001) {
      this.kill(o, true);
    } else {
      o.hpText.setText(String(Math.ceil(o.hp)));
    }
  }

  kill(o, byShot) {
    o.dead = true;
    if (byShot) { if (o.type === 'enemy') this.stats.kills++; else this.stats.blocks++; }
    if (this.simulating) return;
    const pr = project(o.x, Math.max(o.z, 0));
    const color = o.type === 'block' ? 0x9a8a70 : ERAS[o.eraLook].burst;
    for (let i = 0; i < 9; i++) {
      const dot = this.add.image(pr.x, pr.y - 40 * pr.s * o.size, 'dot').setTint(i % 3 ? color : 0xffffff).setScale(0.5 * pr.s * (0.6 + Math.random()));
      this.fx.add(dot);
      const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 50) * pr.s;
      this.tweens.add({ targets: dot, x: pr.x + Math.cos(a) * r, y: pr.y - 40 * pr.s + Math.sin(a) * r, alpha: 0, scale: 0.1, duration: 380, onComplete: () => dot.destroy() });
    }
    if (byShot) {
      const gems = o.type === 'block' ? 3 : 1 + Math.floor(o.size);
      for (let i = 0; i < gems; i++) {
        const gem = this.add.image(pr.x + (i - gems / 2) * 10, pr.y - 30 * pr.s, 'gem').setScale(0.6);
        this.fx.add(gem);
        this.tweens.add({ targets: gem, x: 60 + this.xpFrac() * 420, y: 122 + (this.hudY || 0), scale: 0.35, duration: 520 + i * 60, ease: 'Cubic.easeIn', onComplete: () => { gem.destroy(); this.pulseXp(); } });
      }
    }
  }

  gainXp(v) {
    this.xp += v;
    const need = this.level.need;
    while (this.era < 5 && this.xp >= need[this.era]) {
      this.xp -= need[this.era];
      this.evolve();
    }
  }

  evolve() {
    this.era++;
    this.eraTimes.push(this.time);
    const e = ERAS[this.era];
    if (this.simulating) return;
    this.weaponImg.setTexture('weapon_' + e.key);
    this.tweens.add({ targets: this.weaponImg, scale: { from: TK * 1.6, to: TK }, duration: 420, ease: 'Back.easeOut' });
    this.cameras.main.flash(260, 255, 255, 255);
    this.setEraVisuals(this.era, false);
    this.banner(`${e.name}!`, `New weapon: ${e.weapon}`, e.ui);
    this.updateHud(true);
  }

  takeGate(pair) {
    pair.used = true;
    const side = this.px < 0 ? 0 : 1;
    const chosen = pair.objs[side];
    const other = pair.objs[1 - side];
    const g = chosen.gate;
    const v = Math.round(g.value);
    if (g.kind === 'rate') this.rateB += v;
    if (g.kind === 'dmg') this.dmgB += v;
    if (g.kind === 'shot') this.extra = Phaser.Math.Clamp(this.extra + v, 0, 4);
    if (g.kind === 'hp') this.hp = Math.min(this.maxHp, this.hp + Math.max(v, 0));
    this.rateB = Math.max(-60, this.rateB);
    this.dmgB = Math.max(-60, this.dmgB);
    this.stats.gates++;
    chosen.dead = true; other.dead = true;
    if (this.simulating) return;
    const good = v > 0;
    this.toast(`${fmtGate(g.kind, v)} ${KIND_LABEL[g.kind]}`, good ? '#7dff9a' : '#ff6b6b');
    if (!good) this.cameras.main.shake(120, 0.004);
    this.updateHud(true);
  }

  hurt(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.stats.hitsTaken++;
    if (this.simulating) return;
    this.cameras.main.shake(160, 0.008);
    this.hurtFlash.setAlpha(0.45);
    this.tweens.add({ targets: this.hurtFlash, alpha: 0, duration: 350 });
    this.updateHud(true);
  }

  // ------------------------------------------------------------------ spawning
  spawn(it) {
    const z = it.at - this.d;
    const look = this.era;
    const eraKey = ERAS[look].key;
    if (it.type === 'enemy' || it.type === 'block') {
      // Catch-up: if the player is behind the curve (wrong gates, missed evolutions), soften this
      // section's enemies so a struggling run can still recover instead of snowballing.
      const expected = eraDps(it.section) * HP_MULT[it.section] * 1.4;
      const ease = Phaser.Math.Clamp((this.rate * this.dmg * this.shots) / expected, 0.4, 1);
      it = { ...it, hp: Math.max(1, Math.round(it.hp * ease)) };
      const c = this.add.container(0, 0);
      const isE = it.type === 'enemy';
      const sh = this.add.image(0, 0, 'shadow').setScale(TK * (isE ? 0.9 : 1.1) * it.size, TK * it.size);
      const img = this.add.image(0, 0, (isE ? 'enemy_' : 'block_') + eraKey).setOrigin(0.5, 1).setScale(TK * it.size * (isE ? 1.25 : 1.1));
      const hpText = this.add.text(0, isE ? -138 * it.size : -46, String(it.hp), style(isE ? 28 : 32, '#ffffff', 6)).setOrigin(0.5);
      c.add([sh, img, hpText]);
      if (it.size > 1.3 && isE) img.setTint(0xffd0c0);
      this.objs.push({ type: it.type, c, img, hpText, x: it.x, z, hp: it.hp, maxHp: it.hp, size: it.size, dmg: it.dmg, halfW: (isE ? 36 : 50) * it.size,
        walk: isE ? 55 : 0, hittable: true, eraLook: look, bob: Math.random() * 6 });
    } else if (it.type === 'gate') {
      const pair = { used: false, objs: [] };
      it.gates.forEach((gd, i) => {
        const gate = { ...gd, prog: 0 };
        const x = i === 0 ? -HALF / 2 : HALF / 2;
        const c = this.add.container(0, 0);
        const sh = this.add.image(0, 0, 'shadow').setScale(TK * 2.1, TK * 0.8);
        const panel = this.add.image(0, -10, 'gate').setOrigin(0.5, 1).setScale(TK * 1.0, TK * 1.0).setAlpha(0.92);
        const label = this.add.text(0, -140, KIND_LABEL[gate.kind], style(22, '#ffffff', 5)).setOrigin(0.5);
        const value = this.add.text(0, -82, '', style(54, '#ffffff', 8)).setOrigin(0.5);
        c.add([sh, panel, label, value]);
        const o = { type: 'gate', c, img: panel, panel, label, value, gate, pair, x, z, halfW: HALF / 2 - 4, hittable: true, size: 1 };
        pair.objs.push(o);
        this.objs.push(o);
        this.refreshGate(o);
      });
    } else if (it.type === 'finish') {
      const c = this.add.container(0, 0);
      const flag = this.add.image(0, 0, 'flag').setOrigin(0.5, 1).setScale(TK);
      const t = this.add.text(0, -186, 'FINISH', style(34, '#ffe14d', 7)).setOrigin(0.5);
      c.add([flag, t]);
      this.objs.push({ type: 'finish', c, x: 0, z, halfW: 0, hittable: false, size: 1 });
      this.finishZ = it.at;
    }
  }

  refreshGate(o) {
    const g = o.gate;
    const good = g.value > 0;
    o.panel.setTint(good ? 0x2fbf62 : (g.value === 0 ? 0x8a8a8a : 0xe0463a));
    o.value.setText(fmtGate(g.kind, g.value));
    if (!this.simulating && o.c.active) {
      o.pop = 1.3;
      this.tweens.add({ targets: o, pop: 1, duration: 160 });
    }
  }

  // ------------------------------------------------------------------ render
  render() {
    this.drawTrack();
    for (const o of this.objs) {
      if (o.dead) continue;
      const pr = project(o.x, Math.max(o.z, -300));
      const bob = o.type === 'enemy' ? Math.abs(Math.sin(this.time * 9 + o.bob)) * 5 : 0;
      o.c.setPosition(pr.x, pr.y).setScale(pr.s).setDepth(10 + FAR - o.z);
      if (o.type === 'enemy') o.img.y = -bob;
      // keep numbers readable far away: never shrink text below ~45% of full size on screen
      const ts = Math.max(1, 0.45 / pr.s);
      if (o.hpText) o.hpText.setScale(ts);
      if (o.type === 'gate') { o.value.setScale(Math.max(1, 0.3 / pr.s) * (o.pop || 1)); o.label.setScale(Math.max(1, 0.36 / pr.s)); }
      const fade = o.z > 1500 ? Phaser.Math.Clamp((SPAWN_Z - o.z) / 400, 0, 1) : 1;
      o.c.setAlpha(fade);
      if (o.img && o.type !== 'gate') {
        if (o.flash > 0) o.img.setTintFill(0xffffff);
        else if (o.size > 1.3 && o.type === 'enemy') o.img.setTint(0xffd0c0);
        else o.img.clearTint();
      } else if (o.type === 'gate') {
        o.panel.setAlpha(o.flash > 0 ? 1 : 0.92);
      }
    }
    for (const p of this.projs) {
      const pr = project(p.x, p.z);
      p.img.setPosition(pr.x, pr.y - 58 * pr.s).setScale(TK * pr.s).setDepth(10 + FAR - p.z);
    }
    // player
    this.recoil = Math.max(0, this.recoil - 1.2);
    this.player.setPosition(CX + this.px, PY);
    this.weaponImg.y = -6 + this.recoil;
    this.weaponImg.angle = Phaser.Math.Clamp((this.tx - this.px) * 0.12, -12, 12);
    this.updateHud(false);
  }

  drawTrack() {
    const e = ERAS[this.visEra];
    const g = this.track;
    g.clear();
    g.fillStyle(e.ground, 1).fillRect(-W, HY, W * 3, H * 2);
    // darker ground bands beside the track give a sense of speed
    const quad = (x0, x1, za, zb, color, alpha = 1) => {
      const a = project(0, za), b = project(0, zb);
      g.fillStyle(color, alpha);
      g.fillPoints([{ x: CX + x0 * a.s, y: a.y }, { x: CX + x1 * a.s, y: a.y }, { x: CX + x1 * b.s, y: b.y }, { x: CX + x0 * b.s, y: b.y }], true);
    };
    const zNear = -210;
    const first = Math.floor((this.d + zNear) / TILE);
    const groundDark = Phaser.Display.Color.IntegerToColor(e.ground).darken(8).color;
    for (let i = first; ; i++) {
      const za = Math.max(i * TILE - this.d, zNear), zb = Math.min((i + 1) * TILE - this.d, FAR);
      if (za >= FAR) break;
      if (i % 2) { quad(-2400, -HALF - 14, za, zb, groundDark); quad(HALF + 14, 2400, za, zb, groundDark); }
      quad(-HALF, HALF, za, zb, e.track[i & 1]);
    }
    // rails
    quad(-HALF - 14, -HALF, zNear, FAR, e.rail);
    quad(HALF, HALF + 14, zNear, FAR, e.rail);
    if (e.neon) { quad(-HALF - 4, -HALF, zNear, FAR, 0xffffff, 0.8); quad(HALF, HALF + 4, zNear, FAR, 0xffffff, 0.8); }
    // posts along the rails
    const postC = Phaser.Display.Color.IntegerToColor(e.rail).darken(15).color;
    for (let i = first; ; i++) {
      const z = i * TILE * 2 - this.d;
      if (z > FAR) break;
      if (z < zNear) continue;
      const pr = project(0, z);
      g.fillStyle(postC, 1);
      g.fillRect(CX - (HALF + 12) * pr.s, pr.y - 26 * pr.s, 10 * pr.s, 26 * pr.s);
      g.fillRect(CX + (HALF + 2) * pr.s, pr.y - 26 * pr.s, 10 * pr.s, 26 * pr.s);
    }
    // finish line on the ground
    if (this.finishZ) {
      const fz = this.finishZ - this.d;
      if (fz > zNear && fz < FAR) {
        const n = 12;
        for (let r = 0; r < 2; r++) for (let c = 0; c < n; c++) {
          const x0 = -HALF + (c * 2 * HALF) / n, x1 = x0 + (2 * HALF) / n;
          quad(x0, x1, fz + r * 20, fz + r * 20 + 20, (r + c) % 2 ? 0x222222 : 0xffffff);
        }
      }
    }
    // horizon fog
    const f = this.fog;
    f.clear();
    f.fillGradientStyle(e.sky[1], e.sky[1], e.sky[1], e.sky[1], 1, 1, 0, 0);
    f.fillRect(-W, HY - 1, W * 3, 70);
  }

  setEraVisuals(k, instant) {
    this.visEra = k;
    if (!instant) {
      this.bgOld.clear();
      this.drawBackground(this.bgOld, this.prevBgEra ?? k);
      this.bgOld.setAlpha(1);
      this.bg.setAlpha(0);
      this.tweens.add({ targets: this.bg, alpha: 1, duration: 700 });
    } else this.bg.setAlpha(1);
    this.bg.clear();
    this.drawBackground(this.bg, k);
    this.prevBgEra = k;
  }

  drawBackground(g, k) {
    const e = ERAS[k];
    g.fillStyle(e.sky[0], 1).fillRect(-W, -H, W * 3, H + 2);
    g.fillGradientStyle(e.sky[0], e.sky[0], e.sky[1], e.sky[1], 1);
    g.fillRect(-W, 0, W * 3, HY + 2);
    const base = HY + 2;
    const s = e.sil, s2 = e.sil2;
    const r = (x, y, w, h, c = s) => { g.fillStyle(c, 1); g.fillRect(x, base - y - h, w, h); };
    switch (e.key) {
      case 'stone':
        g.fillStyle(0xfff3c4, 0.9).fillCircle(410, 215, 34);
        g.fillStyle(s2, 1).fillTriangle(-40, base, 120, 170, 280, base).fillTriangle(300, base, 470, 160, 620, base);
        g.fillStyle(s, 1).fillTriangle(60, base, 200, 205, 340, base).fillTriangle(330, base, 420, 220, 520, base);
        g.fillStyle(0x6b4a2f, 1).fillTriangle(140, base, 175, 236, 215, base);
        g.fillStyle(0xffffff, 0.35).fillCircle(178, 222, 10).fillCircle(190, 206, 14).fillCircle(206, 188, 17);
        break;
      case 'bronze':
        g.fillStyle(0xfff8d8, 0.9).fillCircle(120, 210, 30);
        g.fillStyle(s2, 1).fillTriangle(250, base, 360, 185, 470, base).fillTriangle(420, base, 490, 230, 560, base);
        g.fillStyle(s, 1).fillTriangle(30, base, 140, 220, 250, base);
        r(-10, 0, 560, 10, s2);
        break;
      case 'medieval':
        g.fillStyle(0xffffff, 0.8).fillCircle(90, 215, 18).fillCircle(112, 210, 24).fillCircle(136, 218, 16);
        g.fillStyle(s2, 1).fillEllipse(120, base + 10, 360, 90).fillEllipse(440, base + 10, 320, 80);
        r(190, 0, 160, 60); r(180, 0, 36, 110); r(324, 0, 36, 110); r(250, 0, 40, 135);
        for (let i = 0; i < 5; i++) r(194 + i * 33, 60, 16, 10);
        g.fillStyle(0x6c4a8a, 1).fillTriangle(176, base - 110, 198, base - 140, 220, base - 110).fillTriangle(320, base - 110, 342, base - 140, 364, base - 110).fillTriangle(246, base - 135, 270, base - 172, 294, base - 135);
        g.fillStyle(0xc0392b, 1).fillTriangle(270, base - 190, 270, base - 176, 290, base - 183); g.fillStyle(0x333333).fillRect(268, base - 190, 2, 20);
        g.fillStyle(0x3b3b4a, 1).fillRect(258, base - 30, 24, 30);
        break;
      case 'gunpowder':
        g.fillStyle(s2, 1).fillEllipse(130, base + 20, 420, 120).fillEllipse(460, base + 20, 360, 110);
        r(330, 0, 150, 40, s); r(320, 40, 30, 16, s); r(375, 40, 40, 22, s); r(455, 40, 30, 16, s);
        g.fillStyle(s, 1).fillRect(110, base - 120, 18, 120);
        g.fillStyle(0x7a5a3a, 1).fillTriangle(100, base - 120, 119, base - 145, 138, base - 120);
        g.lineStyle(6, 0xe8dcc8, 1); const t = 0.6; for (let i = 0; i < 4; i++) { const a = t + (i * Math.PI) / 2; g.lineBetween(119, base - 125, 119 + Math.cos(a) * 50, base - 125 + Math.sin(a) * 50); }
        g.fillStyle(0xc0392b, 1).fillRect(400, base - 92, 22, 14); g.fillStyle(0x333333).fillRect(398, base - 92, 2, 30);
        break;
      case 'modern': {
        const bs = [[10, 60, 70], [80, 50, 120], [135, 70, 90], [210, 45, 160], [260, 60, 110], [325, 55, 140], [385, 70, 85], [460, 80, 120]];
        bs.forEach(([x, w, h], i) => {
          r(x, 0, w, h, i % 2 ? s : s2);
          g.fillStyle(0xfff3b0, 0.55);
          for (let yy = 12; yy < h - 8; yy += 16) for (let xx = 8; xx < w - 8; xx += 14) if ((xx + yy + i) % 3) g.fillRect(x + xx, base - h + yy, 6, 8);
        });
        g.fillStyle(0xffffff, 0.7).fillCircle(440, 200, 14).fillCircle(458, 196, 20).fillCircle(478, 202, 13);
        break;
      }
      case 'future': {
        for (let i = 0; i < 40; i++) { g.fillStyle(0xffffff, 0.4 + ((i * 37) % 6) / 10); g.fillRect((i * 97) % 540, (i * 53) % 260, 2, 2); }
        g.fillStyle(0xd9c6ff, 0.9).fillCircle(420, 200, 28); g.fillStyle(e.sky[0], 0.6).fillCircle(432, 194, 24);
        const ts = [[20, 40, 120], [75, 30, 170], [120, 55, 95], [200, 36, 200], [250, 60, 130], [330, 40, 180], [390, 64, 100], [470, 46, 150]];
        ts.forEach(([x, w, h], i) => {
          r(x, 0, w, h, i % 2 ? s : s2);
          g.fillStyle(i % 3 ? 0x29f0ff : 0xff4fd8, 0.9);
          g.fillRect(x + 4, base - h, w - 8, 3);
          for (let yy = 16; yy < h - 6; yy += 20) g.fillRect(x + w / 2 - 1, base - h + yy, 3, 10);
        });
        break;
      }
    }
  }

  // ------------------------------------------------------------------ player + HUD
  createPlayer() {
    this.player = this.add.container(CX, PY).setDepth(10 + FAR);
    const sh = this.add.image(0, 2, 'shadow').setScale(TK * 1.0, TK * 0.8);
    this.weaponImg = this.add.image(0, -6, 'weapon_stone').setOrigin(0.5, 0.92).setScale(TK);
    this.player.add([sh, this.weaponImg]);
  }

  createHud() {
    const D0 = 8000;
    this.hud = this.add.container(0, this.hudY || 0).setDepth(D0);
    const add = this.add;
    const self = this;
    // everything created below with .setDepth() is collected into the HUD container
    const wrap = (o) => { self.hud.add(o); return o; };
    const panel = wrap(this.add.graphics());
    panel.fillStyle(0x000000, 0.42).fillRoundedRect(10, 10, 520, 172, 18);
    this.hudG = wrap(this.add.graphics());
    wrap(this.add.image(32, 34, 'heart').setScale(0.55));
    this.hpText = wrap(this.add.text(150, 34, '', style(16, '#ffffff', 4)).setOrigin(0.5));
    wrap(this.add.text(372, 34, 'FINISH', style(13, '#ffe14d', 3)).setOrigin(1, 0.5));
    this.eraIcon = wrap(this.add.image(46, 82, 'weapon_stone').setScale(0.22));
    this.eraText = wrap(this.add.text(78, 70, '', style(28, '#ffffff', 6)).setOrigin(0, 0.5));
    this.weapText = wrap(this.add.text(80, 96, '', style(15, '#ffe9b0', 4)).setOrigin(0, 0.5));
    this.statText = wrap(this.add.text(518, 82, '', style(14, '#ffffff', 4, { align: 'right', lineSpacing: 1 })).setOrigin(1, 0.5));
    this.xpText = wrap(this.add.text(270, 124, '', style(14, '#ffffff', 4)).setOrigin(0.5));
    // era timeline
    this.timeline = ERAS.map((e, i) => {
      const x = 62 + i * 83;
      const img = wrap(this.add.image(x, 160, 'weapon_' + e.key).setScale(0.13));
      return img;
    });
    this.hurtFlash = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setDepth(D0 - 10);
    this.hudDirty = true;
  }

  xpFrac() {
    if (this.era >= 5) return 1;
    return Phaser.Math.Clamp(this.xp / this.level.need[this.era], 0, 1);
  }

  pulseXp() { this.xpPulse = 1; }

  updateHud(force) {
    const g = this.hudG;
    const e = ERAS[this.era];
    g.clear();
    // health
    const hpF = this.hp / this.maxHp;
    g.fillStyle(0x2a1010, 1).fillRoundedRect(50, 24, 200, 20, 8);
    if (hpF > 0) g.fillStyle(hpF > 0.35 ? 0x4cd964 : 0xff3b30, 1).fillRoundedRect(50, 24, Math.max(16, 200 * hpF), 20, 8);
    // level progress
    const prog = Phaser.Math.Clamp(this.d / this.level.finish, 0, 1);
    g.fillStyle(0x222222, 1).fillRoundedRect(380, 26, 140, 16, 7);
    g.fillStyle(0xffe14d, 1).fillRoundedRect(380, 26, Math.max(14, 140 * prog), 16, 7);
    // xp bar
    const xf = this.xpFrac();
    this.xpPulse = Math.max(0, (this.xpPulse || 0) - 0.08);
    const grow = this.xpPulse * 3;
    g.fillStyle(0x1a1a1a, 1).fillRoundedRect(20, 112 - grow, 500, 24 + grow * 2, 10);
    if (xf > 0) g.fillStyle(e.ui, 1).fillRoundedRect(20, 112 - grow, Math.max(20, 500 * xf), 24 + grow * 2, 10);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(24, 114 - grow, Math.max(12, 492 * xf), 8, 4);
    // timeline highlight
    g.fillStyle(e.ui, 0.9).fillRoundedRect(62 + this.era * 83 - 30, 146, 60, 28, 10);
    for (let i = 0; i < 5; i++) { g.fillStyle(i < this.era ? 0xffffff : 0x777777, 0.8); g.fillTriangle(62 + i * 83 + 36, 156, 62 + i * 83 + 36, 164, 62 + i * 83 + 44, 160); }

    this.hpText.setText(`${Math.ceil(this.hp)} / ${this.maxHp}`);
    const xpLabel = this.era >= 5 ? 'MAX ERA REACHED!' : `XP ${Math.floor(this.xp)} / ${this.level.need[this.era]}   NEXT: ${ERAS[this.era + 1].name}`;
    this.xpText.setText(xpLabel);
    if (force || this.hudEra !== this.era) {
      this.hudEra = this.era;
      this.eraText.setText(e.name);
      this.weapText.setText(e.weapon.toUpperCase());
      this.eraIcon.setTexture('weapon_' + e.key);
      this.timeline.forEach((img, i) => { img.setAlpha(i <= this.era ? 1 : 0.35); img.setScale(i === this.era ? 0.17 : 0.13); });
    }
    const st = `DMG ${this.dmg.toFixed(1)}\nRATE ${this.rate.toFixed(1)}/s\nSHOTS ${this.shots}`;
    if (st !== this.lastSt) { this.lastSt = st; this.statText.setText(st); }
  }

  toast(msg, color) {
    const t = this.add.text(CX + this.px, PY - 150, msg, style(30, color, 7)).setOrigin(0.5).setDepth(8500);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 10, W - t.width / 2 - 10);
    this.tweens.add({ targets: t, y: t.y - 90, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  banner(title, sub, color) {
    const c = this.add.container(W / 2, 400).setDepth(8600);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55).fillRoundedRect(-230, -62, 460, 124, 22);
    bg.lineStyle(4, color, 1).strokeRoundedRect(-230, -62, 460, 124, 22);
    const a = this.add.text(0, -26, 'EVOLVED!', style(22, '#ffe14d', 5)).setOrigin(0.5);
    const b = this.add.text(0, 10, title, style(40, col(color === 0x29d8ff ? 0x29f0ff : 0xffffff), 8)).setOrigin(0.5);
    const s = this.add.text(0, 44, sub, style(18, '#ffffff', 4)).setOrigin(0.5);
    c.add([bg, a, b, s]);
    c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1500, duration: 400, onComplete: () => c.destroy() });
  }

  // ------------------------------------------------------------------ screens
  makeButton(container, y, label, cb) {
    const bw = 300, bh = 84;
    const g = this.add.graphics();
    g.fillStyle(0x1e7a3a, 1).fillRoundedRect(-bw / 2, y - bh / 2 + 6, bw, bh, 24);
    g.fillStyle(0x34c759, 1).fillRoundedRect(-bw / 2, y - bh / 2, bw, bh, 24);
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(-bw / 2 + 10, y - bh / 2 + 6, bw - 20, 26, 14);
    const t = this.add.text(0, y, label, style(36, '#ffffff', 7)).setOrigin(0.5);
    const zone = this.add.zone(0, y, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerup', cb);
    container.add([g, t, zone]);
    this.tweens.add({ targets: t, scale: 1.07, yoyo: true, repeat: -1, duration: 600 });
    return zone;
  }

  showTitle() {
    this.mode = 'title';
    const c = this.add.container(W / 2, 0).setDepth(9000);
    this.screen = c;
    const dim = this.add.rectangle(0, H / 2, W * 4, H * 3, 0x000000, 0.35);
    const t1 = this.add.text(0, 270, 'ERA', style(96, '#ffe14d', 14)).setOrigin(0.5);
    const t2 = this.add.text(0, 360, 'RUNNER', style(84, '#ffffff', 14)).setOrigin(0.5);
    const sub = this.add.text(0, 432, 'Evolve your weapon from the\nStone Age to the Future!', style(22, '#ffffff', 5)).setOrigin(0.5);
    c.add([dim, t1, t2, sub]);
    const row = this.add.graphics();
    row.fillStyle(0x000000, 0.4).fillRoundedRect(-250, 480, 500, 92, 20);
    c.add(row);
    ERAS.forEach((e, i) => {
      const x = -208 + i * 83;
      c.add(this.add.image(x, 526, 'weapon_' + e.key).setScale(0.24));
      if (i < 5) c.add(this.add.text(x + 42, 526, '›', style(30, '#ffe14d', 4)).setOrigin(0.5));
    });
    const how = this.add.text(0, 640,
      'DRAG left / right to steer\nYour weapon fires on its own\nDefeat enemies to earn XP and EVOLVE\nSteer through GREEN gates, avoid RED', style(19, '#ffffff', 5, { lineSpacing: 6 })).setOrigin(0.5);
    c.add(how);
    this.makeButton(c, 790, 'TAP TO PLAY', () => this.startRun());
    this.tweens.add({ targets: [t1, t2], y: '-=8', yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut' });
  }

  startRun() {
    if (this.mode === 'play') return;
    if (this.screen) { this.screen.destroy(); this.screen = null; }
    if (this.mode !== 'title') this.resetRun();
    this.d = 0;
    this.mode = 'play';
    this.dragging = false;
    const hint = this.add.text(W / 2, 640, '◀  DRAG TO STEER  ▶', style(26, '#ffffff', 6)).setOrigin(0.5).setDepth(8500);
    this.tweens.add({ targets: hint, alpha: 0, delay: 2200, duration: 600, onComplete: () => hint.destroy() });
  }

  endScreen(won) {
    this.mode = won ? 'won' : 'lost';
    this.dragging = false;
    const c = this.add.container(W / 2, 0).setDepth(9000);
    this.screen = c;
    const dim = this.add.rectangle(0, H / 2, W * 4, H * 3, 0x000000, 0.55);
    const g = this.add.graphics();
    g.fillStyle(0x1b1b24, 0.94).fillRoundedRect(-235, 215, 470, 560, 28);
    g.lineStyle(5, won ? 0xffe14d : 0xff5a4f, 1).strokeRoundedRect(-235, 215, 470, 560, 28);
    const title = this.add.text(0, 270, won ? 'LEVEL COMPLETE!' : 'DEFEATED', style(won ? 44 : 54, won ? '#ffe14d' : '#ff6b6b', 9)).setOrigin(0.5);
    const e = ERAS[this.era];
    const icon = this.add.image(0, 380, 'weapon_' + e.key).setScale(0.55);
    const eraT = this.add.text(0, 455, `Reached: ${e.name}`, style(26, col(e.ui === 0x29d8ff ? 0x29f0ff : 0xffffff), 6)).setOrigin(0.5);
    const pct = Math.round(Phaser.Math.Clamp(this.d / this.level.finish, 0, 1) * 100);
    const lines = [
      ['Enemies defeated', this.stats.kills],
      ['Blocks smashed', this.stats.blocks],
      ['Gates taken', this.stats.gates],
      [won ? 'Health left' : 'Distance', won ? `${Math.ceil(this.hp)}` : `${pct}%`],
      ['Time', `${this.time.toFixed(1)}s`],
    ];
    c.add([dim, g, title, icon, eraT]);
    lines.forEach(([k, v], i) => {
      c.add(this.add.text(-190, 505 + i * 34, k, style(20, '#d0d0d0', 0)).setOrigin(0, 0.5));
      c.add(this.add.text(190, 505 + i * 34, String(v), style(22, '#ffffff', 0)).setOrigin(1, 0.5));
    });
    this.makeButton(c, 715, won ? 'PLAY AGAIN' : 'RETRY', () => this.startRun());
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 350 });
  }

  win() { this.endScreen(true); }
  lose() { if (this.mode === 'play') this.endScreen(false); }

  // ------------------------------------------------------------------ bot + test hooks
  botSteer(dt) {
    const casual = this.bot === 'casual';
    this.botT = (this.botT || 0) - dt;
    if (casual && this.botT > 0) return;
    this.botT = casual ? 0.45 : 0;
    const gates = this.objs.filter((o) => o.type === 'gate' && !o.dead && !o.pair.used && o.z > 0 && o.z < 1000);
    if (gates.length) {
      const pair = gates[0].pair;
      if (pair.choice === undefined) {
        const score = (o) => { const g = o.gate; const v = g.value; return g.kind === 'shot' ? v * 45 : g.kind === 'hp' ? (this.maxHp - this.hp > 30 ? 40 : 8) : v; };
        let best = score(pair.objs[0]) >= score(pair.objs[1]) ? 0 : 1;
        if (casual && Math.random() < 0.3) best = 1 - best;
        pair.choice = best;
      }
      this.tx = pair.choice === 0 ? -100 : 100;
      return;
    }
    const enemies = this.objs.filter((o) => o.type === 'enemy' && !o.dead && o.z > 30 && o.z < 1400).sort((a, b) => a.z - b.z);
    let target = enemies.length ? enemies[0].x : 0;
    if (!casual) {
      const blocks = this.objs.filter((o) => o.type === 'block' && !o.dead && o.z > 0 && o.z < 600);
      const danger = (x) => blocks.some((b) => Math.abs(b.x - x) < b.halfW + 45 && b.hp > this.dmg * this.rate * this.shots * (b.z / RUN));
      if (danger(target)) target = [-150, 0, 150].find((x) => !danger(x)) ?? target;
    } else target += (Math.random() - 0.5) * 80;
    this.tx = Phaser.Math.Clamp(target, -MAX_X, MAX_X);
  }

  exposeHooks() {
    const s = this;
    window.__ER = Object.assign(window.__ER || {}, {
      scene: s,
      ready: true,
      start: () => s.startRun(),
      setBot: (b) => { s.bot = b; },
      state: () => ({ mode: s.mode, era: s.era, eraName: ERAS[s.era].name, xp: s.xp, hp: s.hp, d: s.d, finish: s.level.finish, time: s.time,
        rate: s.rate, dmg: s.dmg, shots: s.shots, stats: { ...s.stats }, eraTimes: [...s.eraTimes], objs: s.objs.length, projs: s.projs.length }),
      // fast-forward the simulation (headless) with the current bot steering
      sim: (seconds, opts = {}) => {
        s.simulating = !opts.visual;
        const steps = Math.round(seconds * 60);
        for (let i = 0; i < steps && s.mode === 'play'; i++) { if (s.bot) s.botSteer(1 / 60); s.step(1 / 60); }
        s.simulating = false;
        s.setEraVisuals(s.era, true);
        s.weaponImg.setTexture('weapon_' + ERAS[s.era].key);
        s.updateHud(true);
        return window.__ER.state();
      },
    });
  }
}
