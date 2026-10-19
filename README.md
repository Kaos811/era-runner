# Era Runner

A one-thumb lane runner for phones: your weapon runs forward and fires on its own, you drag left/right to steer,
and every enemy you defeat gives XP. Pick up the XP gems they drop to **upgrade your weapon through 12 weapons in six eras**:

| Era | Weapon 1 | Weapon 2 |
|---|---|---|
| Stone Age | Thrown Rock | Sling |
| Bronze Age | Javelin | Spear Thrower |
| Medieval | Crossbow | Repeating Crossbow |
| Gunpowder | Musket | Cannon |
| Modern | Rifle | Machine Gun |
| Future | Laser Pistol | Plasma Cannon |

**Levels by era (Stage 4):** each level is one era - L1 Stone / Woolly Mammoth, L2 Bronze / Chariot Champion,
L3 Medieval / Castle Dragon, L4 Gunpowder / Pirate Galleon, L5 Modern / Iron Tank, L6 Future / Mega Robot.
You start on the era's first weapon and earn the second with XP. Each level is ~65 s of track plus the boss;
beating the boss unlocks the next level. After Level 6 the game loops back to the Stone Age as Level 7, 8, ...
with tougher enemies and bosses (no cap) and bigger coin rewards. The title screen has a level select (◀ ▶) for replays.

Steer through green boost gates (+fire rate, +damage, +shots, +health) and avoid red ones; shooting a gate raises
its value. Health does not regenerate, so steering matters.

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
  Tough Hide (+15 max health), Head Start (starting XP), Lucky Coins (+15% coins). Costs rise with each level.
- **Saved progress** in localStorage (`eraRunner.save.v1`): coins, upgrade levels, best era, wins, music/SFX settings.
  Settings (gear icon) has Music and Sound FX toggles and Reset Progress, which asks you to confirm.
- **Sound**: a sound per weapon, plus hits, kills, coins, gates, evolve, boss attacks, boss defeat, win and lose,
  and looping music (separate run and boss tracks). Audio starts on the first tap.

## Stage 3
- **12 weapons, two per era.** Each one has its own look, projectile, shot sound and stats. The second weapon
  of an era is a modest step up (a small "UPGRADED!" banner); moving to a new era is a big jump
  ("EVOLVED!" banner, new scenery, new enemies, and the boss you'll meet at the end).
- **XP gems** drop where enemies and blocks die and lie on the track: steer within reach to collect them.
  Missed gems are lost. Collecting gems in a row builds an XP streak bonus (up to x2) that missed gems knock down.
- **Steeper XP curve** (`XP_STEPS` in `src/level.js`): 15, 25, 40, 70, 120, 190, 300, 460, 520, 400, 600 XP per step.
  Where you finish now depends on how well you play; Head Start (60 / 140 / 250 / 400 / 600 / 850 starting XP by level) moves you along.
  The weapon is locked in when the boss fight starts.
- The HUD timeline shows 6 era icons with 2 pips each; the title screen shows all 12 weapons (unlocked ones lit).
- Saves from Stage 2 load unchanged (same key; the data is migrated to version 2 in place).

## Stage 4
- **Levels by era** (see above), level counter on the HUD and title, highest level saved. Save v3 migration keeps
  coins, upgrades and settings; an old save unlocks the level of the best era it reached (or the one after a beaten boss).
- **Checkpoint power-ups.** XP gems also fill a CHECKPOINT meter with five rarity bands (Common grey, Uncommon green,
  Rare blue, Epic purple, Legendary gold; later bands need more gems; the gem streak multiplies meter points too).
  A CHECKPOINT arch crosses the track at ~47% and again just before the boss: the meter cashes out into a random
  power-up from the highest band reached, shown with a colour-coded card flip and sound. Filling Legendary wraps
  the meter back to Common (x2, x3 on the HUD); every full lap banks one Legendary, so a great run can earn several
  power-ups at one checkpoint. Power-ups last the rest of the level, stack, work on the boss, and show as HUD icons.
  The pool lives in `src/powerups.js`:
  - Common: Sharpen (+10% dmg), Quick Draw (+10% rate), Bandage (heal 25)
  - Uncommon: Power Up (+22% dmg), Frenzy (+22% rate), Extra Shot (+1 shot), Gem Magnet
  - Rare: Piercing, Bubble Shield (blocks a hit, recharges in 8 s), Heavy Ammo (bigger, +20% dmg)
  - Epic: Chain Lightning, Orbit Blades, Explosive Shots
  - Legendary: Double Shot, Nova Blast (screen-clearing blast every few seconds), Drone Buddy
- Gates halved (5 per level). Head Start upgrade now gives a % of the XP to weapon 2.
- Balance: `node tests/tune4.mjs` runs fresh-save campaigns per bot (buys upgrades as it goes) and prints per-level
  win rate, upgrades, coins, fight length and checkpoint rarity / loop stats. Screenshots: `node tests/screens-stage4.mjs`.

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
N=50 BOTS=human UPG=all node tests/tune.mjs   # balance across upgrade levels (wins, weapon/boss reached)
node tests/boss-check.mjs        # every boss with every weapon: win rate and fight length
node tests/screens-stage3.mjs    # 12-weapon lineup, tier banner, new weapons, natural boss fights
```
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

Code layout: `src/eras.js` (era stats and colours), `src/level.js` (level layout + XP tuning),
`src/scenes/Boot.js` (generated art), `src/scenes/Game.js` (gameplay, rendering, HUD), `src/bosses.js` (boss fights),
`src/screens.js` (title, shop, settings, end screens), `src/upgrades.js` (shop tuning), `src/save.js` (localStorage),
`src/audio.js` (procedural sound and music), `src/ui.js` (buttons and text styles).
