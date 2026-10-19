import { WAVES } from './tuning.js';
import { Sound } from './audio.js';

// Wave behaviour at runtime (mixed into GameScene, see the bottom of Game.js):
//  - chargers (Level 4+): walk in, stop and mark your lane in red (telegraph), then rush down it
//  - enemies can't close in on a gate / crate that is still in front of them (it blocks your shots)
//  - enemies that end up on top of each other push apart sideways
const MAX_X = 205;
const C = WAVES.charger;

export const WaveMethods = {
  stepCharger(o, dt, blockers) {
    const ch = o.ch;
    if (!ch) {
      o.z -= (this.runSpeed + (o.walk || 0)) * dt;
      if (o.z > C.trigger || this.boss || this.bonus) return;
      // never telegraph while a gate still hides it, and never start so close that it can't be dodged
      const hidden = blockers.some((b) => b.type === 'gate' && b.z < o.z);
      if (hidden) return;
      if (o.z < C.minZ) { o.charger = false; o.chTag?.setVisible(false); return; }
      o.ch = { phase: 'aim', t: 0, lane: Math.max(-MAX_X + 20, Math.min(MAX_X - 20, this.px)) };
      this.stats.chargers = (this.stats.chargers || 0) + 1;
      if (!this.simulating) Sound.play('gate_bad');
      return;
    }
    if (ch.phase === 'aim') {
      // holds its distance and slides into your lane while the red lane flashes
      ch.t += dt;
      o.x += (ch.lane - o.x) * Math.min(1, dt * 10);
      if (ch.t >= C.aim) { ch.phase = 'rush'; if (!this.simulating) Sound.play('boss_charge'); }
      return;
    }
    o.x = ch.lane;
    o.z -= C.rush * dt;
  },

  holdBehindBlockers(o, blockers) {
    if (o.ch) return;
    const v = this.runSpeed + (o.walk || 0);
    const gap = WAVES.holdAfter * v;
    for (const b of blockers) {
      if (b.z >= o.z) continue;
      // it overtakes the blocker and reaches you first: let it walk through
      if (this.runSpeed > 0 && o.z / v < b.z / this.runSpeed) continue;
      if (b.type === 'crate' && Math.abs(o.x - b.x) > b.halfW + o.halfW) continue;
      if (b.type === 'gate' && b !== b.pair.objs[0]) continue; // one check per gate pair
      if (o.z - b.z < gap) { o.z = b.z + gap; this.stats.held = (this.stats.held || 0) + 1; }
    }
  },

  separateEnemies(dt) {
    const en = this.objs.filter((o) => o.type === 'enemy' && !o.dead && !o.ch && o.z > 40);
    const push = WAVES.sepSpeed * dt;
    for (let i = 0; i < en.length; i++) {
      for (let j = i + 1; j < en.length; j++) {
        const a = en[i], b = en[j];
        if (Math.abs(a.z - b.z) > WAVES.sepDz || Math.abs(a.x - b.x) > WAVES.sepDx) continue;
        let dir = Math.sign(a.x - b.x) || (i % 2 ? 1 : -1);
        // pinned at the edge: push the other one instead
        if (a.x + dir * push > MAX_X - 5 || a.x + dir * push < -MAX_X + 5) dir = -dir;
        a.x = Math.max(-MAX_X + 5, Math.min(MAX_X - 5, a.x + dir * push));
        b.x = Math.max(-MAX_X + 5, Math.min(MAX_X - 5, b.x - dir * push));
      }
    }
  },

  // red lane in front of a charger while it telegraphs and rushes
  drawChargerWarns(quad) {
    for (const o of this.objs) {
      if (o.dead || !o.ch) continue;
      const x = o.ch.lane, z = Math.max(60, o.z - 10);
      const pulse = o.ch.phase === 'aim' ? 0.2 + 0.22 * Math.abs(Math.sin(o.ch.t * 12)) : 0.32;
      quad(x - 70, x + 70, -40, z, 0xff3b30, pulse);
      quad(x - 70, x - 60, -40, z, 0xff3b30, 0.8);
      quad(x + 60, x + 70, -40, z, 0xff3b30, 0.8);
    }
  },

  // bots: dodge a charger aimed at you unless you can kill it before it arrives
  botCharger(human, casual) {
    const dps = this.dmg * this.rate * Math.max(1, this.shots * 0.6);
    for (const o of this.objs) {
      if (o.dead || !o.ch || o.type !== 'enemy') continue;
      if (o.botDodge !== undefined) { this.tx = o.botDodge; return true; } // stay out until it's gone
      if (Math.abs(o.ch.lane - this.px) > o.halfW + 45) continue;
      const tta = (o.ch.phase === 'aim' ? C.aim - o.ch.t : 0) + o.z / C.rush;
      if (o.hp < dps * tta * (human ? 0.6 : 0.8)) continue; // shoot it down
      if (Math.random() < (human ? 0.3 : casual ? 0.12 : 0)) return true; // froze
      const opts = [o.ch.lane - 150, o.ch.lane + 150].filter((x) => Math.abs(x) <= MAX_X);
      const busy = (x) => this.objs.some((e) => e !== o && e.type === 'enemy' && !e.dead && e.z > 0 && e.z < 400 && Math.abs(e.x - x) < 80);
      opts.sort((a, b) => (busy(a) - busy(b)) || (Math.abs(a - this.px) - Math.abs(b - this.px)));
      if (opts.length) { this.tx = opts[0]; o.botDodge = opts[0]; }
      return true;
    }
    return false;
  },
};
