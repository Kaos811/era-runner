// All sound effects and music are synthesized at runtime with the Web Audio API (no audio files).
// Original work for this project - no third-party assets, so there are no licence restrictions.
//
// Mobile browsers only allow audio after a user gesture, so unlock() is called from the first
// tap/click/keypress (see main.js); before that every call is a silent no-op.

let ctx = null, master, sfxBus, musBus, noiseBuf;
const prefs = { music: true, sfx: true };
const last = {};

function now() { return ctx.currentTime; }

function tone({ type = 'square', f = 440, f2 = 0, t = 0.1, vol = 0.2, attack = 0.004, delay = 0, dest = sfxBus }) {
  const t0 = now() + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + t + 0.03);
}

function noise({ t = 0.1, vol = 0.2, type = 'lowpass', f = 1200, f2 = 0, q = 0.8, delay = 0, attack = 0.003, dest = sfxBus }) {
  const t0 = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
  fl.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(fl).connect(g).connect(dest);
  src.start(t0, Math.random() * 0.8);
  src.stop(t0 + t + 0.03);
}

const arp = (notes, step, opts) => notes.forEach((f, i) => tone({ f, delay: i * step, ...opts }));
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// name -> [minimum seconds between plays, synth]
const SFX = {
  shot_stone: [0.06, () => noise({ type: 'bandpass', f: 1400, f2: 350, t: 0.09, vol: 0.22, q: 1.2 })],
  shot_bronze: [0.07, () => { noise({ type: 'bandpass', f: 900, f2: 240, t: 0.13, vol: 0.22 }); tone({ type: 'triangle', f: 320, f2: 140, t: 0.1, vol: 0.06 }); }],
  shot_medieval: [0.07, () => { tone({ type: 'triangle', f: 720, f2: 210, t: 0.09, vol: 0.14 }); noise({ type: 'highpass', f: 3000, t: 0.04, vol: 0.06 }); }],
  shot_gunpowder: [0.12, () => { noise({ f: 900, f2: 110, t: 0.32, vol: 0.38 }); tone({ type: 'sine', f: 130, f2: 40, t: 0.28, vol: 0.3 }); }],
  shot_modern: [0.06, () => { noise({ type: 'bandpass', f: 2200, f2: 900, t: 0.045, vol: 0.2, q: 0.7 }); tone({ type: 'square', f: 170, f2: 80, t: 0.035, vol: 0.05 }); }],
  shot_future: [0.07, () => { tone({ type: 'sawtooth', f: 1500, f2: 260, t: 0.12, vol: 0.07 }); tone({ type: 'square', f: 900, f2: 300, t: 0.08, vol: 0.04 }); }],
  shot_rock: [0.08, () => { noise({ type: 'bandpass', f: 600, f2: 250, t: 0.12, vol: 0.2, q: 0.9 }); tone({ type: 'sine', f: 140, f2: 90, t: 0.06, vol: 0.08 }); }],
  shot_javelin: [0.08, () => { noise({ type: 'bandpass', f: 1600, f2: 500, t: 0.18, vol: 0.18, q: 2 }); }],
  shot_repeater: [0.05, () => { tone({ type: 'triangle', f: 900, f2: 300, t: 0.06, vol: 0.12 }); noise({ type: 'highpass', f: 4000, t: 0.025, vol: 0.06 }); }],
  shot_musket: [0.1, () => { noise({ type: 'bandpass', f: 1600, f2: 300, t: 0.2, vol: 0.32, q: 0.6 }); tone({ type: 'square', f: 220, f2: 60, t: 0.08, vol: 0.08 }); }],
  shot_rifle: [0.07, () => { noise({ type: 'bandpass', f: 3000, f2: 700, t: 0.09, vol: 0.26, q: 0.8 }); tone({ type: 'square', f: 260, f2: 90, t: 0.05, vol: 0.06 }); }],
  shot_plasma: [0.09, () => { tone({ type: 'sawtooth', f: 400, f2: 1400, t: 0.08, vol: 0.06 }); tone({ type: 'sine', f: 220, f2: 70, t: 0.22, vol: 0.18, delay: 0.03 }); noise({ type: 'bandpass', f: 2500, f2: 600, t: 0.15, vol: 0.06 }); }],
  gem: [0.04, () => tone({ type: 'sine', f: 1568, f2: 2093, t: 0.07, vol: 0.06 })],
  upgrade: [0.25, () => { arp([659, 880, 1175], 0.06, { type: 'square', t: 0.12, vol: 0.08 }); }],
  hit: [0.04, () => tone({ type: 'square', f: 880, f2: 560, t: 0.035, vol: 0.05 })],
  kill: [0.03, () => { tone({ type: 'square', f: 420, f2: 980, t: 0.08, vol: 0.09 }); noise({ f: 2400, f2: 400, t: 0.1, vol: 0.1 }); }],
  smash: [0.05, () => { noise({ f: 700, f2: 90, t: 0.25, vol: 0.3 }); tone({ type: 'triangle', f: 160, f2: 60, t: 0.2, vol: 0.12 }); }],
  coin: [0.05, () => { tone({ type: 'square', f: 988, t: 0.06, vol: 0.06 }); tone({ type: 'square', f: 1319, t: 0.14, vol: 0.06, delay: 0.055 }); }],
  gate_good: [0.2, () => arp([523, 659, 784, 1047], 0.06, { type: 'square', t: 0.12, vol: 0.08 })],
  gate_bad: [0.2, () => { tone({ type: 'sawtooth', f: 330, f2: 110, t: 0.38, vol: 0.12 }); tone({ type: 'square', f: 220, f2: 80, t: 0.38, vol: 0.06 }); }],
  evolve: [0.3, () => { arp([392, 523, 659, 784, 1047, 1319], 0.07, { type: 'square', t: 0.16, vol: 0.08 }); noise({ type: 'highpass', f: 5000, t: 0.6, vol: 0.05, delay: 0.3, attack: 0.1 }); }],
  hurt: [0.1, () => { noise({ f: 700, f2: 150, t: 0.22, vol: 0.3 }); tone({ type: 'square', f: 220, f2: 70, t: 0.2, vol: 0.1 }); }],
  warn: [0.15, () => { tone({ type: 'square', f: 880, t: 0.07, vol: 0.07 }); tone({ type: 'square', f: 880, t: 0.07, vol: 0.07, delay: 0.12 }); }],
  boss_throw: [0.1, () => { noise({ type: 'bandpass', f: 500, f2: 1600, t: 0.25, vol: 0.2 }); tone({ type: 'triangle', f: 200, f2: 90, t: 0.2, vol: 0.12 }); }],
  boss_charge: [0.2, () => { noise({ f: 300, f2: 80, t: 0.7, vol: 0.4, attack: 0.05 }); tone({ type: 'sawtooth', f: 90, f2: 45, t: 0.6, vol: 0.12 }); }],
  boss_beam: [0.2, () => { tone({ type: 'sawtooth', f: 180, f2: 120, t: 0.6, vol: 0.12, attack: 0.03 }); noise({ type: 'bandpass', f: 1800, f2: 600, t: 0.6, vol: 0.2, attack: 0.03 }); }],
  boss_roar: [0.5, () => { tone({ type: 'sawtooth', f: 160, f2: 55, t: 0.9, vol: 0.16, attack: 0.05 }); noise({ f: 900, f2: 120, t: 0.9, vol: 0.2, attack: 0.08 }); }],
  shield: [0.3, () => { tone({ type: 'sine', f: 300, f2: 900, t: 0.4, vol: 0.12 }); tone({ type: 'triangle', f: 600, f2: 1800, t: 0.4, vol: 0.06 }); }],
  block: [0.06, () => tone({ type: 'triangle', f: 1800, f2: 1500, t: 0.06, vol: 0.06 })],
  boss_die: [1, () => { noise({ f: 1200, f2: 60, t: 1.4, vol: 0.5 }); tone({ type: 'sine', f: 110, f2: 30, t: 1.2, vol: 0.35 }); arp([523, 659, 784, 1047, 1319], 0.1, { type: 'square', t: 0.25, vol: 0.07, delay: 0.5 }); }],
  win: [1, () => { arp([523, 659, 784], 0.12, { type: 'square', t: 0.18, vol: 0.09 }); tone({ type: 'square', f: 1047, t: 0.7, vol: 0.09, delay: 0.36 }); tone({ type: 'triangle', f: 523, t: 0.9, vol: 0.12, delay: 0.36 }); }],
  lose: [1, () => arp([392, 370, 349, 330], 0.28, { type: 'triangle', t: 0.4, vol: 0.14 })],
  click: [0.04, () => tone({ type: 'square', f: 660, f2: 880, t: 0.05, vol: 0.06 })],
  buy: [0.1, () => { arp([784, 988, 1319], 0.05, { type: 'square', t: 0.1, vol: 0.07 }); noise({ type: 'highpass', f: 6000, t: 0.25, vol: 0.04 }); }],
  deny: [0.1, () => tone({ type: 'square', f: 180, f2: 140, t: 0.15, vol: 0.08 })],
};

// ---------------------------------------------------------------- music
// A small 16-step chiptune sequencer: bass, arpeggio, kick and hats. Two moods: run and boss.
const SONGS = {
  run: { bpm: 118, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },
  boss: { bpm: 140, chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]] },
};
const music = { song: 'run', step: 0, next: 0, timer: null };

function scheduleStep(t) {
  const s = SONGS[music.song];
  const bar = Math.floor(music.step / 16) % s.chords.length;
  const st = music.step % 16;
  const ch = s.chords[bar];
  const boss = music.song === 'boss';
  const play = (fn) => { const d = t - now(); fn(Math.max(0, d)); };
  if ([0, 3, 6, 8, 11, 14].includes(st)) play((d) => tone({ type: 'triangle', f: midi(ch[0] - 12), t: 0.22, vol: 0.32, delay: d, dest: musBus }));
  const arpNote = ch[[0, 1, 2, 1][st % 4]] + 12 + (st >= 8 && boss ? 12 : 0);
  if (st % 2 === 0 || boss) play((d) => tone({ type: 'square', f: midi(arpNote), t: 0.09, vol: 0.06, delay: d, dest: musBus }));
  if (st % 8 === 0 || (boss && st % 4 === 0)) play((d) => tone({ type: 'sine', f: 150, f2: 40, t: 0.16, vol: 0.45, delay: d, dest: musBus }));
  if (st % 4 === 2) play((d) => noise({ type: 'highpass', f: 7000, t: 0.04, vol: 0.12, delay: d, dest: musBus }));
  if (boss && st % 8 === 4) play((d) => noise({ type: 'bandpass', f: 1800, t: 0.12, vol: 0.18, delay: d, dest: musBus }));
}

function musicTick() {
  if (!ctx || ctx.state !== 'running') return;
  const stepDur = 60 / SONGS[music.song].bpm / 4;
  if (music.next < now()) music.next = now() + 0.05;
  while (music.next < now() + 0.15) {
    scheduleStep(music.next);
    music.next += stepDur;
    music.step++;
  }
}

export const Sound = {
  init(p) { prefs.music = p.music; prefs.sfx = p.sfx; },
  get ready() { return !!ctx && ctx.state === 'running'; },
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 0.6 : 0; sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = prefs.music ? 0.2 : 0; musBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // iOS needs a sound started inside the gesture to fully unlock
      const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
      document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
      music.timer = setInterval(musicTick, 30);
    }
    if (ctx.state === 'suspended') ctx.resume();
  },
  play(name) {
    if (!ctx || ctx.state !== 'running' || !prefs.sfx) return;
    const def = SFX[name];
    if (!def) return;
    const t = now();
    if (last[name] && t - last[name] < def[0]) return;
    last[name] = t;
    def[1]();
  },
  setSong(name) { if (SONGS[name] && music.song !== name) { music.song = name; music.step = 0; } },
  setMusic(on) { prefs.music = on; if (musBus) musBus.gain.setTargetAtTime(on ? 0.2 : 0, now(), 0.05); },
  setSfx(on) { prefs.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.6 : 0, now(), 0.02); },
  names: Object.keys(SFX),
};
