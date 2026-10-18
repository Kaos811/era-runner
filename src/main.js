import Phaser from 'phaser';
import { BootScene } from './scenes/Boot.js';
import { GameScene } from './scenes/Game.js';

// The game is laid out in a 540x960 portrait space. The canvas is rendered at 2x (1080x1920)
// with the camera zoomed 2x, so text and vector art stay crisp on high-DPI phones.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1080,
  height: 1920,
  backgroundColor: '#1b1410',
  // EXPAND keeps the 540x960 layout visible and grows the view to fill taller/wider screens (no black bars).
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  render: { antialias: true },
  scene: [BootScene, GameScene],
});

window.__ER = Object.assign(window.__ER || {}, { game });
