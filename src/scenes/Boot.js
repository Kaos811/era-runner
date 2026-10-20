import Phaser from 'phaser';
import { ERAS, WEAPONS } from '../eras.js';

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
    if (key === 'rock') { // a hand gripping a rock
      p.fill(0xc98a5a).rrect(40, 86, 30, 64, 12); p.fill(0xa86f45).rect(40, 120, 30, 4);
      p.fill(0x6e6a64).poly([[30, 52], [40, 26], [62, 18], [82, 32], [84, 58], [68, 76], [42, 74]]);
      p.fill(0x9a958e).poly([[36, 50], [44, 30], [62, 24], [76, 34], [78, 54], [66, 68], [46, 68]]);
      p.fill(0xc4c0b9).circle(52, 36, 5); p.fill(0x7f7a73).circle(68, 52, 4);
      p.fill(0xd99a6a).rrect(32, 66, 48, 26, 12);
      p.fill(0xb5784c); for (let i = 0; i < 3; i++) p.rect(43 + i * 12, 68, 2, 18);
      p.fill(0xd99a6a).rrect(24, 54, 14, 30, 7);
    } else if (key === 'javelin') { // a plain hand-thrown javelin
      p.fill(0x9b6a35).rrect(51, 22, 8, 128, 4); p.fill(0xb98447).rect(53, 22, 2, 128);
      p.fill(0x8a5a2b).poly([[55, 0], [64, 16], [60, 32], [50, 32], [46, 16]]); p.fill(0xcd7f32).poly([[55, 3], [61, 16], [58, 29], [52, 29], [49, 16]]);
      p.fill(0xe7a95b).tri(55, 5, 52, 16, 55, 27);
      p.fill(0x5a3a1a).rrect(48, 92, 14, 26, 4); p.fill(0x7a4a24).rect(48, 98, 14, 3).rect(48, 106, 14, 3);
      p.fill(0xc0392b).rect(49, 34, 12, 4);
    } else if (key === 'repeater') { // repeating crossbow with a bolt magazine on top
      p.fill(0x7a4a24).rrect(46, 40, 18, 108, 6); p.fill(0x5a3a1a).rrect(44, 116, 22, 32, 6);
      p.line(10, 0x4a2c12).spoly([[4, 70], [22, 52], [55, 44], [88, 52], [106, 70]]);
      p.line(5, 0x8b5a2b).spoly([[6, 68], [22, 53], [55, 46], [88, 53], [104, 68]]);
      p.line(2, 0xeeeeee).seg(6, 70, 55, 88).seg(104, 70, 55, 88);
      p.fill(0x6b4423).rrect(40, 0, 30, 66, 5); p.fill(0x8b5a2b).rrect(43, 4, 24, 58, 4);
      for (let i = 0; i < 5; i++) { p.fill(0xd9dee3).tri(47 + i * 4, 6, 45 + i * 4, 12, 49 + i * 4, 12); p.fill(0x3a2a1a).rect(46 + i * 4, 12, 2, 40); }
      p.fill(0x2c6fbf).rect(43, 50, 24, 5);
      p.line(5, 0x9aa4ad).seg(70, 30, 92, 96); p.fill(0x5a3a1a).circle(92, 98, 6);
    } else if (key === 'musket') { // long flintlock musket
      p.fill(0x6b4423).poly([[46, 70], [64, 70], [72, 148], [38, 148]]); p.fill(0x8b5a2b).poly([[49, 74], [61, 74], [66, 144], [44, 144]]);
      p.fill(0x50565e).rrect(50, 0, 10, 100, 4); p.fill(0x7d848d).rect(52, 2, 3, 96);
      p.fill(0x22252b).ellipse(55, 2, 10, 4);
      p.fill(0xd4a017).rect(48, 30, 14, 4).rect(48, 64, 14, 4).rect(46, 118, 18, 4);
      p.fill(0x3a3d43).rrect(62, 84, 12, 14, 3); p.fill(0x22252b).poly([[66, 84], [76, 74], [80, 78], [72, 88]]);
      p.line(2, 0x3a2a1a).seg(46, 20, 46, 70);
    } else if (key === 'rifle') { // assault rifle with a scope
      p.fill(0x1f2125).rrect(51, 0, 8, 46, 3); p.fill(0x111214).rect(49, 0, 12, 6);
      p.fill(0x3a3d43).rrect(44, 40, 22, 40, 5); for (let i = 0; i < 3; i++) p.fill(0x22252b).rect(47, 46 + i * 11, 16, 5);
      p.fill(0x2b2d31).rrect(40, 78, 30, 40, 6);
      p.fill(0x111214).rrect(25, 58, 14, 48, 6); p.fill(0x29a8ff, 0.8).circle(32, 60, 4); p.fill(0x29a8ff, 0.5).circle(32, 104, 4);
      p.fill(0x3e4148).poly([[70, 84], [86, 90], [84, 116], [70, 112]]);
      p.fill(0x2b2d31).poly([[44, 118], [66, 118], [70, 148], [40, 148]]); p.fill(0x3e4148).rect(46, 126, 18, 4);
    } else if (key === 'plasma') { // twin-prong plasma cannon
      p.fill(0xff4fd8, 0.25).circle(55, 18, 22); p.fill(0xff4fd8, 0.7).circle(55, 18, 12); p.fill(0xffffff).circle(55, 18, 6);
      p.fill(0x8e9aa8).rrect(26, 8, 14, 56, 6).rrect(70, 8, 14, 56, 6); p.fill(0xff4fd8).rect(30, 20, 6, 30).rect(74, 20, 6, 30);
      p.fill(0x2b2f45).rrect(20, 50, 70, 70, 18); p.fill(0x3d4262).rrect(26, 56, 58, 58, 14);
      p.fill(0xff4fd8, 0.4).circle(55, 85, 20); p.fill(0xff4fd8).circle(55, 85, 13); p.fill(0xffd6f5).circle(55, 85, 6);
      p.fill(0xeef3f8).rrect(36, 116, 38, 22, 8); p.fill(0x7a5cff).rrect(40, 134, 30, 14, 6);
      p.fill(0x29f0ff).rect(22, 74, 4, 22).rect(84, 74, 4, 22);
    } else if (key === 'stone') { p.fill(0x7a4a24).rrect(63, 30, 8, 48, 3); p.fill(0x6a3d1c).circle(67, 30, 10); }
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
    if (key === 'rock') { // a hand gripping a rock
      p.fill(0xc98a5a).rrect(40, 86, 30, 64, 12); p.fill(0xa86f45).rect(40, 120, 30, 4);
      p.fill(0x6e6a64).poly([[30, 52], [40, 26], [62, 18], [82, 32], [84, 58], [68, 76], [42, 74]]);
      p.fill(0x9a958e).poly([[36, 50], [44, 30], [62, 24], [76, 34], [78, 54], [66, 68], [46, 68]]);
      p.fill(0xc4c0b9).circle(52, 36, 5); p.fill(0x7f7a73).circle(68, 52, 4);
      p.fill(0xd99a6a).rrect(32, 66, 48, 26, 12);
      p.fill(0xb5784c); for (let i = 0; i < 3; i++) p.rect(43 + i * 12, 68, 2, 18);
      p.fill(0xd99a6a).rrect(24, 54, 14, 30, 7);
    } else if (key === 'javelin') { // a plain hand-thrown javelin
      p.fill(0x9b6a35).rrect(51, 22, 8, 128, 4); p.fill(0xb98447).rect(53, 22, 2, 128);
      p.fill(0x8a5a2b).poly([[55, 0], [64, 16], [60, 32], [50, 32], [46, 16]]); p.fill(0xcd7f32).poly([[55, 3], [61, 16], [58, 29], [52, 29], [49, 16]]);
      p.fill(0xe7a95b).tri(55, 5, 52, 16, 55, 27);
      p.fill(0x5a3a1a).rrect(48, 92, 14, 26, 4); p.fill(0x7a4a24).rect(48, 98, 14, 3).rect(48, 106, 14, 3);
      p.fill(0xc0392b).rect(49, 34, 12, 4);
    } else if (key === 'repeater') { // repeating crossbow with a bolt magazine on top
      p.fill(0x7a4a24).rrect(46, 40, 18, 108, 6); p.fill(0x5a3a1a).rrect(44, 116, 22, 32, 6);
      p.line(10, 0x4a2c12).spoly([[4, 70], [22, 52], [55, 44], [88, 52], [106, 70]]);
      p.line(5, 0x8b5a2b).spoly([[6, 68], [22, 53], [55, 46], [88, 53], [104, 68]]);
      p.line(2, 0xeeeeee).seg(6, 70, 55, 88).seg(104, 70, 55, 88);
      p.fill(0x6b4423).rrect(40, 0, 30, 66, 5); p.fill(0x8b5a2b).rrect(43, 4, 24, 58, 4);
      for (let i = 0; i < 5; i++) { p.fill(0xd9dee3).tri(47 + i * 4, 6, 45 + i * 4, 12, 49 + i * 4, 12); p.fill(0x3a2a1a).rect(46 + i * 4, 12, 2, 40); }
      p.fill(0x2c6fbf).rect(43, 50, 24, 5);
      p.line(5, 0x9aa4ad).seg(70, 30, 92, 96); p.fill(0x5a3a1a).circle(92, 98, 6);
    } else if (key === 'musket') { // long flintlock musket
      p.fill(0x6b4423).poly([[46, 70], [64, 70], [72, 148], [38, 148]]); p.fill(0x8b5a2b).poly([[49, 74], [61, 74], [66, 144], [44, 144]]);
      p.fill(0x50565e).rrect(50, 0, 10, 100, 4); p.fill(0x7d848d).rect(52, 2, 3, 96);
      p.fill(0x22252b).ellipse(55, 2, 10, 4);
      p.fill(0xd4a017).rect(48, 30, 14, 4).rect(48, 64, 14, 4).rect(46, 118, 18, 4);
      p.fill(0x3a3d43).rrect(62, 84, 12, 14, 3); p.fill(0x22252b).poly([[66, 84], [76, 74], [80, 78], [72, 88]]);
      p.line(2, 0x3a2a1a).seg(46, 20, 46, 70);
    } else if (key === 'rifle') { // assault rifle with a scope
      p.fill(0x1f2125).rrect(51, 0, 8, 46, 3); p.fill(0x111214).rect(49, 0, 12, 6);
      p.fill(0x3a3d43).rrect(44, 40, 22, 40, 5); for (let i = 0; i < 3; i++) p.fill(0x22252b).rect(47, 46 + i * 11, 16, 5);
      p.fill(0x2b2d31).rrect(40, 78, 30, 40, 6);
      p.fill(0x111214).rrect(25, 58, 14, 48, 6); p.fill(0x29a8ff, 0.8).circle(32, 60, 4); p.fill(0x29a8ff, 0.5).circle(32, 104, 4);
      p.fill(0x3e4148).poly([[70, 84], [86, 90], [84, 116], [70, 112]]);
      p.fill(0x2b2d31).poly([[44, 118], [66, 118], [70, 148], [40, 148]]); p.fill(0x3e4148).rect(46, 126, 18, 4);
    } else if (key === 'plasma') { // twin-prong plasma cannon
      p.fill(0xff4fd8, 0.25).circle(55, 18, 22); p.fill(0xff4fd8, 0.7).circle(55, 18, 12); p.fill(0xffffff).circle(55, 18, 6);
      p.fill(0x8e9aa8).rrect(26, 8, 14, 56, 6).rrect(70, 8, 14, 56, 6); p.fill(0xff4fd8).rect(30, 20, 6, 30).rect(74, 20, 6, 30);
      p.fill(0x2b2f45).rrect(20, 50, 70, 70, 18); p.fill(0x3d4262).rrect(26, 56, 58, 58, 14);
      p.fill(0xff4fd8, 0.4).circle(55, 85, 20); p.fill(0xff4fd8).circle(55, 85, 13); p.fill(0xffd6f5).circle(55, 85, 6);
      p.fill(0xeef3f8).rrect(36, 116, 38, 22, 8); p.fill(0x7a5cff).rrect(40, 134, 30, 14, 6);
      p.fill(0x29f0ff).rect(22, 74, 4, 22).rect(84, 74, 4, 22);
    } else if (key === 'stone') { p.fill(0x6a3d1c).circle(30, 56, 4).circle(48, 66, 5).circle(40, 50, 3); p.fill(skin).tri(18, 42, 34, 42, 18, 58); }
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
      if (key === 'rock') { // a hand gripping a rock
      p.fill(0xc98a5a).rrect(40, 86, 30, 64, 12); p.fill(0xa86f45).rect(40, 120, 30, 4);
      p.fill(0x6e6a64).poly([[30, 52], [40, 26], [62, 18], [82, 32], [84, 58], [68, 76], [42, 74]]);
      p.fill(0x9a958e).poly([[36, 50], [44, 30], [62, 24], [76, 34], [78, 54], [66, 68], [46, 68]]);
      p.fill(0xc4c0b9).circle(52, 36, 5); p.fill(0x7f7a73).circle(68, 52, 4);
      p.fill(0xd99a6a).rrect(32, 66, 48, 26, 12);
      p.fill(0xb5784c); for (let i = 0; i < 3; i++) p.rect(43 + i * 12, 68, 2, 18);
      p.fill(0xd99a6a).rrect(24, 54, 14, 30, 7);
    } else if (key === 'javelin') { // a plain hand-thrown javelin
      p.fill(0x9b6a35).rrect(51, 22, 8, 128, 4); p.fill(0xb98447).rect(53, 22, 2, 128);
      p.fill(0x8a5a2b).poly([[55, 0], [64, 16], [60, 32], [50, 32], [46, 16]]); p.fill(0xcd7f32).poly([[55, 3], [61, 16], [58, 29], [52, 29], [49, 16]]);
      p.fill(0xe7a95b).tri(55, 5, 52, 16, 55, 27);
      p.fill(0x5a3a1a).rrect(48, 92, 14, 26, 4); p.fill(0x7a4a24).rect(48, 98, 14, 3).rect(48, 106, 14, 3);
      p.fill(0xc0392b).rect(49, 34, 12, 4);
    } else if (key === 'repeater') { // repeating crossbow with a bolt magazine on top
      p.fill(0x7a4a24).rrect(46, 40, 18, 108, 6); p.fill(0x5a3a1a).rrect(44, 116, 22, 32, 6);
      p.line(10, 0x4a2c12).spoly([[4, 70], [22, 52], [55, 44], [88, 52], [106, 70]]);
      p.line(5, 0x8b5a2b).spoly([[6, 68], [22, 53], [55, 46], [88, 53], [104, 68]]);
      p.line(2, 0xeeeeee).seg(6, 70, 55, 88).seg(104, 70, 55, 88);
      p.fill(0x6b4423).rrect(40, 0, 30, 66, 5); p.fill(0x8b5a2b).rrect(43, 4, 24, 58, 4);
      for (let i = 0; i < 5; i++) { p.fill(0xd9dee3).tri(47 + i * 4, 6, 45 + i * 4, 12, 49 + i * 4, 12); p.fill(0x3a2a1a).rect(46 + i * 4, 12, 2, 40); }
      p.fill(0x2c6fbf).rect(43, 50, 24, 5);
      p.line(5, 0x9aa4ad).seg(70, 30, 92, 96); p.fill(0x5a3a1a).circle(92, 98, 6);
    } else if (key === 'musket') { // long flintlock musket
      p.fill(0x6b4423).poly([[46, 70], [64, 70], [72, 148], [38, 148]]); p.fill(0x8b5a2b).poly([[49, 74], [61, 74], [66, 144], [44, 144]]);
      p.fill(0x50565e).rrect(50, 0, 10, 100, 4); p.fill(0x7d848d).rect(52, 2, 3, 96);
      p.fill(0x22252b).ellipse(55, 2, 10, 4);
      p.fill(0xd4a017).rect(48, 30, 14, 4).rect(48, 64, 14, 4).rect(46, 118, 18, 4);
      p.fill(0x3a3d43).rrect(62, 84, 12, 14, 3); p.fill(0x22252b).poly([[66, 84], [76, 74], [80, 78], [72, 88]]);
      p.line(2, 0x3a2a1a).seg(46, 20, 46, 70);
    } else if (key === 'rifle') { // assault rifle with a scope
      p.fill(0x1f2125).rrect(51, 0, 8, 46, 3); p.fill(0x111214).rect(49, 0, 12, 6);
      p.fill(0x3a3d43).rrect(44, 40, 22, 40, 5); for (let i = 0; i < 3; i++) p.fill(0x22252b).rect(47, 46 + i * 11, 16, 5);
      p.fill(0x2b2d31).rrect(40, 78, 30, 40, 6);
      p.fill(0x111214).rrect(25, 58, 14, 48, 6); p.fill(0x29a8ff, 0.8).circle(32, 60, 4); p.fill(0x29a8ff, 0.5).circle(32, 104, 4);
      p.fill(0x3e4148).poly([[70, 84], [86, 90], [84, 116], [70, 112]]);
      p.fill(0x2b2d31).poly([[44, 118], [66, 118], [70, 148], [40, 148]]); p.fill(0x3e4148).rect(46, 126, 18, 4);
    } else if (key === 'plasma') { // twin-prong plasma cannon
      p.fill(0xff4fd8, 0.25).circle(55, 18, 22); p.fill(0xff4fd8, 0.7).circle(55, 18, 12); p.fill(0xffffff).circle(55, 18, 6);
      p.fill(0x8e9aa8).rrect(26, 8, 14, 56, 6).rrect(70, 8, 14, 56, 6); p.fill(0xff4fd8).rect(30, 20, 6, 30).rect(74, 20, 6, 30);
      p.fill(0x2b2f45).rrect(20, 50, 70, 70, 18); p.fill(0x3d4262).rrect(26, 56, 58, 58, 14);
      p.fill(0xff4fd8, 0.4).circle(55, 85, 20); p.fill(0xff4fd8).circle(55, 85, 13); p.fill(0xffd6f5).circle(55, 85, 6);
      p.fill(0xeef3f8).rrect(36, 116, 38, 22, 8); p.fill(0x7a5cff).rrect(40, 134, 30, 14, 6);
      p.fill(0x29f0ff).rect(22, 74, 4, 22).rect(84, 74, 4, 22);
    } else if (key === 'stone') { p.fill(0x4a2c12).ellipse(40, 14, 38, 16).circle(25, 20, 6).circle(55, 20, 6).circle(32, 9, 6).circle(48, 9, 6); p.fill(0x4a2c12).ellipse(40, 41, 22, 8); }
      if (key === 'bronze') { p.fill(0xcd7f32).rrect(22, 8, 36, 16, { tl: 16, tr: 16, bl: 2, br: 2 }); p.fill(0xc0392b).rrect(36, 0, 8, 12, 3); p.fill(0xa86424).rect(22, 21, 36, 3); }
      if (key === 'gunpowder') { p.fill(0x1b1b1b).tri(16, 16, 64, 16, 40, 2); p.fill(0x1b1b1b).rrect(24, 8, 32, 10, 4); p.fill(0xf1c40f).circle(40, 12, 2.5); }
      if (key === 'modern') { p.fill(0x4a5530).rrect(21, 8, 38, 16, { tl: 17, tr: 17, bl: 3, br: 3 }); p.fill(0x111111).rrect(27, 24, 26, 7, 3); }
    }
  });
}

// ---------- blocks (90 x 80 logical) ----------
function block(scene, key) {
  make(scene, 'block_' + key, 90, 80, (p) => {
    if (key === 'rock') { // a hand gripping a rock
      p.fill(0xc98a5a).rrect(40, 86, 30, 64, 12); p.fill(0xa86f45).rect(40, 120, 30, 4);
      p.fill(0x6e6a64).poly([[30, 52], [40, 26], [62, 18], [82, 32], [84, 58], [68, 76], [42, 74]]);
      p.fill(0x9a958e).poly([[36, 50], [44, 30], [62, 24], [76, 34], [78, 54], [66, 68], [46, 68]]);
      p.fill(0xc4c0b9).circle(52, 36, 5); p.fill(0x7f7a73).circle(68, 52, 4);
      p.fill(0xd99a6a).rrect(32, 66, 48, 26, 12);
      p.fill(0xb5784c); for (let i = 0; i < 3; i++) p.rect(43 + i * 12, 68, 2, 18);
      p.fill(0xd99a6a).rrect(24, 54, 14, 30, 7);
    } else if (key === 'javelin') { // a plain hand-thrown javelin
      p.fill(0x9b6a35).rrect(51, 22, 8, 128, 4); p.fill(0xb98447).rect(53, 22, 2, 128);
      p.fill(0x8a5a2b).poly([[55, 0], [64, 16], [60, 32], [50, 32], [46, 16]]); p.fill(0xcd7f32).poly([[55, 3], [61, 16], [58, 29], [52, 29], [49, 16]]);
      p.fill(0xe7a95b).tri(55, 5, 52, 16, 55, 27);
      p.fill(0x5a3a1a).rrect(48, 92, 14, 26, 4); p.fill(0x7a4a24).rect(48, 98, 14, 3).rect(48, 106, 14, 3);
      p.fill(0xc0392b).rect(49, 34, 12, 4);
    } else if (key === 'repeater') { // repeating crossbow with a bolt magazine on top
      p.fill(0x7a4a24).rrect(46, 40, 18, 108, 6); p.fill(0x5a3a1a).rrect(44, 116, 22, 32, 6);
      p.line(10, 0x4a2c12).spoly([[4, 70], [22, 52], [55, 44], [88, 52], [106, 70]]);
      p.line(5, 0x8b5a2b).spoly([[6, 68], [22, 53], [55, 46], [88, 53], [104, 68]]);
      p.line(2, 0xeeeeee).seg(6, 70, 55, 88).seg(104, 70, 55, 88);
      p.fill(0x6b4423).rrect(40, 0, 30, 66, 5); p.fill(0x8b5a2b).rrect(43, 4, 24, 58, 4);
      for (let i = 0; i < 5; i++) { p.fill(0xd9dee3).tri(47 + i * 4, 6, 45 + i * 4, 12, 49 + i * 4, 12); p.fill(0x3a2a1a).rect(46 + i * 4, 12, 2, 40); }
      p.fill(0x2c6fbf).rect(43, 50, 24, 5);
      p.line(5, 0x9aa4ad).seg(70, 30, 92, 96); p.fill(0x5a3a1a).circle(92, 98, 6);
    } else if (key === 'musket') { // long flintlock musket
      p.fill(0x6b4423).poly([[46, 70], [64, 70], [72, 148], [38, 148]]); p.fill(0x8b5a2b).poly([[49, 74], [61, 74], [66, 144], [44, 144]]);
      p.fill(0x50565e).rrect(50, 0, 10, 100, 4); p.fill(0x7d848d).rect(52, 2, 3, 96);
      p.fill(0x22252b).ellipse(55, 2, 10, 4);
      p.fill(0xd4a017).rect(48, 30, 14, 4).rect(48, 64, 14, 4).rect(46, 118, 18, 4);
      p.fill(0x3a3d43).rrect(62, 84, 12, 14, 3); p.fill(0x22252b).poly([[66, 84], [76, 74], [80, 78], [72, 88]]);
      p.line(2, 0x3a2a1a).seg(46, 20, 46, 70);
    } else if (key === 'rifle') { // assault rifle with a scope
      p.fill(0x1f2125).rrect(51, 0, 8, 46, 3); p.fill(0x111214).rect(49, 0, 12, 6);
      p.fill(0x3a3d43).rrect(44, 40, 22, 40, 5); for (let i = 0; i < 3; i++) p.fill(0x22252b).rect(47, 46 + i * 11, 16, 5);
      p.fill(0x2b2d31).rrect(40, 78, 30, 40, 6);
      p.fill(0x111214).rrect(25, 58, 14, 48, 6); p.fill(0x29a8ff, 0.8).circle(32, 60, 4); p.fill(0x29a8ff, 0.5).circle(32, 104, 4);
      p.fill(0x3e4148).poly([[70, 84], [86, 90], [84, 116], [70, 112]]);
      p.fill(0x2b2d31).poly([[44, 118], [66, 118], [70, 148], [40, 148]]); p.fill(0x3e4148).rect(46, 126, 18, 4);
    } else if (key === 'plasma') { // twin-prong plasma cannon
      p.fill(0xff4fd8, 0.25).circle(55, 18, 22); p.fill(0xff4fd8, 0.7).circle(55, 18, 12); p.fill(0xffffff).circle(55, 18, 6);
      p.fill(0x8e9aa8).rrect(26, 8, 14, 56, 6).rrect(70, 8, 14, 56, 6); p.fill(0xff4fd8).rect(30, 20, 6, 30).rect(74, 20, 6, 30);
      p.fill(0x2b2f45).rrect(20, 50, 70, 70, 18); p.fill(0x3d4262).rrect(26, 56, 58, 58, 14);
      p.fill(0xff4fd8, 0.4).circle(55, 85, 20); p.fill(0xff4fd8).circle(55, 85, 13); p.fill(0xffd6f5).circle(55, 85, 6);
      p.fill(0xeef3f8).rrect(36, 116, 38, 22, 8); p.fill(0x7a5cff).rrect(40, 134, 30, 14, 6);
      p.fill(0x29f0ff).rect(22, 74, 4, 22).rect(84, 74, 4, 22);
    } else if (key === 'stone') {
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
    if (key === 'rock') { // a hand gripping a rock
      p.fill(0xc98a5a).rrect(40, 86, 30, 64, 12); p.fill(0xa86f45).rect(40, 120, 30, 4);
      p.fill(0x6e6a64).poly([[30, 52], [40, 26], [62, 18], [82, 32], [84, 58], [68, 76], [42, 74]]);
      p.fill(0x9a958e).poly([[36, 50], [44, 30], [62, 24], [76, 34], [78, 54], [66, 68], [46, 68]]);
      p.fill(0xc4c0b9).circle(52, 36, 5); p.fill(0x7f7a73).circle(68, 52, 4);
      p.fill(0xd99a6a).rrect(32, 66, 48, 26, 12);
      p.fill(0xb5784c); for (let i = 0; i < 3; i++) p.rect(43 + i * 12, 68, 2, 18);
      p.fill(0xd99a6a).rrect(24, 54, 14, 30, 7);
    } else if (key === 'javelin') { // a plain hand-thrown javelin
      p.fill(0x9b6a35).rrect(51, 22, 8, 128, 4); p.fill(0xb98447).rect(53, 22, 2, 128);
      p.fill(0x8a5a2b).poly([[55, 0], [64, 16], [60, 32], [50, 32], [46, 16]]); p.fill(0xcd7f32).poly([[55, 3], [61, 16], [58, 29], [52, 29], [49, 16]]);
      p.fill(0xe7a95b).tri(55, 5, 52, 16, 55, 27);
      p.fill(0x5a3a1a).rrect(48, 92, 14, 26, 4); p.fill(0x7a4a24).rect(48, 98, 14, 3).rect(48, 106, 14, 3);
      p.fill(0xc0392b).rect(49, 34, 12, 4);
    } else if (key === 'repeater') { // repeating crossbow with a bolt magazine on top
      p.fill(0x7a4a24).rrect(46, 40, 18, 108, 6); p.fill(0x5a3a1a).rrect(44, 116, 22, 32, 6);
      p.line(10, 0x4a2c12).spoly([[4, 70], [22, 52], [55, 44], [88, 52], [106, 70]]);
      p.line(5, 0x8b5a2b).spoly([[6, 68], [22, 53], [55, 46], [88, 53], [104, 68]]);
      p.line(2, 0xeeeeee).seg(6, 70, 55, 88).seg(104, 70, 55, 88);
      p.fill(0x6b4423).rrect(40, 0, 30, 66, 5); p.fill(0x8b5a2b).rrect(43, 4, 24, 58, 4);
      for (let i = 0; i < 5; i++) { p.fill(0xd9dee3).tri(47 + i * 4, 6, 45 + i * 4, 12, 49 + i * 4, 12); p.fill(0x3a2a1a).rect(46 + i * 4, 12, 2, 40); }
      p.fill(0x2c6fbf).rect(43, 50, 24, 5);
      p.line(5, 0x9aa4ad).seg(70, 30, 92, 96); p.fill(0x5a3a1a).circle(92, 98, 6);
    } else if (key === 'musket') { // long flintlock musket
      p.fill(0x6b4423).poly([[46, 70], [64, 70], [72, 148], [38, 148]]); p.fill(0x8b5a2b).poly([[49, 74], [61, 74], [66, 144], [44, 144]]);
      p.fill(0x50565e).rrect(50, 0, 10, 100, 4); p.fill(0x7d848d).rect(52, 2, 3, 96);
      p.fill(0x22252b).ellipse(55, 2, 10, 4);
      p.fill(0xd4a017).rect(48, 30, 14, 4).rect(48, 64, 14, 4).rect(46, 118, 18, 4);
      p.fill(0x3a3d43).rrect(62, 84, 12, 14, 3); p.fill(0x22252b).poly([[66, 84], [76, 74], [80, 78], [72, 88]]);
      p.line(2, 0x3a2a1a).seg(46, 20, 46, 70);
    } else if (key === 'rifle') { // assault rifle with a scope
      p.fill(0x1f2125).rrect(51, 0, 8, 46, 3); p.fill(0x111214).rect(49, 0, 12, 6);
      p.fill(0x3a3d43).rrect(44, 40, 22, 40, 5); for (let i = 0; i < 3; i++) p.fill(0x22252b).rect(47, 46 + i * 11, 16, 5);
      p.fill(0x2b2d31).rrect(40, 78, 30, 40, 6);
      p.fill(0x111214).rrect(25, 58, 14, 48, 6); p.fill(0x29a8ff, 0.8).circle(32, 60, 4); p.fill(0x29a8ff, 0.5).circle(32, 104, 4);
      p.fill(0x3e4148).poly([[70, 84], [86, 90], [84, 116], [70, 112]]);
      p.fill(0x2b2d31).poly([[44, 118], [66, 118], [70, 148], [40, 148]]); p.fill(0x3e4148).rect(46, 126, 18, 4);
    } else if (key === 'plasma') { // twin-prong plasma cannon
      p.fill(0xff4fd8, 0.25).circle(55, 18, 22); p.fill(0xff4fd8, 0.7).circle(55, 18, 12); p.fill(0xffffff).circle(55, 18, 6);
      p.fill(0x8e9aa8).rrect(26, 8, 14, 56, 6).rrect(70, 8, 14, 56, 6); p.fill(0xff4fd8).rect(30, 20, 6, 30).rect(74, 20, 6, 30);
      p.fill(0x2b2f45).rrect(20, 50, 70, 70, 18); p.fill(0x3d4262).rrect(26, 56, 58, 58, 14);
      p.fill(0xff4fd8, 0.4).circle(55, 85, 20); p.fill(0xff4fd8).circle(55, 85, 13); p.fill(0xffd6f5).circle(55, 85, 6);
      p.fill(0xeef3f8).rrect(36, 116, 38, 22, 8); p.fill(0x7a5cff).rrect(40, 134, 30, 14, 6);
      p.fill(0x29f0ff).rect(22, 74, 4, 22).rect(84, 74, 4, 22);
    } else if (key === 'stone') {
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
  make(scene, 'p_pebble', 22, 22, (p) => { p.fill(0x5c5852).poly([[3, 8], [9, 1], [18, 3], [21, 12], [15, 21], [5, 19]]); p.fill(0x8d8a85).poly([[5, 9], [10, 4], [17, 5], [18, 12], [14, 18], [7, 16]]); p.fill(0xb5b1aa).circle(9, 8, 2.5); });
  make(scene, 'p_javelin', 10, 64, (p) => { p.fill(0x9b6a35).rect(4, 14, 3, 50); p.fill(0xcd7f32).poly([[5.5, 0], [9, 8], [7, 16], [4, 16], [2, 8]]); });
  make(scene, 'p_rbolt', 8, 30, (p) => { p.fill(0x3a2a1a).rect(3, 6, 2.5, 24); p.fill(0xd9dee3).tri(4, 0, 1, 8, 7, 8); p.fill(0x2c6fbf).tri(3, 23, 0, 30, 3, 29).tri(5, 23, 8, 30, 5, 29); });
  make(scene, 'p_musket', 16, 16, (p) => { p.fill(0xffffff, 0.35).circle(8, 8, 8); p.fill(0x6f747b).circle(8, 8, 4.5); p.fill(0xb0b5bb).circle(7, 7, 1.8); });
  make(scene, 'p_round', 8, 26, (p) => { p.fill(0xff9a2e, 0.4).rrect(0, 4, 8, 22, 4); p.fill(0xffd27a).rrect(2, 6, 4, 18, 2); p.fill(0xfff6cc).rrect(2.5, 6, 3, 6, 1.5); });
  make(scene, 'p_plasma', 30, 30, (p) => { p.fill(0xff4fd8, 0.3).circle(15, 15, 15); p.fill(0xff4fd8, 0.85).circle(15, 15, 10); p.fill(0xffd6f5).circle(15, 15, 5); });
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

// ---------- bosses (260 x 220 logical, facing the player, ground at bottom) ----------
function bosses(scene) {
  make(scene, 'boss_stone', 260, 220, (p) => { // woolly mammoth
    p.fill(0x4a2c17).rrect(40, 150, 36, 70, 14).rrect(184, 150, 36, 70, 14).rrect(80, 160, 30, 60, 12).rrect(150, 160, 30, 60, 12);
    p.fill(0x6b4226).ellipse(130, 110, 250, 170);
    p.fill(0x7d5030).ellipse(130, 92, 200, 120);
    for (let i = 0; i < 9; i++) p.fill(0x5a361d).tri(20 + i * 26, 150, 34 + i * 26, 182, 46 + i * 26, 150);
    p.fill(0x8a5a36).ellipse(130, 80, 120, 100); p.fill(0x5a361d).ellipse(130, 40, 90, 34);
    p.fill(0x6b4226).ellipse(66, 86, 54, 74).ellipse(194, 86, 54, 74); // ears
    p.line(16, 0xf4ecd8).spoly([[104, 112], [86, 150], [96, 186], [124, 196]]).spoly([[156, 112], [174, 150], [164, 186], [136, 196]]);
    p.fill(0x7d5030).rrect(116, 100, 28, 90, 14); p.fill(0x6b4226).rrect(118, 170, 24, 30, 10);
    p.fill(0xffffff).circle(108, 78, 9).circle(152, 78, 9); p.fill(0xd62f2f).circle(109, 79, 5).circle(151, 79, 5); p.fill(0x111111).circle(109, 79, 2.5).circle(151, 79, 2.5);
    p.line(5, 0x2b1a0e).seg(94, 64, 120, 72).seg(166, 64, 140, 72);
  });
  make(scene, 'boss_bronze', 260, 220, (p) => { // chariot champion
    const wheel = (x) => { p.fill(0x5a3a1a).circle(x, 170, 44); p.fill(0x8b5a2b).circle(x, 170, 36); p.line(5, 0x5a3a1a); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; p.seg(x, 170, x + Math.cos(a) * 36, 170 + Math.sin(a) * 36); } p.fill(0xcd7f32).circle(x, 170, 9); };
    wheel(40); wheel(220);
    p.fill(0xa86424).rrect(50, 120, 160, 80, 14); p.fill(0xcd7f32).rrect(58, 126, 144, 66, 10); p.fill(0xe7a95b).rect(58, 150, 144, 6);
    p.fill(0xb5452f).rrect(98, 58, 64, 70, 16); p.fill(0xf1c27d).circle(130, 42, 26);
    p.fill(0xcd7f32).rrect(102, 14, 56, 28, { tl: 26, tr: 26, bl: 4, br: 4 }); p.fill(0xc0392b).rrect(118, -2 + 4, 24, 22, 8);
    p.fill(0x111111).circle(120, 44, 4).circle(140, 44, 4); p.line(4, 0x2b1a10).seg(110, 34, 124, 38).seg(150, 34, 136, 38);
    p.fill(0x8a5a2b).rect(186, 0, 8, 130); p.fill(0xcd7f32).tri(190, 0, 180, 24, 200, 24);
    p.fill(0xcd7f32).circle(80, 104, 30); p.fill(0xa86424).circle(80, 104, 22); p.fill(0xe7a95b).circle(80, 104, 8);
    p.fill(0x7a4f2a).ellipse(130, 196, 70, 46); p.fill(0x8b5a36).ellipse(130, 182, 50, 50); p.fill(0xcd7f32).rrect(112, 160, 36, 16, 6);
    p.fill(0x111111).circle(118, 186, 4).circle(142, 186, 4);
  });
  make(scene, 'boss_medieval', 260, 220, (p) => { // castle dragon
    p.fill(0x1f6e3a).poly([[110, 90], [0, 20], [16, 70], [4, 110], [40, 120], [60, 160]]).poly([[150, 90], [260, 20], [244, 70], [256, 110], [220, 120], [200, 160]]);
    p.fill(0x2e9a52).poly([[110, 96], [20, 40], [34, 80], [60, 130]]).poly([[150, 96], [240, 40], [226, 80], [200, 130]]);
    p.fill(0x2e8b4a).ellipse(130, 150, 150, 130); p.fill(0xe8d27a).ellipse(130, 160, 80, 100);
    for (let i = 0; i < 5; i++) p.fill(0xcfb75e).rect(96, 126 + i * 16, 68, 3);
    p.fill(0x2e8b4a).rrect(40, 180, 40, 40, 12).rrect(180, 180, 40, 40, 12);
    p.fill(0x2e8b4a).ellipse(130, 62, 92, 80); p.fill(0x267a40).ellipse(130, 90, 70, 40);
    p.fill(0xf4ecd8).tri(96, 34, 84, 0, 106, 26).tri(164, 34, 176, 0, 154, 26);
    p.fill(0xffd23f).ellipse(110, 56, 20, 14).ellipse(150, 56, 20, 14); p.fill(0x111111).rect(108, 50, 4, 12).rect(148, 50, 4, 12);
    p.fill(0x7a1f1f).ellipse(130, 94, 46, 18); p.fill(0xff8a1f).ellipse(130, 96, 30, 10); p.fill(0xffffff).tri(114, 88, 118, 96, 122, 88).tri(138, 88, 142, 96, 146, 88);
  });
  make(scene, 'boss_gunpowder', 260, 220, (p) => { // pirate galleon (bow view)
    p.fill(0x5a3a1a).rect(126, 0, 8, 150); p.fill(0x5a3a1a).rect(60, 30, 140, 6);
    p.fill(0xf3ead2).poly([[66, 36], [194, 36], [186, 110], [74, 110]]); p.fill(0xe0d4b4).rect(74, 70, 112, 4);
    p.fill(0x222222).circle(130, 72, 16); p.fill(0xf3ead2).circle(124, 70, 4).circle(136, 70, 4); p.line(4, 0x222222).seg(114, 92, 146, 100).seg(146, 92, 114, 100);
    p.fill(0x111111).poly([[134, 0], [160, 6], [134, 14]]);
    p.fill(0x6b4423).poly([[10, 120], [250, 120], [210, 210], [50, 210]]); p.fill(0x8b5a2b).poly([[24, 128], [236, 128], [204, 200], [56, 200]]);
    p.fill(0x5a3a1a).rect(24, 150, 212, 6).rect(40, 178, 180, 5);
    for (let i = 0; i < 4; i++) { p.fill(0x111111).circle(60 + i * 47, 166, 9); p.fill(0x3a3a3a).circle(60 + i * 47, 166, 5); }
    p.fill(0xf0b429).rect(10, 118, 240, 5);
    p.fill(0x2b6ea8, 0.85).ellipse(130, 214, 260, 20); p.fill(0xffffff, 0.6).ellipse(70, 210, 50, 8).ellipse(190, 210, 50, 8);
  });
  make(scene, 'boss_modern', 260, 220, (p) => { // battle tank (front view)
    p.fill(0x2b2b2b).rrect(0, 130, 64, 90, 10).rrect(196, 130, 64, 90, 10);
    for (let i = 0; i < 5; i++) { p.fill(0x444444).rect(4, 136 + i * 17, 56, 7); p.fill(0x444444).rect(200, 136 + i * 17, 56, 7); }
    p.fill(0x556b2f).poly([[40, 110], [220, 110], [236, 200], [24, 200]]); p.fill(0x6b8237).poly([[54, 116], [206, 116], [214, 150], [46, 150]]);
    p.fill(0x3e4a24).rect(30, 186, 200, 10); p.fill(0xffd84d).circle(70, 170, 9).circle(190, 170, 9);
    p.fill(0x4a5a28).rrect(70, 50, 120, 70, 24); p.fill(0x5d6b3a).rrect(80, 56, 100, 40, 18);
    p.fill(0x2b2b2b).circle(130, 92, 22); p.fill(0x111111).circle(130, 92, 13); p.fill(0x3a3a3a).rrect(96, 40, 30, 16, 6);
    p.fill(0xffffff).poly([[130, 128], [135, 140], [148, 140], [138, 148], [142, 160], [130, 152], [118, 160], [122, 148], [112, 140], [125, 140]]);
    p.fill(0x222222).rect(170, 20, 4, 36); p.fill(0xc0392b).rect(174, 20, 18, 10);
  });
  make(scene, 'boss_future', 260, 220, (p) => { // mega robot
    p.fill(0x4b5670).rrect(70, 160, 44, 60, 10).rrect(146, 160, 44, 60, 10); p.fill(0x29f0ff).rect(76, 196, 32, 4).rect(152, 196, 32, 4);
    p.fill(0x6c7a96).rrect(14, 70, 44, 110, 18).rrect(202, 70, 44, 110, 18);
    p.fill(0x9aa6c0).rrect(0, 56, 70, 40, 14).rrect(190, 56, 70, 40, 14);
    p.fill(0x29f0ff).circle(36, 172, 14).circle(224, 172, 14); p.fill(0xffffff).circle(36, 172, 6).circle(224, 172, 6);
    p.fill(0x7d8aa8).rrect(56, 60, 148, 116, 22); p.fill(0x5a6b8c).rrect(70, 74, 120, 88, 16);
    p.fill(0x29f0ff, 0.35).circle(130, 118, 30); p.fill(0x29f0ff).circle(130, 118, 18); p.fill(0xffffff).circle(130, 118, 8);
    p.fill(0x9aa6c0).rrect(94, 4, 72, 60, 14); p.fill(0x111a2e).rrect(100, 18, 60, 22, 8); p.fill(0xff3b5c).rrect(104, 23, 52, 12, 6);
    p.fill(0x9aa6c0).rect(126, -2 + 2, 8, 6);
    p.fill(0x3a4560).rrect(10, 40, 30, 20, 6).rrect(220, 40, 30, 20, 6); p.fill(0xff4fd8).circle(25, 44, 5).circle(235, 44, 5);
  });
  // boss projectiles
  make(scene, 'bp_rock', 40, 40, (p) => { p.fill(0x5c5852).circle(20, 20, 19); p.fill(0x8d8a85).circle(18, 18, 15); p.fill(0xb5b1aa).circle(13, 13, 5); });
  make(scene, 'bp_spear', 16, 70, (p) => { p.fill(0x8a5a2b).rect(6, 16, 4, 54); p.fill(0xcd7f32).tri(8, 0, 0, 20, 16, 20); });
  make(scene, 'bp_fire', 44, 44, (p) => { p.fill(0xff4a1f, 0.5).circle(22, 22, 22); p.fill(0xff8a1f).circle(22, 22, 15); p.fill(0xffe14d).circle(22, 22, 8); });
  make(scene, 'bp_ball', 40, 40, (p) => { p.fill(0xff9a2e, 0.4).circle(20, 20, 20); p.fill(0x1b1d22).circle(20, 20, 15); p.fill(0x5a606a).circle(15, 15, 5); });
  make(scene, 'bp_shell', 26, 50, (p) => { p.fill(0xff9a2e, 0.4).ellipse(13, 30, 26, 40); p.fill(0x6b7340).rrect(5, 6, 16, 40, 8); p.fill(0xd4a017).rect(5, 36, 16, 6); p.fill(0x3e4a24).tri(13, 0, 5, 12, 21, 12); });
  make(scene, 'bp_plasma', 44, 44, (p) => { p.fill(0xff4fd8, 0.35).circle(22, 22, 22); p.fill(0xff4fd8).circle(22, 22, 13); p.fill(0xffffff).circle(22, 22, 6); });
}

// checkpoint arch, power-up icons (48x48) and power-up sprites
function powerupArt(scene) {
  make(scene, 'checkpoint', 520, 380, (p) => {
    const cols = [0xd9dde3, 0x4cd964, 0x3a8dff, 0xb052ff, 0xffc21a];
    p.fill(0x2b2f45).rrect(8, 60, 46, 320, 12).rrect(466, 60, 46, 320, 12);
    cols.forEach((c, i) => { p.fill(c).rect(14, 330 - i * 52, 34, 40).rect(472, 330 - i * 52, 34, 40); });
    p.fill(0x1b1f2e).rrect(0, 0, 520, 92, 22); p.line(6, 0xffc21a).srrect(3, 3, 514, 86, 20);
    cols.forEach((c, i) => p.fill(c).rect(40 + i * 88, 72, 88, 8));
    p.fill(0xffffff, 0.12).rect(54, 92, 412, 288);
  });
  const I = (key, draw) => make(scene, key, 48, 48, draw);
  const sword = (p, c) => { p.fill(c).poly([[34, 4], [44, 4], [44, 14], [18, 40], [8, 30]]); p.fill(0x8b5a2b).rrect(4, 34, 12, 10, 3); p.fill(0xf0b429).poly([[6, 26], [22, 42], [18, 46], [2, 30]]); };
  const bolt = (p, c) => p.fill(c).poly([[28, 2], [8, 28], [22, 28], [16, 46], [40, 18], [26, 18]]);
  I('pu_dmg', (p) => sword(p, 0xe9edf2));
  I('pu_rate', (p) => bolt(p, 0xe9edf2));
  I('pu_heal', (p) => { p.fill(0xff3b5c).circle(15, 17, 12).circle(33, 17, 12).tri(4, 22, 44, 22, 24, 44); p.fill(0xffffff).rect(21, 12, 6, 20).rect(14, 19, 20, 6); });
  I('pu_dmg2', (p) => { sword(p, 0x7dff9a); p.fill(0x4cd964).tri(38, 26, 46, 38, 30, 38); });
  I('pu_rate2', (p) => { bolt(p, 0x7dff9a); p.fill(0x4cd964).tri(38, 30, 46, 42, 30, 42); });
  I('pu_shot', (p) => { p.fill(0x4cd964); [10, 24, 38].forEach((x) => p.rrect(x - 4, 10, 8, 26, 4)); p.fill(0xffffff).rect(18, 39, 12, 4).rect(22, 35, 4, 12); });
  I('pu_magnet', (p) => { p.line(10, 0xe5483d).spoly([[10, 6], [10, 26], [16, 36], [24, 40], [32, 36], [38, 26], [38, 6]]); p.fill(0xd9dde3).rect(5, 2, 10, 8).rect(33, 2, 10, 8); });
  I('pu_pierce', (p) => { p.fill(0x7ab8ff).poly([[4, 24], [32, 20], [32, 12], [46, 24], [32, 36], [32, 28], [4, 28]]); p.line(3, 0xffffff).seg(18, 8, 18, 40); });
  I('pu_shield', (p) => { p.fill(0x3a8dff).poly([[24, 2], [44, 10], [40, 32], [24, 46], [8, 32], [4, 10]]); p.fill(0x9fd0ff).poly([[24, 8], [38, 14], [35, 30], [24, 40]]); });
  I('pu_big', (p) => { p.fill(0x3a8dff, 0.4).circle(24, 24, 22); p.fill(0x7ab8ff).circle(24, 24, 15); p.fill(0xffffff).circle(19, 19, 5); });
  I('pu_chain', (p) => { p.fill(0xd29bff).poly([[30, 2], [10, 26], [22, 26], [14, 46], [40, 18], [27, 18], [36, 2]]); p.fill(0xffffff).circle(10, 26, 3).circle(40, 18, 3); });
  I('pu_blades', (p) => { p.fill(0xb052ff).circle(24, 24, 7); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; p.fill(0xe9edf2).tri(24 + Math.cos(a) * 6, 24 + Math.sin(a) * 6, 24 + Math.cos(a + 0.9) * 22, 24 + Math.sin(a + 0.9) * 22, 24 + Math.cos(a + 1.4) * 8, 24 + Math.sin(a + 1.4) * 8); } });
  I('pu_boom', (p) => { const pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 : 22; const a = (i * Math.PI) / 8; pts.push([24 + Math.cos(a) * r, 24 + Math.sin(a) * r]); } p.fill(0xff7a1f).poly(pts); p.fill(0xffe14d).circle(24, 24, 8); });
  I('pu_double', (p) => { p.fill(0xffc21a).rrect(8, 8, 10, 30, 5).rrect(30, 8, 10, 30, 5); p.fill(0xfff1a8).rrect(10, 10, 4, 12, 2).rrect(32, 10, 4, 12, 2); p.fill(0xffffff).tri(13, 0, 6, 10, 20, 10).tri(35, 0, 28, 10, 42, 10); });
  I('pu_nova', (p) => { p.line(5, 0xffc21a).scircle(24, 24, 20); p.line(3, 0xfff1a8).scircle(24, 24, 12); p.fill(0xffffff).circle(24, 24, 5); });
  I('pu_drone', (p) => { p.fill(0x8e9aa8).rrect(12, 18, 24, 14, 6); p.fill(0xffc21a).circle(24, 25, 4); p.line(3, 0x8e9aa8).seg(12, 20, 4, 12).seg(36, 20, 44, 12); p.fill(0x29f0ff).ellipse(4, 12, 12, 4).ellipse(44, 12, 12, 4); p.fill(0xffc21a).rect(22, 32, 4, 10); });
  make(scene, 'blade', 64, 64, (p) => {
    p.fill(0x6b2a9a).circle(32, 32, 9);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; p.fill(0xe9edf2).tri(32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8, 32 + Math.cos(a + 0.9) * 31, 32 + Math.sin(a + 0.9) * 31, 32 + Math.cos(a + 1.5) * 10, 32 + Math.sin(a + 1.5) * 10); }
    p.fill(0xd29bff).circle(32, 32, 5);
  });
  make(scene, 'drone', 90, 60, (p) => {
    p.fill(0x29f0ff, 0.5).ellipse(16, 12, 30, 8).ellipse(74, 12, 30, 8);
    p.line(4, 0x5a6270).seg(24, 26, 16, 12).seg(66, 26, 74, 12);
    p.fill(0x5a6270).rrect(20, 20, 50, 26, 12); p.fill(0x8e9aa8).rrect(24, 22, 42, 16, 8);
    p.fill(0xffc21a).circle(45, 33, 7); p.fill(0xffffff).circle(43, 31, 2.5); p.fill(0x3a3d43).rect(41, 44, 8, 14);
  });
  make(scene, 'p_drone', 12, 30, (p) => { p.fill(0xffc21a, 0.4).rrect(0, 0, 12, 30, 6); p.fill(0xffe14d).rrect(3, 2, 6, 26, 3); p.fill(0xffffff).rrect(4.5, 3, 3, 10, 1.5); });
  make(scene, 'bubble', 200, 200, (p) => { p.fill(0x7fe8ff, 0.25).circle(100, 100, 98); p.line(6, 0xbff6ff, 0.9).scircle(100, 100, 94); p.fill(0xffffff, 0.5).ellipse(66, 56, 40, 20); });
}

// gem crates (one look per era), weapon add-ons for power-ups, Twin Weapon icon
function crateArt(scene) {
  const W = 130, H = 112;
  const gem = (p, cx, cy, r) => { p.fill(0x29d8ff).poly([[cx, cy - r], [cx + r * 0.8, cy - r * 0.2], [cx, cy + r], [cx - r * 0.8, cy - r * 0.2]]); p.fill(0xbff6ff).poly([[cx, cy - r], [cx + r * 0.35, cy - r * 0.2], [cx, cy + r * 0.2], [cx - r * 0.35, cy - r * 0.2]]); };
  const C = (key, draw) => make(scene, 'crate_' + key, W, H, (p) => { draw(p); gem(p, W / 2, H / 2 + 4, 20); });
  C('stone', (p) => { p.fill(0x6f6a62).rrect(4, 12, 122, 98, 18); p.fill(0x8d877c).rrect(10, 16, 110, 40, 14); p.fill(0x5a8a3a).ellipse(30, 16, 40, 14).ellipse(96, 104, 30, 10); p.fill(0x4e4a44).rect(18, 70, 20, 6).rect(90, 40, 22, 6); });
  C('bronze', (p) => { p.fill(0x8a5a22).rrect(4, 20, 122, 90, 10); p.fill(0xc98b36).rrect(0, 8, 130, 26, { tl: 14, tr: 14, bl: 4, br: 4 }); p.fill(0xe0b04a).rect(8, 30, 114, 6).rect(8, 96, 114, 6); [16, 114].forEach((x) => p.fill(0xe0b04a).circle(x, 64, 7)); });
  C('medieval', (p) => { p.fill(0x7a4a24).rrect(4, 18, 122, 92, 8); p.fill(0x9c6232).rrect(0, 6, 130, 28, { tl: 16, tr: 16, bl: 2, br: 2 }); p.fill(0x3c3f46).rect(20, 6, 12, 104).rect(98, 6, 12, 104); p.fill(0xd0a33c).rrect(56, 26, 18, 16, 4); });
  C('gunpowder', (p) => { p.fill(0x6b4423).rrect(10, 8, 110, 102, 30); p.fill(0x8a5a2e).rrect(18, 12, 94, 94, 26); p.fill(0x3a3d43).rect(10, 24, 110, 8).rect(10, 86, 110, 8); p.fill(0x222222).rect(8, 0, 6, 14); });
  C('modern', (p) => { p.fill(0x4f5d3a).rrect(2, 16, 126, 94, 6); p.fill(0x6b7a4c).rect(6, 20, 118, 18); p.fill(0x2e3424).rect(2, 50, 126, 6); p.fill(0xe8d34a).rect(10, 94, 24, 8).rect(96, 94, 24, 8); p.fill(0x222222).rect(50, 8, 30, 10); });
  C('future', (p) => { p.fill(0x29f0ff, 0.25).rrect(0, 4, 130, 108, 22); p.fill(0x1b1f3a).rrect(8, 10, 114, 96, 18); p.line(4, 0x29f0ff).srrect(8, 10, 114, 96, 18); p.fill(0xff4fd8).rect(20, 18, 24, 4).rect(86, 94, 24, 4); });
  make(scene, 'mod_barrel', 18, 64, (p) => { p.fill(0x3a3d43).rrect(2, 0, 14, 62, 6); p.fill(0x9aa3ad).rrect(5, 2, 5, 56, 3); p.fill(0xffc21a).rect(0, 0, 18, 7); p.fill(0x222222).ellipse(9, 3, 10, 5); });
  make(scene, 'mod_tip', 60, 80, (p) => { p.fill(0x7fe8ff, 0.25).ellipse(30, 40, 58, 78); p.fill(0x7fe8ff, 0.5).ellipse(30, 44, 30, 50); p.fill(0xffffff).poly([[30, 4], [40, 50], [30, 62], [20, 50]]); });
  make(scene, 'mod_ember', 120, 120, (p) => { for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5; p.fill(i % 2 ? 0xffc21a : 0xff6a1f, 0.85).circle(60 + Math.cos(a) * 44, 60 + Math.sin(a) * 44, 8); } p.fill(0xff7a1f, 0.18).circle(60, 60, 58); });
  make(scene, 'mod_ring', 90, 90, (p) => { p.line(6, 0xffc21a, 0.9).scircle(45, 45, 38); p.line(3, 0xfff1a8, 0.9).scircle(45, 45, 28); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; p.fill(0xffe14d).circle(45 + Math.cos(a) * 38, 45 + Math.sin(a) * 38, 5); } });
  make(scene, 'pu_twin', 48, 48, (p) => { [12, 34].forEach((x) => { p.fill(0xffc21a).rrect(x - 5, 8, 10, 32, 4); p.fill(0xfff1a8).rect(x - 2, 10, 3, 18); p.fill(0x8b5a2b).rrect(x - 7, 34, 14, 10, 3); }); p.fill(0xffffff).rect(21, 20, 6, 3).rect(22.5, 18.5, 3, 6); });
}

function icons(scene) {
  make(scene, 'coin', 24, 24, (p) => { p.fill(0xb8860b).circle(12, 12, 12); p.fill(0xffd84d).circle(12, 12, 10); p.fill(0xf0b429).circle(12, 12, 7); p.fill(0xfff1a8).rrect(10, 6, 4, 12, 2); });
  make(scene, 'icon_dmg', 48, 48, (p) => { p.fill(0xd9dee3).poly([[24, 2], [32, 10], [16, 40], [8, 32]]); p.fill(0x8b5a2b).rrect(4, 34, 14, 10, 3); p.fill(0xf0b429).poly([[6, 26], [22, 42], [18, 46], [2, 30]]); p.fill(0xff5a4f).circle(38, 10, 7); });
  make(scene, 'icon_rate', 48, 48, (p) => { p.fill(0xffd84d).poly([[28, 2], [8, 28], [22, 28], [16, 46], [40, 18], [26, 18]]); });
  make(scene, 'icon_hp', 48, 48, (p) => { p.fill(0xff3b5c).circle(15, 17, 12).circle(33, 17, 12).tri(4, 22, 44, 22, 24, 44); p.fill(0xffffff, 0.6).circle(13, 13, 4); });
  make(scene, 'icon_xp', 48, 48, (p) => { p.fill(0x1e8f4e).poly([[24, 2], [44, 22], [24, 46], [4, 22]]); p.fill(0x5cff8a).poly([[24, 7], [38, 22], [24, 40], [10, 22]]); p.fill(0xd6ffe2).poly([[24, 9], [30, 18], [24, 21], [18, 18]]); });
  make(scene, 'icon_coin', 48, 48, (p) => { p.fill(0xb8860b).circle(18, 28, 16); p.fill(0xffd84d).circle(18, 28, 13); p.fill(0xb8860b).circle(30, 18, 16); p.fill(0xffd84d).circle(30, 18, 13); p.fill(0xfff1a8).rrect(28, 10, 4, 16, 2); });
  make(scene, 'icon_gear', 40, 40, (p) => { p.fill(0xffffff); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; p.circle(20 + Math.cos(a) * 14, 20 + Math.sin(a) * 14, 5); } p.circle(20, 20, 14); p.fill(0x333333).circle(20, 20, 6); });
}

// Painted era art (see ART.md). Each file replaces the code-drawn texture of the same game key,
// so all existing sprites pick it up; if a file is missing the code-drawn art stays as fallback.
// disp: extra on-screen size (painted weapon hands are drawn bigger, like the mockup).
// scale: the file is drawn at this multiple of the code texture's size (HD), the game divides it out.
const ERA_ART = {
  stone: [
    ['enemy', 'enemy_stone'], ['enemy_b', 'enemy_stone_b'], ['enemy_big', 'enemy_stone_big'], ['enemy_charger', 'enemy_stone_charger'],
    ['block', 'block_stone'], ['crate', 'crate_stone'], ['boss', 'boss_stone', 2],
    ['weapon_rock_open', 'weapon_rock_open', 1, 1.5], // empty hand shown at release
    ['weapon_rock', 'weapon_rock', 1, 1.5], ['weapon_sling', 'weapon_stone', 1, 1.5],
    ['p_pebble', 'p_pebble'], ['p_rock', 'p_rock'], ['bp_rock', 'bp_rock'],
    ['bg', 'bg_stone'], ['decor_fern', 'decor_stone_fern'], ['decor_rocks', 'decor_stone_rocks'], ['decor_palm', 'decor_stone_palm'],
  ],
};
const ART_BASE = import.meta.env.BASE_URL + 'assets/eras/';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    for (const [era, list] of Object.entries(ERA_ART)) for (const [file, key] of list) this.load.image('art_' + key, `${ART_BASE}${era}/${file}.webp`);
    this.load.on('loaderror', (f) => console.warn('art missing, using code-drawn fallback:', f.key));
  }
  create() {
    ERAS.forEach((e) => { enemy(this, e.key); block(this, e.key); });
    WEAPONS.forEach((w) => weapon(this, w.key));
    projectiles(this);
    powerupArt(this);
    crateArt(this);
    misc(this);
    bosses(this);
    icons(this);
    for (const list of Object.values(ERA_ART)) for (const [, key, scale, disp] of list) {
      const k = 'art_' + key;
      if (!this.textures.exists(k)) continue;
      const img = this.textures.get(k).getSourceImage();
      if (this.textures.exists(key)) this.textures.remove(key);
      const t = this.textures.addImage(key, img);
      t.customData.scale = (disp || 1) / (scale || 1);
      this.textures.remove(k);
    }
    this.scene.start('game');
  }
}
export const TEX_K = K;

// size multiplier for a texture key: disp / HD factor (e.g. 0.5 for 2x boss art), else 1
export const texScale = (scene, key) => scene.textures.get(key)?.customData?.scale || 1;
