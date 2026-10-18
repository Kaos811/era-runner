# Era Runner

A one-thumb lane runner for phones: your weapon runs forward and fires on its own, you drag left/right to steer,
and every enemy you defeat gives XP. Fill the XP bar to **evolve your weapon through six eras**:

Stone Age (sling) → Bronze Age (spear thrower) → Medieval (crossbow) → Gunpowder (cannon) → Modern (machine gun) → Future (laser)

Each era changes the scenery, the enemies, the projectiles and the weapon's stats. Steer through green boost gates
(+fire rate, +damage, +shots, +health) and avoid red ones; shooting a gate raises its value. Reach the finish line
(~85 s) to win. Health slowly regenerates after a few seconds without being hit.

**Play:** https://kaos811.github.io/era-runner/

## Stage 1 (this version)
- Fake-3D track (narrows to the horizon, objects grow as they approach), portrait, touch + mouse + arrow keys
- Enemies and breakable blocks with HP numbers, XP gems, 6-era evolution with banner and theme change
- Paired boost gates (good/bad, shootable), health, win/lose screens with stats and retry
- All art is generated in code (no image files)

## Develop
```
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm test           # Playwright e2e test at a 390x844 phone viewport (needs Chrome at /usr/bin/google-chrome or CHROME_PATH)
node tests/tune.mjs     # balance check: plays the level with auto-pilot bots
node tests/screens.mjs  # playtest screenshots -> screenshots/
node tests/screens-feedback.mjs  # dense-section + gate-shooting screenshots
```
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

Code layout: `src/eras.js` (era stats and colours), `src/level.js` (level layout + XP tuning),
`src/scenes/Boot.js` (generated art), `src/scenes/Game.js` (gameplay, rendering, HUD, screens).
