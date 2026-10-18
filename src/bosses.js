import Phaser from 'phaser';
import { ERAS, eraDps } from './eras.js';
import { style } from './ui.js';
import { Sound } from './audio.js';

// One boss per era. The boss you meet matches the era your weapon is in when you reach the end.
// Attacks are always telegraphed by red lane markers so they can be dodged by steering:
//   volley  - projectile at your lane      volley2 - two lanes at once
//   barrage - four quick shots that follow you      charge - the boss rams down a lane
//   beam    - a breath/laser strip down a lane
// Every boss also raises a shield (immune to damage) at 2/3 and 1/3 health.
export const BOSSES = [
  { name: 'WOOLLY MAMMOTH', tex: 'boss_stone', proj: 'bp_rock', attacks: ['volley', 'charge', 'volley', 'volley2'], coins: 20 },
  { name: 'CHARIOT CHAMPION', tex: 'boss_bronze', proj: 'bp_spear', attacks: ['charge', 'volley2', 'volley', 'charge'], coins: 30 },
  { name: 'CASTLE DRAGON', tex: 'boss_medieval', proj: 'bp_fire', attacks: ['beam', 'volley', 'barrage', 'volley2'], beam: 0xff7a1f, coins: 40 },
  { name: 'PIRATE GALLEON', tex: 'boss_gunpowder', proj: 'bp_ball', attacks: ['volley2', 'barrage', 'volley', 'volley2'], coins: 55 },
  { name: 'IRON TANK', tex: 'boss_modern', proj: 'bp_shell', attacks: ['barrage', 'charge', 'volley2', 'volley'], coins: 70 },
  { name: 'MEGA ROBOT', tex: 'boss_future', proj: 'bp_plasma', attacks: ['beam', 'barrage', 'volley2', 'charge'], beam: 0x29f0ff, coins: 90 },
];

export const LANES = [-150, 0, 150];
export const BOSS_HOME_Z = 450;
// Boss HP: players arrive with wildly different firepower (gates stack), so HP meets them halfway -
// the geometric mean of the player's DPS and a reference DPS for that era. A stronger weapon
// (better gates, upgrades) still finishes the fight faster, a weak one isn't stuck forever.
export const BOSS_SECONDS = 15;
const REF_DPS_FUTURE = 1800;
const DMG = { proj: 25, charge: 35, beam: 30 };
const laneOf = (x) => LANES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

export const bossHpFor = (era, playerDps) => {
  const ref = (REF_DPS_FUTURE * eraDps(era)) / eraDps(5);
  return Math.round(BOSS_SECONDS * Math.sqrt(ref * Math.max(1, playerDps)));
};

export const BossMethods = {
  startBoss() {
    const era = this.era;
    const def = BOSSES[era];
    // clear whatever is left on the track
    for (const o of this.objs) if (o.type !== 'boss') o.dead = true;
    const c = this.add.container(0, 0);
    const sh = this.add.image(0, 0, 'shadow').setScale(2.5, 1.6);
    const img = this.add.image(0, 0, def.tex).setOrigin(0.5, 1).setScale(0.5 * 2.0);
    const shield = this.add.graphics();
    shield.fillStyle(0x7fe8ff, 0.28).fillEllipse(0, -225, 600, 520);
    shield.lineStyle(12, 0xbff6ff, 0.9).strokeEllipse(0, -225, 600, 520);
    shield.setAlpha(0);
    c.add([sh, img, shield]);
    const hp = bossHpFor(era, this.rate * this.dmg * this.shots);
    const obj = { type: 'boss', c, img, shield, x: 0, z: 1750, halfW: 170, hittable: true, size: 2, eraLook: era };
    this.objs.push(obj);
    this.boss = { def, era, obj, hp, maxHp: hp, t: 0, phase: 'enter', nextAt: 0, busy: 0, events: [], shields: [0.66, 0.33], shieldUntil: 0, charge: null, attackIdx: 0, startTime: this.time };
    this.bossWarns = [];
    this.bprojs = [];
    this.stats.bossName = def.name;
    this.stats.bossDps = this.rate * this.dmg * this.shots;
    if (this.simulating) return;
    Sound.setSong('boss');
    Sound.play('boss_roar');
    this.bossBanner(def.name);
    this.showBossBar(true);
  },

  bossStep(dt) {
    const b = this.boss;
    const o = b.obj;
    b.t += dt;
    if (b.phase === 'enter') {
      o.z = Math.max(BOSS_HOME_Z, o.z - 650 * dt);
      if (o.z <= BOSS_HOME_Z) { b.phase = 'fight'; b.nextAt = b.t + 0.9; }
    } else if (b.phase === 'dead') {
      if (b.t >= b.winAt) { this.win(); return; }
    } else {
      // gentle sway so the boss isn't always dead centre
      if (!b.charge) o.x += (Math.sin(b.t * 0.75) * 75 - o.x) * Math.min(1, dt * 2.5);
      if (b.shieldUntil && b.t > b.shieldUntil) { b.shieldUntil = 0; }
      if (b.t >= b.nextAt && b.t >= b.busy) this.bossAttack();
    }
    // scheduled attack events
    if (b.events.length) {
      const due = b.events.filter((e) => e.at <= b.t);
      if (due.length) { b.events = b.events.filter((e) => e.at > b.t); due.forEach((e) => e.fn()); }
    }
    // charge movement
    if (b.charge) {
      const ch = b.charge;
      if (ch.phase === 'go') {
        o.z -= 1500 * dt;
        if (!ch.hitDone && o.z < 200) {
          ch.hitDone = true;
          if (Math.abs(this.px - o.x) < 100) this.bossHurt(DMG.charge);
          if (!this.simulating) this.cameras.main.shake(220, 0.012);
        }
        if (o.z <= 150) { o.z = 150; ch.phase = 'back'; }
      } else if (ch.phase === 'back') {
        o.z += 520 * dt;
        if (o.z >= BOSS_HOME_Z) { o.z = BOSS_HOME_Z; b.charge = null; }
      } else {
        o.x += (ch.lane - o.x) * Math.min(1, dt * 5); // line up during the telegraph
      }
    }
    // boss projectiles
    for (const p of this.bprojs) {
      if (p.dead) continue;
      p.z -= p.speed * dt;
      p.spin += dt * 8;
      if (p.z <= 25) {
        p.dead = true;
        if (Math.abs(this.px - p.x) < 72) this.bossHurt(DMG.proj);
        else if (!this.simulating) Sound.play('block');
      }
    }
    this.bprojs = this.bprojs.filter((p) => { if (p.dead) p.img?.destroy(); return !p.dead; });
    // active beams hurt once
    for (const w of this.bossWarns) {
      if (w.kind === 'beam' && b.t >= w.from && !w.hitDone && Math.abs(this.px - w.x) < 82) { w.hitDone = true; this.bossHurt(DMG.beam); }
    }
    this.bossWarns = this.bossWarns.filter((w) => w.until > b.t);
  },

  bossHurt(n) {
    this.hurt(n);
    this.stats.bossDamageTaken = (this.stats.bossDamageTaken || 0) + n;
  },

  warn(x, dur, kind = 'warn', color = 0xff2a2a) {
    const b = this.boss;
    this.bossWarns.push({ x, from: b.t, until: b.t + dur, kind, color });
    if (!this.simulating && kind === 'warn') Sound.play('warn');
  },

  fireAt(lane) {
    const b = this.boss;
    const p = { x: lane, z: b.obj.z - 20, speed: 780, spin: 0 };
    if (!this.simulating) {
      p.img = this.add.image(0, 0, b.def.proj);
      Sound.play('boss_throw');
    }
    this.bprojs.push(p);
  },

  bossAttack() {
    const b = this.boss;
    if (b.phase !== 'fight') return;
    const kind = b.def.attacks[b.attackIdx++ % b.def.attacks.length];
    const lane = laneOf(this.px);
    const at = (dt, fn) => b.events.push({ at: b.t + dt, fn });
    const frac = b.hp / b.maxHp;
    const gap = frac < 0.34 ? 0.4 : frac < 0.67 ? 0.6 : 0.85;
    let dur = 1.6;
    if (kind === 'volley' || kind === 'volley2') {
      const lanes = [lane];
      if (kind === 'volley2') lanes.push(Phaser.Utils.Array.GetRandom(LANES.filter((l) => l !== lane)));
      lanes.forEach((l) => this.warn(l, 0.9));
      at(0.9, () => lanes.forEach((l) => this.fireAt(l)));
      dur = 1.7;
    } else if (kind === 'barrage') {
      for (let i = 0; i < 4; i++) {
        at(i * 0.55, () => {
          const l = laneOf(this.px);
          this.warn(l, 0.75);
          at(0.75, () => this.fireAt(l));
        });
      }
      dur = 2.9;
    } else if (kind === 'charge') {
      this.warn(lane, 1.1);
      b.charge = { lane, phase: 'aim' };
      at(1.1, () => { b.charge.phase = 'go'; if (!this.simulating) Sound.play('boss_charge'); });
      dur = 2.4;
    } else if (kind === 'beam') {
      this.warn(lane, 1.0);
      at(1.0, () => { this.warn(lane, 0.55, 'beam', b.def.beam || 0xff7a1f); if (!this.simulating) Sound.play('boss_beam'); });
      dur = 1.9;
    }
    b.busy = b.t + dur;
    b.nextAt = b.busy + gap;
  },

  bossHit(p) {
    const b = this.boss;
    if (b.phase !== 'fight' && b.phase !== 'enter') return;
    if (b.shieldUntil) { if (!this.simulating) Sound.play('block'); return; }
    const dealt = Math.min(p.dmg, b.hp);
    b.hp -= dealt;
    this.stats.damage += dealt;
    b.obj.flash = 0.05;
    if (!this.simulating) Sound.play('hit');
    const frac = b.hp / b.maxHp;
    if (b.shields.length && frac <= b.shields[0] && b.hp > 0) {
      b.shields.shift();
      b.shieldUntil = b.t + 2.6;
      if (!this.simulating) { Sound.play('shield'); this.toast('SHIELD UP!', '#9ff3ff', 380); }
    }
    if (b.hp <= 0) this.bossDefeated();
  },

  bossDefeated() {
    const b = this.boss;
    b.phase = 'dead';
    b.winAt = b.t + 1.9;
    b.events = [];
    b.charge = null;
    this.bossWarns = [];
    this.bprojs.forEach((p) => { p.dead = true; });
    b.obj.hittable = false;
    this.stats.bossTime = this.time - b.startTime;
    this.stats.bossBeaten = true;
    this.addCoins(b.def.coins, b.obj);
    if (this.simulating) return;
    Sound.play('boss_die');
    this.cameras.main.shake(600, 0.015);
    this.cameras.main.flash(400, 255, 240, 200);
    const pr = this.projectPt(b.obj.x, b.obj.z);
    for (let k = 0; k < 4; k++) this.tweens.addCounter({ from: 0, to: 1, duration: 1, delay: k * 220, onComplete: () => this.burst(pr.x + (Math.random() - 0.5) * 140, pr.y - 60 - Math.random() * 80, 0xffb627, 16) });
    this.tweens.add({ targets: b.obj.img, alpha: 0, scaleY: 0.2, duration: 1300, delay: 300, ease: 'Cubic.easeIn' });
    this.showBossBar(false);
  },

  // ---- visuals
  showBossBar(on) {
    if (!this.bossBar) {
      const c = this.add.container(0, 0).setDepth(8100);
      const g = this.add.graphics();
      const name = this.add.text(270, 0, '', style(20, '#ffffff', 5)).setOrigin(0.5, 1);
      const hpt = this.add.text(270, 17, '', style(14, '#ffffff', 4)).setOrigin(0.5);
      c.add([g, name, hpt]);
      this.bossBar = { c, g, name, hpt };
    }
    this.bossBar.c.setVisible(on);
  },

  updateBossBar() {
    const b = this.boss;
    if (!b || !this.bossBar?.c.visible) return;
    const { c, g, name, hpt } = this.bossBar;
    c.y = (this.hudY || 0) + 218;
    const f = Math.max(0, b.hp / b.maxHp);
    name.setText(b.def.name + (b.shieldUntil ? '  (SHIELD)' : ''));
    hpt.setText(`${Math.ceil(b.hp)} / ${b.maxHp}`);
    g.clear();
    g.fillStyle(0x000000, 0.55).fillRoundedRect(22, 4, 496, 28, 12);
    g.fillStyle(b.shieldUntil ? 0x7fe8ff : 0xe5483d, 1).fillRoundedRect(26, 8, Math.max(14, 488 * f), 20, 9);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(30, 10, Math.max(8, 480 * f), 6, 3);
    [0.66, 0.33].forEach((m) => g.fillStyle(0xffffff, 0.7).fillRect(26 + 488 * m - 1, 6, 3, 24));
  },

  bossBanner(nameText) {
    const c = this.add.container(270, (this.hudY || 0) + 330).setDepth(8600);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6).fillRoundedRect(-240, -60, 480, 120, 22);
    g.lineStyle(4, 0xe5483d, 1).strokeRoundedRect(-240, -60, 480, 120, 22);
    const a = this.add.text(0, -24, 'BOSS FIGHT!', style(24, '#ff6b6b', 5)).setOrigin(0.5);
    const t = this.add.text(0, 16, nameText, style(38, '#ffffff', 8)).setOrigin(0.5);
    const s = this.add.text(0, 48, 'Dodge the red lanes!', style(16, '#ffe14d', 4)).setOrigin(0.5);
    c.add([g, a, t, s]);
    c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1700, duration: 400, onComplete: () => c.destroy() });
  },

  drawBossWarns(quad) {
    if (!this.boss || !this.bossWarns.length) return;
    const b = this.boss;
    const zEnd = Math.max(80, b.obj.z - 10);
    for (const w of this.bossWarns) {
      if (w.kind === 'beam') {
        if (b.t < w.from) continue;
        quad(w.x - 80, w.x + 80, -40, zEnd, w.color, 0.75);
        quad(w.x - 30, w.x + 30, -40, zEnd, 0xffffff, 0.85);
      } else {
        const pulse = 0.22 + 0.2 * Math.abs(Math.sin((b.t - w.from) * 10));
        quad(w.x - 75, w.x + 75, -40, zEnd, w.color, pulse);
        quad(w.x - 75, w.x - 65, -40, zEnd, w.color, 0.8);
        quad(w.x + 65, w.x + 75, -40, zEnd, w.color, 0.8);
      }
    }
  },

  renderBoss() {
    const b = this.boss;
    if (!b) return;
    b.obj.shield.setAlpha(b.shieldUntil ? 0.75 + 0.25 * Math.sin(b.t * 12) : 0);
    for (const p of this.bprojs) {
      if (!p.img) continue;
      const pr = this.projectPt(p.x, p.z);
      p.img.setPosition(pr.x, pr.y - 80 * pr.s).setScale(1.8 * pr.s).setDepth(10 + 6000 - p.z).setRotation(p.spin);
    }
    this.updateBossBar();
  },
};
