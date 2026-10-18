// Shared text styles and a simple button helper.
export const FONT = '"Arial Black", "Arial Bold", "Helvetica Neue", Arial, sans-serif';
export const col = (c) => '#' + c.toString(16).padStart(6, '0');
export const style = (size, color = '#ffffff', stroke = 6, extra = {}) => ({
  fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color, stroke: '#1a1a1a', strokeThickness: stroke, resolution: 2, align: 'center', ...extra,
});

const SHADES = {
  green: [0x34c759, 0x1e7a3a],
  gold: [0xffb627, 0xb06f00],
  blue: [0x3a8dde, 0x1d4f87],
  red: [0xe5483d, 0x8e231c],
  gray: [0x7b7f87, 0x44474d],
};

// Adds a rounded 3D-ish button to `container`. Returns a handle with set(label, shade) and the zone.
export function makeBtn(scene, container, x, y, w, h, label, { shade = 'green', size = 32, cb, name, pulse = false, icon } = {}) {
  const g = scene.add.graphics();
  const t = scene.add.text(x + (icon ? 14 : 0), y, label, style(size, '#ffffff', Math.max(4, size / 5))).setOrigin(0.5);
  const ic = icon ? scene.add.image(0, y, icon).setScale(size / 48) : null;
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  const handle = {
    zone, text: t, g,
    set(lbl, sh = handle.shade) {
      handle.shade = sh;
      if (lbl !== undefined) t.setText(lbl);
      if (ic) ic.x = x - t.width / 2 - 2;
      const [c1, c2] = SHADES[sh];
      g.clear();
      g.fillStyle(c2, 1).fillRoundedRect(x - w / 2, y - h / 2 + 5, w, h, Math.min(22, h / 2.6));
      g.fillStyle(c1, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, Math.min(22, h / 2.6));
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x - w / 2 + 8, y - h / 2 + 5, w - 16, h * 0.3, Math.min(12, h / 5));
    },
  };
  handle.set(label, shade);
  zone.on('pointerdown', () => { t.setScale(0.94); });
  zone.on('pointerout', () => { t.setScale(1); });
  zone.on('pointerup', () => { t.setScale(1); cb?.(); });
  container.add([g, t, zone]);
  if (ic) container.add(ic);
  if (pulse) { const tw = scene.tweens.add({ targets: t, scale: 1.07, yoyo: true, repeat: -1, duration: 600 }); scene.screenTweens?.push(tw); }
  if (name) scene.ui[name] = zone;
  return handle;
}
