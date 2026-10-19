// Persistent progress in localStorage: coins, upgrade levels, best stats and audio settings.
// The key stays 'v1' so Stage 2 saves keep loading; 'v' inside tracks the data version and
// read() migrates older data in place (v1 had no weapon tiers: best.tier is derived from best.era).
const KEY = 'eraRunner.save.v1';
const VERSION = 2;

const fresh = () => ({
  v: VERSION,
  coins: 0,
  upg: { dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 },
  best: { era: -1, tier: -1, wins: 0, runs: 0, bestCoins: 0, bossKills: [0, 0, 0, 0, 0, 0] },
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
      d.v = VERSION;
    }
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
