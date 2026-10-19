// Persistent progress in localStorage: coins, upgrade levels, best stats and audio settings.
// The key stays 'v1' so Stage 2 saves keep loading; 'v' inside tracks the data version and
// read() migrates older data in place (v1 had no weapon tiers: best.tier is derived from best.era).
const KEY = 'eraRunner.save.v1';
const VERSION = 3;

const fresh = () => ({
  v: VERSION,
  coins: 0,
  level: 1, // highest unlocked level
  upg: { dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 },
  best: { era: -1, tier: -1, level: 0, wins: 0, runs: 0, bestCoins: 0, bossKills: [0, 0, 0, 0, 0, 0] },
  bonusBest: {}, // best bonus-run multiplier per level number
  music: true,
  sfx: true,
});

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fresh();
    const f = fresh();
    const d = { ...f, ...raw, upg: { ...f.upg, ...(raw.upg || {}) }, best: { ...f.best, ...(raw.best || {}) } };
    if (!(raw.v >= 2)) {
      // v1 -> v2: the old six weapons were each era's top weapon
      if (!(raw.best && typeof raw.best.tier === 'number')) d.best.tier = d.best.era >= 0 ? d.best.era * 2 + 1 : -1;
    }
    if (!(raw.v >= 3)) {
      // v2 -> v3 (levels by era): reaching an era in the old one-track game unlocks that era's
      // level; beating an era's boss unlocks the level after it.
      const b = d.best;
      let lv = b.era >= 0 ? b.era + 1 : 1;
      (b.bossKills || []).forEach((k, e) => { if (k > 0) { lv = Math.max(lv, e + 2); b.level = Math.max(b.level || 0, e + 1); } });
      d.level = Math.min(7, Math.max(1, lv));
    }
    if (!d.bonusBest || typeof d.bonusBest !== 'object') d.bonusBest = {};
    d.v = VERSION;
    d.level = Math.max(1, Math.floor(Number(d.level) || 1));
    d.coins = Math.max(0, Math.floor(Number(d.coins) || 0));
    return d;
  } catch {
    return fresh();
  }
}

export const Save = {
  data: read(),
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode / quota: keep in memory */ }
  },
  reset() {
    const { music, sfx } = this.data; // keep audio preferences
    this.data = { ...fresh(), music, sfx };
    this.write();
  },
  reload() { this.data = read(); },
};
