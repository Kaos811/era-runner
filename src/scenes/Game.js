import Phaser from 'phaser';
import { ERAS, WEAPONS, MAX_TIER, tierDps } from '../eras.js';
import { buildLevel, levelInfo } from '../level.js';
import { CheckpointMethods } from '../checkpoint.js';
import { POWERUPS, payout, LAP } from '../powerups.js';
import { GEMS, CRATES } from '../tuning.js';
import { CrateMethods } from '../crates.js';
import { Save } from '../save.js';
import { runMods, UPGRADES, upgCost } from '../upgrades.js';
import { Sound } from '../audio.js';
import { BossMethods, BOSS_HOME_Z, LANES } from '../bosses.js';
import { ScreenMethods } from '../screens.js';
import { style, col } from '../ui.js';

// ---- layout / fake-3D projection ----
const W = 540, H = 960, CX = 270;
const HY = 300;          // horizon line (screen y at infinite distance)
const PY = 830;          // screen y of the ground under the player
// XP gems are picked up when they pass within GEM_REACH_X of the weapon (lanes are 150 apart)
const { comboGain: COMBO_GAIN, comboMiss: COMBO_MISS, reachX: GEM_REACH_X, reachZ: GEM_REACH_Z, spread: GEM_SPREAD, homing: HOMING } = GEMS;
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
// Gate values rise when shot, up to a sensible cap.
const GATE_PCT_PER_SEC = 6;
const GATE_SHOT_PER_SEC = 0.7;
const GATE_CAP = { rate: 50, dmg: 50, hp: 50, shot: 2 };
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
    this.ui = {};
    Sound.init(Save.data);

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
    this.runId = (this.runId || 0) + 1;
    (this.objs || []).forEach((o) => o.c.destroy());
    (this.projs || []).forEach((p) => p.img?.destroy());
    this.fx.removeAll(true);
    this.levelN = Math.max(1, this.levelN || 1);
    this.level = buildLevel(this.levelN);
    this.info = this.level.info;
    this.qi = 0;
    this.objs = [];
    this.projs = [];
    (this.gems || []).forEach((g) => g.img?.destroy());
    this.gems = [];
    this.combo = 0;
    this.trailRun = 0;
    this.clearPops?.();
    this.resetPowers();
    this.d = 0; this.px = 0; this.tx = 0;
    this.mods = runMods(this.testUpg || Save.data.upg);
    this.maxHp = this.mods.maxHp; this.hp = this.maxHp;
    this.tier = this.info.era * 2; this.xp = 0;
    this.runSpeed = RUN; this.runCoins = 0;
    if (this.boss) { this.bprojs?.forEach((p) => p.img?.destroy()); }
    this.boss = null; this.bossWarns = []; this.bprojs = [];
    this.showBossBar?.(false);
    this.rateB = 0; this.dmgB = 0; this.extra = 0;
    this.fireT = 0.3; this.time = 0; this.lastHurt = -99; this.recoil = 0;
    this.stats = { kills: 0, blocks: 0, gates: 0, damage: 0, hitsTaken: 0, gems: 0, gemsMissed: 0, hurtBySection: [0, 0, 0, 0, 0, 0], coins: 0, checkpoints: [], crates: [], trailGems: 0, trailMissed: 0 };
    this.eraTimes = [0];
    this.tierTimes = [0];
    this.finishPassed = false;
    this.finishZ = this.level.finish;
    this.setEraVisuals(this.info.era, true);
    this.weaponImg.setTexture('weapon_' + this.weapon.key);
    this.refreshWeaponLook?.();
    this.updateHud(true);
  }

  // era (scenery, enemies, boss) follows the weapon tier: two weapons per era
  get era() { return this.tier >> 1; }
  get weapon() { return WEAPONS[this.tier]; }
  get maxTier() { return this.info.era * 2 + 1; } // a level only has its era's two weapons
  get rate() { return this.weapon.rate * Math.max(0.4, 1 + this.rateB / 100) * this.mods.rateMul * this.pu.rateMul; }
  get dmg() { return this.weapon.dmg * Math.max(0.4, 1 + this.dmgB / 100) * this.mods.dmgMul * this.pu.dmgMul; }
  get shots() { return Phaser.Math.Clamp(1 + this.extra + this.pu.shots, 1, 7); }

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
    if (this.mode === 'play' && this.pauseT > 0) {
      // arch reveal: slow motion while the card drops and flips
      this.step(dt * 0.1);
      this.render();
      return;
    }
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
      if (!this.boss) this.d += (this.mode === 'title' || this.mode === 'shop' || this.mode === 'settings' ? 120 : 40) * dt;
    }
    this.render();
  }

  step(dt) {
    this.time += dt;
    // the track stops for the boss fight
    this.runSpeed = this.boss ? Math.max(0, this.runSpeed - 450 * dt) : RUN;
    this.d += this.runSpeed * dt;
    const L = this.level;

    // spawn
    while (this.qi < L.items.length && L.items[this.qi].at - this.d < SPAWN_Z) this.spawn(L.items[this.qi++]);
    if (!this.boss && this.d >= L.finish - 120) this.startBoss();

    // player steering (smoothed)
    this.px += (this.tx - this.px) * Math.min(1, dt * 14);

    // move objects
    for (const o of this.objs) {
      if (o.dead) continue;
      if (o.flash > 0) o.flash -= dt;
      if (o.type === 'boss') continue;
      o.z -= (this.runSpeed + (o.walk || 0)) * dt;
      if (o.type === 'enemy' && o.z < 1100 && o.z > 60) {
        const dx = this.px - o.x;
        o.x += Math.sign(dx) * Math.min(Math.abs(dx), HOMING * dt);
      }
      if (o.flash > 0) o.flash -= dt;
    }

    // fire
    this.fireT -= dt;
    while (this.fireT <= 0) { this.fire(); this.fireT += 1 / this.rate; }
    this.stepPowers(dt);

    this.stepGems(dt);
    this.stepPops(dt);
    if (this.boss) { this.bossStep(dt); if (this.mode !== 'play') return; }

    // projectiles
    for (const p of this.projs) {
      if (p.dead) continue;
      const nz = p.z + p.speed * dt;
      let best = null;
      for (const o of this.objs) {
        if (o.dead || o.used || !o.hittable) continue;
        if (p.hitSet && p.hitSet.has(o)) continue;
        if (Math.abs(o.x - p.x) > o.halfW + p.r) continue;
        if (o.z < p.z - 45 || o.z > nz + 20) continue;
        if (!best || o.z < best.z) best = o;
      }
      p.z = nz;
      if (best) {
        this.hit(best, p);
        if (p.pierce > 0 && (best.type === 'enemy' || best.type === 'block' || best.type === 'crate')) { p.pierce--; (p.hitSet ||= new Set()).add(best); }
        else p.dead = true;
      }
      else if (p.z > RANGE) p.dead = true;
    }

    // collisions with the player
    for (const o of this.objs) {
      if (o.dead) continue;
      if (o.type === 'checkpoint') {
        if (!o.used && o.z <= 0) this.cashOut(o);
      } else if (o.type === 'crate') {
        if (!o.used && o.z <= 30) this.burstCrate(o);
      } else if (o.type === 'gate') {
        if (!o.pair.used && o.z <= 0) this.takeGate(o.pair);
      } else if ((o.type === 'enemy' || o.type === 'block') && o.z < 30 && o.z > -40 && Math.abs(o.x - this.px) < o.halfW + 30) {
        this.hurt(o.dmg);
        if (o.section !== undefined) this.stats.hurtBySection[o.section] += o.dmg;
        this.kill(o, false);
      } else if (o.type === 'finish' && o.z <= 0 && !this.finishPassed) {
        this.finishPassed = true;
        this.win();
        return;
      }
      if (o.z < -260 && o.type !== 'boss') o.dead = true;
    }

    // cleanup
    this.objs = this.objs.filter((o) => { if (o.dead && !o.dying) o.c.destroy(); return !o.dead || o.dying; });
    this.projs = this.projs.filter((p) => { if (p.dead) p.img?.destroy(); return !p.dead; });

    if (this.hp <= 0) this.lose();
  }

  fire() {
    const e = this.weapon;
    const n = this.shots;
    const spacing = e.spacing * Math.min(1.3, this.pu.size);
    const volleys = 1 + this.pu.double; // Double Shot: extra volleys just behind the first
    const muzzles = [0, ...this.twinOffsets()]; // Twin Weapon copies fire the same volley
    for (const mx of muzzles) {
      for (let v = 0; v < volleys; v++) {
        for (let i = 0; i < n; i++) {
          const x = this.px + mx + (i - (n - 1) / 2) * spacing + (v % 2 ? spacing / 2 : 0);
          this.spawnProj({ x, z: 40 - v * 45, speed: e.pspeed, r: e.pr * this.pu.size, dmg: this.dmg, pierce: this.pu.pierce, tex: 'p_' + e.proj, sc: this.pu.size });
        }
      }
    }
    this.recoil = e.recoil;
    if (!this.simulating) Sound.play('shot_' + e.key);
  }

  spawnProj(q) {
    if (!this.simulating) q.img = this.add.image(0, 0, q.tex).setOrigin(0.5, 0.5);
    this.projs.push(q);
  }

  hit(o, p) {
    if (o.type === 'boss') { this.bossHit(p); this.afterHit(o, p); return; }
    o.flash = 0.06;
    if (o.type === 'gate') {
      const g = o.gate;
      // Gate growth is time-based per stream of shots (dividing by fire rate), so a machine gun
      // doesn't pump gates absurdly fast and a sling isn't hopelessly slow; extra projectiles
      // and later eras speed it up a little. Per second, per stream: ~6% (rate/dmg/health),
      // ~0.7 (shots) in the Stone Age, ~+10% per era after that.
      const perSec = (g.kind === 'shot' ? GATE_SHOT_PER_SEC : GATE_PCT_PER_SEC) * (1 + 0.1 * this.era);
      g.prog = (g.prog || 0) + perSec / this.rate;
      if (g.prog >= 1) {
        const inc = Math.floor(g.prog);
        g.prog -= inc;
        const before = g.value;
        g.value = Math.min(GATE_CAP[g.kind], g.value + inc);
        if (g.value !== before) this.refreshGate(o);
      }
      return;
    }
    if (o.type === 'crate') { this.hitCrate(o, p); return; }
    const dealt = Math.min(p.dmg, o.hp);
    o.hp -= p.dmg;
    this.stats.damage += dealt;
    this.addPop(o, dealt);
    if (o.hp <= 0.0001) {
      this.kill(o, true);
    } else {
      o.hpText.setText(String(Math.ceil(o.hp)));
      if (!this.simulating) Sound.play('hit');
    }
    this.afterHit(o, p);
  }

  kill(o, byShot) {
    o.dead = true;
    if (byShot) {
      if (o.type === 'enemy') this.stats.kills++; else this.stats.blocks++;
      this.addCoins(this.levelCoins(o.type === 'block' ? 2 : o.size > 1.3 ? 3 : 1), o);
      this.dropGems(o);
    }
    if (this.simulating) return;
    Sound.play(o.type === 'block' ? 'smash' : 'kill');
    const pr = project(o.x, Math.max(o.z, 0));
    const color = o.type === 'block' ? 0x9a8a70 : ERAS[o.eraLook].burst;
    for (let i = 0; i < 9; i++) {
      const dot = this.add.image(pr.x, pr.y - 40 * pr.s * o.size, 'dot').setTint(i % 3 ? color : 0xffffff).setScale(0.5 * pr.s * (0.6 + Math.random()));
      this.fx.add(dot);
      const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 50) * pr.s;
      this.tweens.add({ targets: dot, x: pr.x + Math.cos(a) * r, y: pr.y - 40 * pr.s + Math.sin(a) * r, alpha: 0, scale: 0.1, duration: 380, onComplete: () => dot.destroy() });
    }
  }

  // XP gems drop where an enemy/block dies and lie on the track: steer within reach to pick them up.
  // XP is the target's full (nominal) HP, split over its gems; gems you miss are lost.
  dropGems(o) {
    const per = o.type === 'block' ? GEMS.perKill.block : o.size > 1.3 ? GEMS.perKill.big : GEMS.perKill.enemy;
    const n = Math.floor(per) + (Math.random() < per % 1 ? 1 : 0);
    const xp = 1;
    for (let i = 0; i < n; i++) {
      // pop away from where you are, so a gem always takes a bit of steering to grab
      let side = Math.sign(o.x - this.px) || (Math.random() < 0.5 ? -1 : 1);
      if (Math.abs(o.x + side * GEMS.pop[0]) > MAX_X - 10) side = -side; // no room at the edge: pop back across
      const pop = side * (GEMS.pop[0] + Math.random() * (GEMS.pop[1] - GEMS.pop[0]) + i * GEM_SPREAD);
      this.gems.push({ x: Phaser.Math.Clamp(o.x + pop, -MAX_X, MAX_X), z: Math.max(o.z, 60) + i * 14, xp, pull: false, img: null, t: Math.random() * 6 });
    }
  }

  stepGems(dt) {
    for (const g of this.gems) {
      if (g.dead) continue;
      if (this.boss) g.pull = true; // the arena hoovers up whatever is left
      if (!g.pull) {
        g.z -= this.runSpeed * dt;
        const mag = this.pu.magnet;
        const reach = (g.trail ? GEMS.trailReachX : GEM_REACH_X) * mag;
        const near = (x) => Math.abs(g.x - x) < reach;
        if (g.z < GEM_REACH_Z * Math.min(2.2, mag) && g.z > -30 && (near(this.px) || this.twinOffsets().some((o) => near(this.px + o) && g.trail))) g.pull = true;
        else if (g.z < -60) {
          g.dead = true; this.stats.gemsMissed++; this.combo = Math.max(0, this.combo - COMBO_MISS);
          if (g.trail) { this.stats.trailMissed++; this.trailRun = 0; }
          continue;
        }
      }
      if (g.pull) {
        const k = Math.min(1, dt * 9);
        g.x += (this.px - g.x) * k;
        g.z += (0 - g.z) * k - 200 * dt;
        if (g.z < 15) { g.dead = true; this.collectGem(g); }
      }
    }
    this.gems = this.gems.filter((g) => { if (g.dead) g.img?.destroy(); return !g.dead; });
  }

  // pickup streak: every gem raises the XP bonus a little (up to x2), every missed gem knocks it down
  get xpMul() { return 1 + this.combo; }
  collectGem(g) {
    this.stats.gems++;
    if (g.trail) { this.stats.trailGems++; this.trailRun++; }
    this.gainXp(g.xp * this.xpMul);
    this.addMeter(this.xpMul); // arch meter: 1 point per gem, plus the streak bonus
    this.combo = Math.min(1, this.combo + COMBO_GAIN);
    if (this.simulating) return;
    // rising pitch while you stay on a trail
    if (g.trail) Sound.play('gemTrail', this.trailRun); else Sound.play('gem');
    const pr = project(g.x, Math.max(g.z, 0));
    const gem = this.add.image(pr.x, pr.y - 20, 'gem').setScale(0.6);
    this.fx.add(gem);
    // gems fly up into the meter on the next arch if it's in view, otherwise into the HUD meter
    const tgt = this.archMeterPoint();
    this.tweens.add({ targets: gem, x: tgt.x, y: tgt.y, scale: tgt.s, duration: 380, ease: 'Cubic.easeIn', onComplete: () => { gem.destroy(); this.pulseXp(); this.meterPulse = 1; } });
  }

  gainXp(v) {
    this.xp += v;
    if (this.boss) return; // the weapon is locked in once the boss fight starts
    const need = this.level.need;
    while (this.tier < this.maxTier && this.xp >= need[0]) {
      this.xp -= need[0];
      this.evolve();
    }
  }

  // Next weapon. Odd tiers are the second weapon of the same era ("UPGRADED!"),
  // even tiers start a new era ("EVOLVED!" + new scenery).
  evolve() {
    this.tier++;
    this.tierTimes.push(this.time);
    const newEra = this.tier % 2 === 0;
    if (newEra) this.eraTimes.push(this.time);
    if (this.simulating) return;
    const w = this.weapon, e = ERAS[this.era];
    this.refreshWeaponLook();
    const sc0 = this.weaponImg.scaleX;
    this.tweens.add({ targets: this.weaponImg, scale: { from: sc0 * (newEra ? 1.6 : 1.35), to: sc0 }, duration: 420, ease: 'Back.easeOut' });
    if (newEra) {
      this.cameras.main.flash(260, 255, 255, 255);
      Sound.play('evolve');
      this.setEraVisuals(this.era, false);
      this.banner(`${e.name}!`, `New weapon: ${w.name}`, e.ui);
    } else {
      Sound.play('upgrade');
      this.smallBanner(w.name.toUpperCase(), e.ui);
    }
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
    this.rateB = Phaser.Math.Clamp(this.rateB, -60, 300);
    this.dmgB = Phaser.Math.Clamp(this.dmgB, -60, 300);
    this.stats.gates++;
    chosen.dead = true; other.dead = true;
    if (this.simulating) return;
    const good = v > 0;
    Sound.play(good ? 'gate_good' : 'gate_bad');
    this.toast(`${fmtGate(g.kind, v)} ${KIND_LABEL[g.kind]}`, good ? '#7dff9a' : '#ff6b6b');
    if (!good) this.cameras.main.shake(120, 0.004);
    this.updateHud(true);
  }

  hurt(amount) {
    if (this.shieldBlock()) return;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurt = this.time;
    this.stats.hitsTaken++;
    if (this.simulating) return;
    Sound.play('hurt');
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
      const expected = it.ref * 1.6;
      const ease = expected > 0 ? Phaser.Math.Clamp((this.rate * this.dmg * this.shots) / expected, 0.35, 1) : 1;
      it = { ...it, xpVal: it.hp, hp: Math.max(1, Math.round(it.hp * ease)) };
      const c = this.add.container(0, 0);
      const isE = it.type === 'enemy';
      const sh = this.add.image(0, 0, 'shadow').setScale(TK * (isE ? 0.9 : 1.1) * it.size, TK * it.size);
      const img = this.add.image(0, 0, (isE ? 'enemy_' : 'block_') + eraKey).setOrigin(0.5, 1).setScale(TK * it.size * (isE ? 1.25 : 1.1));
      const hpText = this.add.text(0, isE ? -138 * it.size : -46, String(it.hp), style(isE ? 28 : 32, '#ffffff', 6)).setOrigin(0.5);
      c.add([sh, img, hpText]);
      if (it.size > 1.3 && isE) img.setTint(0xffd0c0);
      this.objs.push({ type: it.type, section: it.section, c, img, hpText, x: it.x, z, hp: it.hp, maxHp: it.hp, xpVal: it.xpVal, size: it.size, dmg: it.dmg, halfW: (isE ? 36 : 50) * it.size,
        walk: isE ? 45 : 0, hittable: true, eraLook: look, bob: Math.random() * 6 });
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
    } else if (it.type === 'checkpoint') {
      this.spawnCheckpoint(it, z);
    } else if (it.type === 'crate') {
      this.spawnCrate(it, z);
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
      if (o.type === 'checkpoint') { o.label.setScale(Math.max(1, 0.4 / pr.s)); this.renderArchMeter(o); }
      if (o.type === 'crate') {
        o.pop = Math.max(1, (o.pop || 1) - 0.04);
        o.num.setScale(Math.max(1, 0.42 / pr.s) * o.pop); o.tag.setScale(Math.max(1, 0.36 / pr.s));
        o.img.y = -Math.abs(Math.sin(this.time * 3)) * 4;
      }
      if (o.type === 'gate') { o.value.setScale(Math.max(1, 0.3 / pr.s) * (o.pop || 1)); o.label.setScale(Math.max(1, 0.36 / pr.s)); }
      const fade = o.z > 1500 ? Phaser.Math.Clamp((SPAWN_Z - o.z) / 400, 0, 1) : 1;
      o.c.setAlpha(fade);
      if (o.img && o.type !== 'gate' && o.type !== 'checkpoint') {
        if (o.type === 'crate') { if (o.flash > 0) o.img.setTint(0xbff6ff); else o.img.clearTint(); continue; }
        if (o.flash > 0) { if (o.type === 'boss') o.img.setTint(0xffb0a0); else o.img.setTintFill(0xffffff); }
        else if (o.size > 1.3 && o.type === 'enemy') o.img.setTint(0xffd0c0);
        else o.img.clearTint();
      } else if (o.type === 'gate') {
        o.panel.setAlpha(o.flash > 0 ? 1 : 0.92);
      }
    }
    for (const g of this.gems) {
      if (!g.img) g.img = this.add.image(0, 0, 'gem');
      const pr = project(g.x, Math.max(g.z, -100));
      const bob = Math.sin(this.time * 6 + g.t) * 6;
      g.img.setPosition(pr.x, pr.y - (24 + bob) * pr.s).setScale(TK * (g.trail ? 2.3 : 2.1) * pr.s).setDepth(10 + FAR - g.z);
    }
    this.renderBoss();
    for (const p of this.projs) {
      if (!p.img) p.img = this.add.image(0, 0, p.tex);
      const pr = project(p.x, p.z);
      p.img.setPosition(pr.x, pr.y - 58 * pr.s).setScale(TK * pr.s * (p.sc || 1)).setDepth(10 + FAR - p.z);
      if (p.spin) p.img.rotation += 0.35;
    }
    this.renderPowers(project, FAR);
    // player
    this.recoil = Math.max(0, this.recoil - 1.2);
    this.player.setPosition(CX + this.px, PY);
    this.weaponImg.y = -6 + this.recoil;
    this.weaponImg.angle = Phaser.Math.Clamp((this.tx - this.px) * 0.12, -12, 12);
    this.renderWeaponLook();
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
    this.drawBossWarns(quad);
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
    this.twinC = this.add.container(0, 0);
    this.modC = this.add.container(0, 0);
    this.player.add([sh, this.twinC, this.weaponImg, this.modC]);
  }

  createHud() {
    const D0 = 8000;
    this.hud = this.add.container(0, this.hudY || 0).setDepth(D0);
    const add = this.add;
    const self = this;
    // everything created below with .setDepth() is collected into the HUD container
    const wrap = (o) => { self.hud.add(o); return o; };
    const panel = wrap(this.add.graphics());
    panel.fillStyle(0x000000, 0.42).fillRoundedRect(10, 10, 520, 178, 18);
    this.hudG = wrap(this.add.graphics());
    wrap(this.add.image(32, 34, 'heart').setScale(0.55));
    this.hpText = wrap(this.add.text(137, 34, '', style(16, '#ffffff', 4)).setOrigin(0.5));
    this.levelText = wrap(this.add.text(375, 34, 'LEVEL 1', style(15, '#ffe14d', 4)).setOrigin(1, 0.5));
    wrap(this.add.image(250, 34, 'coin').setScale(0.55));
    this.coinText = wrap(this.add.text(266, 34, '0', style(18, '#ffe14d', 4)).setOrigin(0, 0.5));
    this.eraIcon = wrap(this.add.image(46, 82, 'weapon_rock').setScale(0.22));
    this.eraText = wrap(this.add.text(78, 70, '', style(27, '#ffffff', 6)).setOrigin(0, 0.5));
    this.weapText = wrap(this.add.text(80, 96, '', style(15, '#ffe9b0', 4)).setOrigin(0, 0.5));
    this.statText = wrap(this.add.text(518, 82, '', style(14, '#ffffff', 4, { align: 'right', lineSpacing: 1 })).setOrigin(1, 0.5));
    this.xpText = wrap(this.add.text(270, 124, '', style(14, '#ffffff', 4)).setOrigin(0.5));
    // checkpoint meter (5 rarity bands) and the active power-up icons under the panel
    wrap(this.add.text(22, 151, 'POWER METER', style(11, '#cccccc', 3)).setOrigin(0, 0.5));
    this.meterText = wrap(this.add.text(518, 151, '', style(13, '#ffffff', 4)).setOrigin(1, 0.5));
    this.puIcons = wrap(this.add.container(0, 208));
    this.hurtFlash = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setDepth(D0 - 10);
    this.hudDirty = true;
  }

  xpFrac() {
    if (this.tier >= this.maxTier) return 1;
    return Phaser.Math.Clamp(this.xp / this.level.need[0], 0, 1);
  }

  pulseXp() { this.xpPulse = 1; }

  updateHud(force) {
    const g = this.hudG;
    const e = ERAS[this.era];
    g.clear();
    // health
    const hpF = this.hp / this.maxHp;
    g.fillStyle(0x2a1010, 1).fillRoundedRect(50, 24, 175, 20, 8);
    if (hpF > 0) g.fillStyle(hpF > 0.35 ? 0x4cd964 : 0xff3b30, 1).fillRoundedRect(50, 24, Math.max(16, 175 * hpF), 20, 8);
    // level progress
    const prog = Phaser.Math.Clamp(this.d / this.level.finish, 0, 1);
    g.fillStyle(0x222222, 1).fillRoundedRect(380, 26, 140, 16, 7);
    g.fillStyle(0xffe14d, 1).fillRoundedRect(380, 26, Math.max(14, 140 * prog), 16, 7);
    for (const c of this.level.checkpoints) g.fillStyle(0xffffff, 1).fillRect(380 + 140 * (c / this.level.finish) - 1.5, 22, 3, 24);
    g.fillStyle(0xe5483d, 1).fillCircle(518, 34, 7);
    // xp bar
    const xf = this.xpFrac();
    this.xpPulse = Math.max(0, (this.xpPulse || 0) - 0.08);
    const grow = this.xpPulse * 3;
    g.fillStyle(0x1a1a1a, 1).fillRoundedRect(20, 112 - grow, 500, 24 + grow * 2, 10);
    if (xf > 0) g.fillStyle(e.ui, 1).fillRoundedRect(20, 112 - grow, Math.max(20, 500 * xf), 24 + grow * 2, 10);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(24, 114 - grow, Math.max(12, 492 * xf), 8, 4);
    this.drawMeter(g, 162);

    this.hpText.setText(`${Math.ceil(this.hp)} / ${this.maxHp}`);
    const cs = String(this.runCoins);
    if (this.coinText.text !== cs) this.coinText.setText(cs);
    const next = this.tier < this.maxTier ? WEAPONS[this.tier + 1] : null;
    const xpLabel = !next ? 'BEST WEAPON OF THE ERA!' : `XP ${Math.floor(Math.min(this.xp, this.level.need[0]))} / ${this.level.need[0]}   NEXT: ${next.name.toUpperCase()}`;
    this.xpText.setText(xpLabel);
    if (force || this.hudTier !== this.tier) {
      this.hudTier = this.tier;
      this.eraText.setText(e.name);
      this.weapText.setText(`${this.weapon.name.toUpperCase()}  ${'★'.repeat((this.tier & 1) + 1)}`);
      this.eraIcon.setTexture('weapon_' + this.weapon.key);
      this.levelText.setText(`LEVEL ${this.levelN}`);
    }
    const st = `DMG ${this.dmg.toFixed(1)}\nRATE ${this.rate.toFixed(1)}/s\nSHOTS ${this.shots}`;
    if (st !== this.lastSt) { this.lastSt = st; this.statText.setText(st); }
  }

  toast(msg, color, y = PY - 150) {
    const t = this.add.text(y === PY - 150 ? CX + this.px : CX, y, msg, style(30, color, 7)).setOrigin(0.5).setDepth(8500);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 10, W - t.width / 2 - 10);
    this.tweens.add({ targets: t, y: t.y - 90, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  banner(title, sub, color, top = 'EVOLVED!') {
    if (this.bannerC?.active) this.bannerC.destroy(); // never stack two banners
    const c = this.add.container(W / 2, 400).setDepth(8600);
    this.bannerC = c;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55).fillRoundedRect(-230, -70, 460, 140, 22);
    bg.lineStyle(4, color, 1).strokeRoundedRect(-230, -70, 460, 140, 22);
    const a = this.add.text(0, -44, top, style(22, '#ffe14d', 5)).setOrigin(0.5);
    const b = this.add.text(0, 2, title, style(40, col(color === 0x29d8ff ? 0x29f0ff : 0xffffff), 8)).setOrigin(0.5);
    const s = this.add.text(0, 46, sub, style(18, '#ffffff', 4)).setOrigin(0.5);
    c.add([bg, a, b, s]);
    c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1500, duration: 400, onComplete: () => c.destroy() });
  }

  // smaller banner for a weapon upgrade inside the same era
  smallBanner(name, color) {
    if (this.bannerC?.active) this.bannerC.destroy();
    const c = this.add.container(W / 2, 400).setDepth(8600);
    this.bannerC = c;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(-170, -40, 340, 80, 18);
    bg.lineStyle(3, color, 1).strokeRoundedRect(-170, -40, 340, 80, 18);
    const a = this.add.text(0, -16, 'UPGRADED!', style(18, '#7dff9a', 4)).setOrigin(0.5);
    const b = this.add.text(0, 12, name, style(name.length > 14 ? 24 : 28, '#ffffff', 6)).setOrigin(0.5);
    c.add([bg, a, b]);
    c.setScale(0.4);
    this.tweens.add({ targets: c, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1100, duration: 350, onComplete: () => c.destroy() });
  }

  // ------------------------------------------------------------------ run start / end
  // start a level (default: the one picked on the title screen / the highest unlocked)
  startRun(level) {
    if (this.mode === 'play') return;
    this.closeScreen();
    const n = Math.max(1, Math.floor(level || this.selLevel || Save.data.level || 1));
    this.levelN = n;
    this.resetRun();
    this.runStarted = true;
    this.d = 0;
    this.mode = 'play';
    this.dragging = false;
    this.hud.setVisible(true);
    Sound.setSong('run');
    if (this.mods.startXpFrac) this.xp = this.level.need[0] * this.mods.startXpFrac; // Head Start
    this.updateHud(true);
    if (this.simulating) return;
    this.banner(`LEVEL ${n}`, `${this.info.name}${this.info.loop ? `  ·  LOOP ${this.info.loop + 1}` : ''}`, ERAS[this.info.era].ui, 'GO!');
    const hint = this.add.text(W / 2, 640, '◀  DRAG TO STEER  ▶', style(26, '#ffffff', 6)).setOrigin(0.5).setDepth(8500);
    this.tweens.add({ targets: hint, alpha: 0, delay: 2200, duration: 600, onComplete: () => hint.destroy() });
  }

  projectPt(x, z) { return project(x, z); }
  levelCoins(n) { return Math.max(1, Math.round(n * this.info.coinMul)); }

  addCoins(n, o) {
    this.runCoins += n;
    if (this.simulating || !o) return;
    const pr = project(o.x, Math.max(o.z, 0));
    const k = Math.min(n, 12);
    for (let i = 0; i < k; i++) {
      const coin = this.add.image(pr.x + (Math.random() - 0.5) * 40 * Math.max(pr.s, 0.5), pr.y - 50 * pr.s, 'coin').setScale(0.8).setDepth(8700);
      this.tweens.add({ targets: coin, x: 250, y: 34 + (this.hudY || 0), scale: 0.5, duration: 550 + i * 45, delay: i * 30, ease: 'Cubic.easeIn',
        onComplete: () => { coin.destroy(); Sound.play('coin'); this.coinPulse(); } });
    }
  }

  coinPulse() {
    this.coinText.setScale(1.3);
    this.tweens.add({ targets: this.coinText, scale: 1, duration: 150 });
  }

  burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const dot = this.add.image(x, y, 'dot').setTint(i % 3 ? color : 0xffffff).setScale(0.6 + Math.random() * 0.8).setDepth(8000);
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 90;
      this.tweens.add({ targets: dot, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, scale: 0.1, duration: 550, onComplete: () => dot.destroy() });
    }
  }

  finishRun(won) {
    if (this.mode !== 'play') return;
    const raw = Math.round(this.runCoins * this.mods.coinMul);
    const coins = won ? raw : Math.ceil(raw / 2);
    const S = Save.data, best = S.best;
    const newBest = this.tier > best.tier;
    S.coins += coins;
    best.era = Math.max(best.era, this.era);
    best.tier = Math.max(best.tier, this.tier);
    best.runs++;
    let unlocked = 0;
    if (won) {
      best.wins++; best.bossKills[this.boss.era]++;
      best.level = Math.max(best.level || 0, this.levelN);
      if (this.levelN + 1 > S.level) { S.level = this.levelN + 1; unlocked = S.level; }
      this.selLevel = this.levelN + 1;
    }
    best.bestCoins = Math.max(best.bestCoins, coins);
    if (!this.noSave) Save.write();
    this.stats.coins = coins;
    const pct = Math.round(Phaser.Math.Clamp(this.d / this.level.finish, 0, 1) * 100);
    this.lastResult = { won, level: this.levelN, unlocked, era: this.era, tier: this.tier, powerups: this.puOrder.map((id) => [id, this.puCount[id]]), coins, coinsRaw: raw, kills: this.stats.kills, blocks: this.stats.blocks, gates: this.stats.gates, hp: this.hp,
      time: this.time, pct, bossName: this.boss?.def.name, bossTime: this.stats.bossTime || 0, newBest };
    this.mode = won ? 'won' : 'lost';
    this.dragging = false;
    this.bprojs.forEach((p) => p.img?.destroy());
    this.bprojs = [];
    this.bossWarns = [];
    this.showBossBar(false);
    if (this.simulating) return;
    Sound.play(won ? 'win' : 'lose');
    Sound.setSong('run');
    this.showEnd(this.lastResult);
  }

  win() { this.finishRun(true); }
  lose() { this.finishRun(false); }

  // ------------------------------------------------------------------ bot + test hooks
  botSteer(dt) {
    // 'smart' = near-perfect; 'casual' = 30% wrong gates, sloppy aim, ignores blocks;
    // 'human' = a weaker player: slow reactions, poor aim, 35% wrong gates, often drifts off target.
    const human = this.bot === 'human';
    const casual = this.bot === 'casual' || human;
    this.botT = (this.botT || 0) - dt;
    if (casual && this.botT > 0) return;
    this.botT = human ? 0.7 : casual ? 0.45 : 0;
    if (this.boss) { this.botBoss(human, casual); return; }
    const gates = this.objs.filter((o) => o.type === 'gate' && !o.dead && !o.pair.used && o.z > 0 && o.z < 1000);
    if (gates.length) {
      const pair = gates[0].pair;
      if (pair.choice === undefined) {
        const score = (o) => { const g = o.gate; const v = g.value; return g.kind === 'shot' ? v * 45 : g.kind === 'hp' ? (this.maxHp - this.hp > 30 ? 40 : 8) : v; };
        let best = score(pair.objs[0]) >= score(pair.objs[1]) ? 0 : 1;
        if (casual && Math.random() < (human ? 0.35 : 0.3)) best = 1 - best;
        pair.choice = best;
      }
      this.tx = pair.choice === 0 ? -100 : 100;
      return;
    }
    const enemies = this.objs.filter((o) => o.type === 'enemy' && !o.dead && o.z > 30 && o.z < 1400).sort((a, b) => a.z - b.z);
    let target = enemies.length ? enemies[0].x : 0;
    // line up on a gem crate to pump its number when nothing dangerous is close
    const crate = this.objs.find((o) => o.type === 'crate' && !o.used && !o.dead && o.z > 80 && o.z < 1500);
    if (crate && (!enemies.length || enemies[0].z > 420 || enemies[0].z > crate.z) && Math.random() < (human ? 0.55 : casual ? 0.8 : 1)) target = crate.x;
    // go for XP gems lying ahead when they're closer than the next enemy (sloppier bots notice less often)
    const gem = this.gems.filter((g) => !g.pull && g.z > 0 && g.z < 420).sort((a, b) => a.z - b.z)[0];
    if (gem && (!casual || !enemies.length || gem.z < enemies[0].z) && Math.random() < (human ? 0.45 : casual ? 0.75 : 1)) target = gem.x;
    if (!casual) {
      const blocks = this.objs.filter((o) => o.type === 'block' && !o.dead && o.z > 0 && o.z < 600);
      const danger = (x) => blocks.some((b) => Math.abs(b.x - x) < b.halfW + 45 && b.hp > this.dmg * this.rate * this.shots * (b.z / RUN));
      if (danger(target)) target = [-150, 0, 150].find((x) => !danger(x)) ?? target;
    } else if (human) {
      if (Math.random() < 0.35) target = this.tx; // didn't react this time
      target += (Math.random() - 0.5) * 220;
    } else target += (Math.random() - 0.5) * 80;
    this.tx = Phaser.Math.Clamp(target, -MAX_X, MAX_X);
  }

  // During the boss: move out of telegraphed lanes; otherwise stay roughly in front of the boss.
  botBoss(human, casual) {
    const b = this.boss;
    const threat = (x) => this.bossWarns.some((w) => Math.abs(w.x - x) < 90) || this.bprojs.some((p) => Math.abs(p.x - x) < 80) || (b.charge && Math.abs(b.charge.lane - x) < 100);
    const lanes = LANES.filter((l) => !threat(l));
    const here = LANES.reduce((a, l) => (Math.abs(l - this.px) < Math.abs(a - this.px) ? l : a));
    if (threat(this.px)) {
      const miss = human ? 0.32 : casual ? 0.15 : 0; // didn't notice / froze
      if (Math.random() < miss) return;
      const pick = lanes.sort((a, c) => Math.abs(a - b.obj.x) - Math.abs(c - b.obj.x))[human ? Math.floor(Math.random() * lanes.length) : 0];
      if (pick !== undefined) this.tx = pick;
    } else if (!threat(here)) {
      const aim = Phaser.Math.Clamp(b.obj.x + (human ? (Math.random() - 0.5) * 160 : 0), -MAX_X, MAX_X);
      if (!threat(aim)) this.tx = aim;
    }
  }

  exposeHooks() {
    const s = this;
    window.__ER = Object.assign(window.__ER || {}, {
      scene: s,
      ready: true,
      start: (level) => s.startRun(level),
      // give the run a power-up by id (tests / screenshots)
      givePowerup: (id) => { const u = POWERUPS.find((p) => p.id === id); s.applyPowerup(u); s.updateHud(true); return !!u; },
      setBot: (b) => { s.bot = b; },
      payout, LAP,
      // tests / screenshots: clear the track and fast-forward to just before checkpoint i with a given meter
      toCheckpoint: (i = 0, meter = null, ahead = 700) => {
        const L = s.level; const idx = L.items.findIndex((it) => it.type === 'checkpoint' && it.at === L.checkpoints[i]);
        s.objs.forEach((o) => { o.dead = true; }); s.gems.forEach((g) => { g.dead = true; });
        s.qi = idx; s.d = L.checkpoints[i] - ahead;
        if (meter != null) s.meter = meter;
        s.updateHud(true);
        return idx;
      },
      // testing/screenshots: skip to the boss arena with the weapon in a given era
      // (era 0-5 uses that era's second weapon; pass tier to pick an exact weapon)
      jumpToBoss: (era, boosts = { rate: 40, dmg: 40, extra: 2 }, tier = era * 2 + 1, level = era + 1) => {
        s.closeScreen(); s.mode = 'won'; s.startRun(level);
        s.objs.forEach((o) => { o.dead = true; });
        s.qi = s.level.items.length;
        s.tier = tier; s.xp = 0;
        s.rateB = boosts.rate; s.dmgB = boosts.dmg; s.extra = boosts.extra;
        s.setEraVisuals(era, true);
        s.refreshWeaponLook();
        s.d = s.level.finish - 125;
        s.updateHud(true);
      },
      save: Save, upgrades: UPGRADES, upgCost,
      // balance testing: override upgrade levels for the next runs without touching the save
      setTestUpgrades: (u, noSave = true) => { s.testUpg = u; s.noSave = noSave; },
      // page coordinates of a named UI button (for tests)
      uiPoint: (name) => {
        const z = s.ui[name];
        if (!z || !z.active) return null;
        const m = z.getWorldTransformMatrix();
        const cam = s.cameras.main;
        const r = s.game.canvas.getBoundingClientRect();
        const k = r.width / s.scale.gameSize.width;
        return { x: r.x + (m.tx - cam.worldView.x) * cam.zoom * k, y: r.y + (m.ty - cam.worldView.y) * cam.zoom * k };
      },
      state: () => ({ mode: s.mode, boss: s.boss ? { name: s.boss.def.name, hp: s.boss.hp, maxHp: s.boss.maxHp, phase: s.boss.phase, t: s.boss.t } : null, coins: s.runCoins, savedCoins: Save.data.coins, maxHp: s.maxHp, level: s.levelN, era: s.era, eraName: ERAS[s.era].name, tier: s.tier, meter: s.meter, band: s.meterBand(), lap: s.meterLap(), powerups: { ...s.puCount }, pu: { ...s.pu }, unlocked: Save.data.level, paused: s.pauseT > 0, weapon: s.weapon.name, need: s.level.need, xp: s.xp, hp: s.hp, d: s.d, finish: s.level.finish, time: s.time,
        rate: s.rate, dmg: s.dmg, shots: s.shots, stats: { ...s.stats }, eraTimes: [...s.eraTimes], tierTimes: [...s.tierTimes], objs: s.objs.length, projs: s.projs.length }),
      // fast-forward the simulation (headless) with the current bot steering
      sim: (seconds, opts = {}) => {
        const wasPlaying = s.mode === 'play';
        s.simulating = !opts.visual;
        const steps = Math.round(seconds * 60);
        for (let i = 0; i < steps && s.mode === 'play'; i++) { if (s.bot) s.botSteer(1 / 60); s.step(1 / 60); }
        s.simulating = false;
        s.setEraVisuals(s.era, true);
        s.refreshWeaponLook();
        s.updateHud(true);
        if (wasPlaying && !opts.visual && s.mode !== 'play' && s.lastResult) s.showEnd(s.lastResult);
        return window.__ER.state();
      },
    });
  }
}

Object.assign(GameScene.prototype, BossMethods, ScreenMethods, CheckpointMethods, CrateMethods);
