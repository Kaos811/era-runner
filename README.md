# Era Runner

A one-thumb lane runner for phones: your weapon runs forward and fires on its own, you drag left/right to steer,
and every enemy you defeat gives XP. Fill the XP bar to **evolve your weapon through six eras**:

Stone Age (sling) → Bronze Age (spear thrower) → Medieval (crossbow) → Gunpowder (cannon) → Modern (machine gun) → Future (laser)

Each era changes the scenery, the enemies, the projectiles and the weapon's stats. Steer through green boost gates
(+fire rate, +damage, +shots, +health) and avoid red ones; shooting a gate raises its value. At the end of the track
(~85 s) the track stops and you fight a **boss that matches the era you reached**. Beat it to win.
Health does not regenerate, so steering matters.

**Play:** https://kaos811.github.io/era-runner/

## Stage 1 (this version)
- Fake-3D track (narrows to the horizon, objects grow as they approach), portrait, touch + mouse + arrow keys
- Enemies and breakable blocks with HP numbers, XP gems, 6-era evolution with banner and theme change
- Paired boost gates (good/bad, shootable), health, win/lose screens with stats and retry
- All art is generated in code (no image files)

## Stage 2
- **Era bosses** at the finish, one per era, all drawn in code: Woolly Mammoth (Stone), Chariot Champion (Bronze),
  Castle Dragon (Medieval), Pirate Galleon (Gunpowder), Iron Tank (Modern), Mega Robot (Future).
  The track stops, a big health bar appears, and the boss uses telegraphed attacks you dodge by steering
  (a red lane flashes before each one): thrown projectiles, aimed barrages, lane charges and beams. It also raises a
  shield at 66% and 33% health. Boss health scales with your damage, so a fight lasts about 15-30 s.
- **Coins** drop from enemies, blocks and the boss and fly into the HUD counter. You keep all of them on a win and half on a loss.
- **Upgrade shop** (from the title and end screens): Sharper Weapons (+10% damage per level), Quick Hands (+8% fire rate),
  Tough Hide (+15 max health), Head Start (+10 starting XP), Lucky Coins (+15% coins). Costs rise with each level.
- **Saved progress** in localStorage (`eraRunner.save.v1`): coins, upgrade levels, best era, wins, music/SFX settings.
  Settings (gear icon) has Music and Sound FX toggles and Reset Progress, which asks you to confirm.
- **Sound**: a sound per weapon, plus hits, kills, coins, gates, evolve, boss attacks, boss defeat, win and lose,
  and looping music (separate run and boss tracks). Audio starts on the first tap.

## Credits and licenses
All art and audio are original and generated in code. There are **no third-party asset files**.
- Graphics: drawn at runtime in `src/scenes/Boot.js`.
- Sound effects and music: synthesized at runtime with the Web Audio API in `src/audio.js`
  (oscillators, filtered noise and a small step sequencer). They are original work, owned by the project, and fine for commercial use.
- Code library: [Phaser 3](https://phaser.io), MIT license, free for commercial use.
See `CREDITS.md`.

## Develop
```
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm test           # Playwright e2e test at a 390x844 phone viewport (needs Chrome at /usr/bin/google-chrome or CHROME_PATH)
node tests/tune.mjs     # balance check: plays the level with auto-pilot bots
node tests/screens.mjs  # playtest screenshots -> screenshots/
node tests/screens-feedback.mjs  # dense-section + gate-shooting screenshots
node tests/screens-stage2.mjs    # title/shop/settings/boss/win screenshots
N=50 BOTS=human UPG=all node tests/tune.mjs   # balance across upgrade levels
```
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

Code layout: `src/eras.js` (era stats and colours), `src/level.js` (level layout + XP tuning),
`src/scenes/Boot.js` (generated art), `src/scenes/Game.js` (gameplay, rendering, HUD), `src/bosses.js` (boss fights),
`src/screens.js` (title, shop, settings, end screens), `src/upgrades.js` (shop tuning), `src/save.js` (localStorage),
`src/audio.js` (procedural sound and music), `src/ui.js` (buttons and text styles).
