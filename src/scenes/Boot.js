import Phaser from 'phaser';
import { ERAS } from '../eras.js';

// All art is generated at startup with vector drawing, at 2x resolution (K) so it stays sharp.
const K = 2;

class Pen {
  constructor(g) { this.g = g; }
  fill(c, a = 1) { this.g.fillStyle(c, a); return this; }
  line(w, c, a = 1) { this.g.lineStyle(w * K, c, a); return this; }
  rect(x, y, w, h) { this.g.fillRect(x * K, y * K, w * K, h * K); return this; }
  rrect(x, y, w, h, r) { this.g.fillRoundedRect(x * K, y * K, w * K, h * K, typeof r === 'number' ? r * K : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v * K]))); return this; }
  srrect(x, y, w, h, r) { this.g.strokeRoundedRect(x * K, y * K, w * K, h * K, r * K); return this; }
  circle(x, y, r) { this.g.fillCircle(x * K, y * K, r * K); return this; }
  scircle(x, y, r) { this.g.strokeCircle(x * K, y * K, r * K); return this; }
  ellipse(x, y, w, h) { this.g.fillEllipse(x * K, y * K, w * K, h * K); return this; }
  tri(a, b, c, d, e, f) { this.g.fillTriangle(a * K, b * K, c * K, d * K, e * K, f * K); return this; }
  poly(pts) { this.g.fillPoints(pts.map(([x, y]) => ({ x: x * K, y: y * K })), true); return this; }
  spoly(pts, closed = false) { this.g.strokePoints(pts.map(([x, y]) => ({ x: x * K, y: y * K })), closed); return this; }
  seg(x1, y1, x2, y2) { this.g.lineBetween(x1 * K, y1 * K, x2 * K, y2 * K); return this; }
}

function make(scene, key, w, h, draw) {
  const g = scene.add.graphics();
  draw(new Pen(g), g);
  g.generateTexture(key, w * K, h * K);
  g.destroy();
}

// ---------- enemies (80 x 100 logical, feet at bottom) ----------
function enemy(scene, key) {
  make(scene, 'enemy_' + key, 80, 100, (p) => {
    const skin = 0xf1c27d;
    const look = {
      stone: { body: 0x8b5a2b, legs: 0x5a3a1a, arms: skin },
      bronze: { body: 0xb5452f, legs: 0x6b3a1e, arms: skin },
      medieval: { body: 0xa7b1ba, legs: 0x6c757d, arms: 0x8f99a3 },
      gunpowder: { body: 0x2c4f9e, legs: 0xeeeeee, arms: 0x2c4f9e },
      modern: { body: 0x5d6b3a, legs: 0x4a5530, arms: 0x5d6b3a },
      future: { body: 0x6c7a96, legs: 0x4b5670, arms: 0x8592ad },
    }[key];
    // legs + boots
    p.fill(look.legs).rrect(26, 76, 11, 22, 4).rrect(43, 76, 11, 22, 4);
    p.fill(0x2a1d14).rrect(24, 92, 14, 8, 3).rrect(42, 92, 14, 8, 3);
    // weapon in right hand (behind the hand)
    if (key === 'stone') { p.fill(0x7a4a24).rrect(63, 30, 8, 48, 3); p.fill(0x6a3d1c).circle(67, 30, 10); }
    if (key === 'bronze') { p.fill(0x8a5a2b).rect(65, 6, 4, 76); p.fill(0xcd7f32).tri(67, -2 + 2, 61, 14, 73, 14); }
    if (key === 'medieval') { p.fill(0xd9dee3).rect(64, 22, 7, 46); p.fill(0x5a4632).rect(59, 66, 17, 4); }
    if (key === 'gunpowder') { p.fill(0x5a3a1a).rect(64, 14, 6, 66); p.fill(0x333333).rect(65, 8, 4, 12); }
    if (key === 'modern') { p.fill(0x222222).rect(62, 30, 9, 48); p.fill(0x222222).rect(64, 22, 4, 10); }
    if (key === 'future') { p.fill(0x29f0ff, 0.9).rect(64, 22, 6, 50); p.fill(0xffffff).rect(66, 22, 2, 50); }
    // body + arms
    p.fill(look.body).rrect(18, 42, 44, 40, 12);
    p.fill(look.arms).rrect(7, 46, 12, 28, 6).rrect(61, 46, 12, 28, 6);
    p.fill(key === 'future' || key === 'medieval' ? look.arms : skin).circle(13, 76, 6).circle(67, 76, 6);
    // body details
    if (key === 'stone') { p.fill(0x6a3d1c).circle(30, 56, 4).circle(48, 66, 5).circle(40, 50, 3); p.fill(skin).tri(18, 42, 34, 42, 18, 58); }
    if (key === 'bronze') { p.fill(0xcd7f32).rect(18, 66, 44, 6); p.fill(0xcd7f32).circle(13, 60, 15); p.fill(0xa86424).circle(13, 60, 10); p.fill(0xe7a95b).circle(13, 60, 4); }
    if (key === 'medieval') { p.fill(0xc0392b).rrect(28, 46, 24, 30, 6); p.fill(0xf1c40f).rect(38, 50, 4, 20).rect(32, 56, 16, 4); }
    if (key === 'gunpowder') { p.line(4, 0xffffff).seg(20, 44, 58, 80).seg(60, 44, 22, 80); p.fill(0xf1c40f).circle(40, 62, 3); }
    if (key === 'modern') { p.fill(0x3e4a24).circle(28, 54, 5).circle(50, 70, 6).circle(46, 50, 4); p.fill(0x2b2b2b).rect(18, 64, 44, 5); }
    if (key === 'future') { p.fill(0x29f0ff).rrect(32, 52, 16, 10, 3); p.fill(0x4b5670).rect(18, 70, 44, 4); }
    // head
    if (key === 'medieval') {
      p.fill(0xb8c1c9).rrect(22, 10, 36, 36, 10); p.fill(0x2b2b2b).rect(27, 24, 26, 5); p.fill(0x2b2b2b).rect(38, 29, 4, 10);
      p.fill(0xc0392b).ellipse(40, 6, 12, 16);
    } else if (key === 'future') {
      p.fill(0x9aa6c0).rrect(23, 10, 34, 32, 7); p.fill(0x111a2e).rrect(26, 18, 28, 12, 4); p.fill(0x29f0ff).rrect(28, 21, 24, 6, 3);
      p.fill(0x9aa6c0).rect(39, 0, 2, 10); p.fill(0xff3b5c).circle(40, 1, 3);
    } else {
      p.fill(skin).circle(40, 28, 17);
      p.fill(0xffffff).circle(33, 28, 5).circle(47, 28, 5);
      p.fill(0x111111).circle(34, 29, 2.5).circle(46, 29, 2.5);
      p.line(3, 0x2b1a10).seg(27, 20, 37, 23).seg(53, 20, 43, 23);
      p.fill(0x8a3b2a).rrect(34, 36, 12, 4, 2);
      if (key === 'stone') { p.fill(0x4a2c12).ellipse(40, 14, 38, 16).circle(25, 20, 6).circle(55, 20, 6).circle(32, 9, 6).circle(48, 9, 6); p.fill(0x4a2c12).ellipse(40, 41, 22, 8); }
      if (key === 'bronze') { p.fill(0xcd7f32).rrect(22, 8, 36, 16, { tl: 16, tr: 16, bl: 2, br: 2 }); p.fill(0xc0392b).rrect(36, 0, 8, 12, 3); p.fill(0xa86424).rect(22, 21, 36, 3); }
      if (key === 'gunpowder') { p.fill(0x1b1b1b).tri(16, 16, 64, 16, 40, 2); p.fill(0x1b1b1b).rrect(24, 8, 32, 10, 4); p.fill(0xf1c40f).circle(40, 12, 2.5); }
      if (key === 'modern') { p.fill(0x4a5530).rrect(21, 8, 38, 16, { tl: 17, tr: 17, bl: 3, br: 3 }); p.fill(0x111111).rrect(27, 24, 26, 7, 3); }
    }
  });
}

// ---------- blocks (90 x 80 logical) ----------
function block(scene, key) {
  make(scene, 'block_' + key, 90, 80, (p) => {
    if (key === 'stone') {
      p.fill(0x6e6a64).ellipse(45, 44, 88, 72); p.fill(0x8d8a85).ellipse(43, 40, 80, 64); p.fill(0xa9a6a0).ellipse(32, 28, 34, 20);
      p.line(3, 0x5c5852).spoly([[60, 20], [54, 36], [64, 48]]).spoly([[22, 52], [34, 58], [30, 68]]);
    } else if (key === 'bronze') {
      p.fill(0x7a4f22).rrect(2, 2, 86, 76, 6); p.fill(0xc8924a).rrect(8, 8, 74, 64, 4);
      p.fill(0xa8743a).rect(8, 26, 74, 4).rect(8, 48, 74, 4); p.line(7, 0x7a4f22).seg(10, 10, 80, 70);
    } else if (key === 'medieval') {
      p.fill(0x6f675c).rrect(0, 0, 90, 80, 6);
      const rows = 4, bh = 20;
      for (let r = 0; r < rows; r++) for (let c = -1; c < 4; c++) {
        const x = c * 30 + (r % 2 ? 15 : 0) + 2, y = r * bh + 2;
        const x0 = Math.max(2, x), x1 = Math.min(88, x + 27);
        if (x1 > x0) p.fill(r % 2 ? 0xb3aa9a : 0xc4bbaa).rrect(x0, y, x1 - x0, bh - 3, 3);
      }
    } else if (key === 'gunpowder') {
      p.fill(0x5a3a1a).ellipse(45, 40, 76, 80); p.fill(0x8b5a2b).ellipse(45, 40, 66, 78);
      p.fill(0x4a4a4a).rect(8, 14, 74, 6).rect(8, 60, 74, 6); p.fill(0x6b4423).rect(30, 2, 4, 76).rect(56, 2, 4, 76);
      p.fill(0x111111).circle(45, 4, 4);
    } else if (key === 'modern') {
      p.fill(0x56616d).rrect(0, 0, 90, 80, 5); p.fill(0x8b98a5).rrect(5, 5, 80, 70, 4);
      for (let i = 0; i < 6; i++) p.fill(i % 2 ? 0x222222 : 0xf1c40f).poly([[5 + i * 14, 34], [19 + i * 14, 34], [12 + i * 14, 46], [-2 + i * 14, 46]]);
      p.fill(0x56616d).circle(12, 12, 3).circle(78, 12, 3).circle(12, 68, 3).circle(78, 68, 3);
    } else {
      p.fill(0x29f0ff, 0.35).rrect(0, 0, 90, 80, 10); p.fill(0x3b1a8a).rrect(4, 4, 82, 72, 8);
      p.line(3, 0x29f0ff).srrect(8, 8, 74, 64, 6); p.fill(0xb36bff).rrect(30, 26, 30, 28, 6); p.fill(0xffffff, 0.8).rrect(38, 34, 14, 12, 4);
    }
  });
}

// ---------- weapons (110 x 150 logical, pointing up, base at bottom) ----------
function weapon(scene, key) {
  make(scene, 'weapon_' + key, 110, 150, (p) => {
    if (key === 'stone') {
      p.line(14, 0x7a4a24).seg(55, 100, 30, 38).seg(55, 100, 80, 38);
      p.line(8, 0x9b6a35).seg(55, 100, 31, 40).seg(55, 100, 79, 40);
      p.fill(0x7a4a24).rrect(47, 92, 16, 56, 7); p.fill(0x5a3a1a).rect(47, 110, 16, 5).rect(47, 122, 16, 5).rect(47, 134, 16, 5);
      p.line(4, 0x4a2c12).seg(30, 38, 55, 64).seg(80, 38, 55, 64);
      p.fill(0x6a4a2a).ellipse(55, 64, 22, 12); p.fill(0x9a958e).circle(55, 60, 9); p.fill(0xc4c0b9).circle(52, 57, 3);
    } else if (key === 'bronze') {
      p.fill(0x9b6a35).rrect(49, 26, 12, 122, 5); p.fill(0x7a4a24).rrect(46, 100, 18, 32, 5);
      p.fill(0x5a3a1a).rect(46, 106, 18, 3).rect(46, 114, 18, 3).rect(46, 122, 18, 3);
      p.fill(0xcd7f32).tri(55, 0, 42, 32, 68, 32); p.fill(0xe7a95b).tri(55, 4, 50, 28, 55, 28);
      p.fill(0xa86424).rect(47, 30, 16, 6); p.fill(0xc0392b).tri(49, 40, 38, 52, 49, 54).tri(61, 40, 72, 52, 61, 54);
    } else if (key === 'medieval') {
      p.fill(0x7a4a24).rrect(46, 30, 18, 118, 6); p.fill(0x5a3a1a).rrect(44, 112, 22, 36, 6);
      p.line(10, 0x4a2c12).spoly([[4, 62], [22, 42], [55, 34], [88, 42], [106, 62]]);
      p.line(5, 0x8b5a2b).spoly([[6, 60], [22, 43], [55, 36], [88, 43], [104, 60]]);
      p.line(2, 0xeeeeee).seg(6, 62, 55, 80).seg(104, 62, 55, 80);
      p.fill(0x333333).rect(53, 8, 4, 76); p.fill(0xbfc5ca).tri(55, 0, 49, 12, 61, 12); p.fill(0xc0392b).tri(53, 74, 46, 86, 53, 84).tri(57, 74, 64, 86, 57, 84);
      p.fill(0x9aa4ad).rect(44, 78, 22, 6);
    } else if (key === 'gunpowder') {
      p.fill(0x6b4423).circle(18, 116, 20).circle(92, 116, 20); p.fill(0x8b5a2b).circle(18, 116, 15).circle(92, 116, 15);
      p.line(3, 0x5a3a1a).seg(18, 101, 18, 131).seg(3, 116, 33, 116).seg(77, 116, 107, 116).seg(92, 101, 92, 131);
      p.fill(0x2f333a).rrect(34, 14, 42, 118, 18); p.fill(0x4a505a).rrect(40, 18, 12, 106, 6);
      p.fill(0x22252b).rrect(30, 6, 50, 16, 7); p.fill(0x111111).ellipse(55, 10, 28, 8);
      p.fill(0xf0b429).rect(34, 48, 42, 5).rect(34, 96, 42, 5); p.fill(0x22252b).circle(55, 136, 12); p.fill(0xf0b429).circle(55, 136, 5);
    } else if (key === 'modern') {
      p.fill(0x1f2125).rrect(48, 0, 14, 66, 4); p.fill(0x3a3d43).rrect(43, 18, 24, 42, 5);
      for (let i = 0; i < 4; i++) p.fill(0x111214).rrect(47, 22 + i * 9, 16, 5, 2);
      p.fill(0x2b2d31).rrect(32, 58, 46, 74, 8); p.fill(0x3e4148).rrect(38, 64, 34, 30, 5);
      for (let i = 0; i < 6; i++) p.fill(i % 2 ? 0xd4a017 : 0xf1c40f).rrect(78, 66 + i * 9, 14, 7, 2);
      p.fill(0x1f2125).rrect(46, 128, 18, 20, 4); p.fill(0x6b4423).rrect(18, 96, 16, 30, 5).rrect(76, 120, 0.1, 0.1, 0);
    } else {
      p.fill(0x29f0ff, 0.25).circle(55, 12, 18); p.fill(0x29f0ff, 0.6).circle(55, 12, 11); p.fill(0xffffff).circle(55, 12, 6);
      p.fill(0xb8c4d0).rrect(46, 16, 18, 52, 8); p.fill(0x29f0ff).rect(46, 30, 18, 3).rect(46, 42, 18, 3);
      p.fill(0xeef3f8).rrect(28, 56, 54, 82, 20); p.fill(0xcfd8e2).rrect(34, 62, 14, 68, 7);
      p.fill(0x29f0ff).rrect(60, 70, 12, 46, 6); p.fill(0xffffff, 0.8).rrect(63, 74, 4, 36, 2);
      p.fill(0x7a5cff).rrect(40, 132, 30, 14, 6);
    }
  });
}

function projectiles(scene) {
  make(scene, 'p_rock', 18, 18, (p) => { p.fill(0x6e6a64).circle(9, 9, 8); p.fill(0x9a958e).circle(8, 8, 6.5); p.fill(0xc4c0b9).circle(6, 6, 2.5); });
  make(scene, 'p_spear', 10, 50, (p) => { p.fill(0x9b6a35).rect(4, 10, 3, 40); p.fill(0xcd7f32).tri(5.5, 0, 1, 14, 10, 14); p.fill(0xc0392b).tri(5, 40, 0, 50, 5, 47).tri(6, 40, 10, 50, 6, 47); });
  make(scene, 'p_bolt', 10, 38, (p) => { p.fill(0x3a2a1a).rect(4, 8, 3, 30); p.fill(0xd9dee3).tri(5.5, 0, 1.5, 10, 9.5, 10); p.fill(0xc0392b).tri(4, 30, 0, 38, 4, 36).tri(7, 30, 10, 38, 7, 36); });
  make(scene, 'p_ball', 26, 26, (p) => { p.fill(0xff9a2e, 0.35).circle(13, 13, 13); p.fill(0x1b1d22).circle(13, 13, 10); p.fill(0x5a606a).circle(10, 10, 3.5); });
  make(scene, 'p_bullet', 10, 24, (p) => { p.fill(0xffe9a0, 0.4).rrect(0, 0, 10, 24, 5); p.fill(0xf1c40f).rrect(2.5, 3, 5, 18, 2.5); p.fill(0xfff6cc).rrect(3.5, 3, 3, 8, 1.5); });
  make(scene, 'p_laser', 14, 64, (p) => { p.fill(0x29f0ff, 0.3).rrect(0, 0, 14, 64, 7); p.fill(0x29f0ff, 0.8).rrect(3, 2, 8, 60, 4); p.fill(0xffffff).rrect(5.5, 4, 3, 56, 1.5); });
}

function misc(scene) {
  make(scene, 'gate', 220, 170, (p) => { p.fill(0xffffff).rrect(0, 0, 220, 170, 20); p.fill(0xc8c8c8).rrect(8, 8, 204, 154, 15); p.fill(0xffffff, 0.35).rrect(14, 12, 192, 40, 12); });
  make(scene, 'shadow', 100, 30, (p) => { p.fill(0x000000, 0.28).ellipse(50, 15, 100, 30); });
  make(scene, 'dot', 16, 16, (p) => { p.fill(0xffffff).circle(8, 8, 8); });
  make(scene, 'gem', 18, 22, (p) => { p.fill(0x1e8f4e).poly([[9, 0], [18, 9], [9, 22], [0, 9]]); p.fill(0x5cff8a).poly([[9, 2], [15, 9], [9, 18], [3, 9]]); p.fill(0xd6ffe2).poly([[9, 3], [12, 8], [9, 9], [6, 8]]); });
  make(scene, 'heart', 30, 28, (p) => { p.fill(0xff3b5c).circle(8, 9, 8).circle(22, 9, 8).tri(0.5, 12, 29.5, 12, 15, 27); p.fill(0xffffff, 0.6).circle(7, 7, 3); });
  make(scene, 'flag', 500, 210, (p) => {
    p.fill(0x444444).rect(4, 0, 12, 210).rect(484, 0, 12, 210);
    p.fill(0x222222).rect(0, 10, 500, 64);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 25; c++) if ((r + c) % 2 === 0) p.fill(0xffffff).rect(c * 20, 14 + r * 19, 20, 19);
  });
}

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    ERAS.forEach((e) => { enemy(this, e.key); block(this, e.key); weapon(this, e.key); });
    projectiles(this);
    misc(this);
    this.scene.start('game');
  }
}
export const TEX_K = K;
