// Persistent progress in localStorage: coins, upgrade levels, best stats and audio settings.
const KEY = 'eraRunner.save.v1';

const fresh = () => ({
  coins: 0,
  upg: { dmg: 0, rate: 0, hp: 0, xp: 0, coin: 0 },
  best: { era: -1, wins: 0, runs: 0, bestCoins: 0, bossKills: [0, 0, 0, 0, 0, 0] },
  music: true,
  sfx: true,
});

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fresh();
    const f = fresh();
    return { ...f, ...raw, upg: { ...f.upg, ...(raw.upg || {}) }, best: { ...f.best, ...(raw.best || {}) } };
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
