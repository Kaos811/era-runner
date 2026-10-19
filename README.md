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
  A CHECKPOINT arch crosses the track at ~30%, ~60% and just before the boss (the meter resets after each): the meter cashes out into a random
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

## Stage 4.1 tuning
- Gems pop 42-78 units sideways, away from you, and the pickup reach is narrower: you have to steer for them
  (standing still collects nothing). One gem per enemy (2 for big ones and blocks). Gem Magnet doubles the reach per stack.
- Weapon 2 needs 25% of the level's enemy HP in gem XP. Rarity bands are 4 / 5 / 8 / 11 / 20 points (a lap is 48).
- 3 checkpoints per level. All gem and checkpoint knobs are in `src/tuning.js`, `src/powerups.js` (bands and
  power-up pool) and the `PLAN` rows in `src/level.js` (add or remove `'cp'` rows to change the number of checkpoints).

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

## Stage 5 — Gem crates, meter arches, weapon transforms

- **Gem crates** (one per segment, 5 per level) are the main gem source. Each is themed per era and
  shows a number; shooting it raises the number (scaled by your damage, fire rate and shots, capped at 40).
  Reaching it shatters it into a weaving trail of that many gems — steer through it.
  Enemies only drop a few gems. Gems still give XP toward weapon 2.
- **Meter arches** (5 per level, one every ~14 s since Stage 7, the last right before the boss) replace checkpoints.
  Trail gems fly into the upcoming arch's meter (shown on the arch and on the HUD):
  Common 5 → Uncommon 9 → Rare 14 → Epic 22 → Legendary 38. Past Legendary it loops to Common and
  each full lap banks an extra Legendary. Passing under cashes out in slow-mo with a card flip.
- **Visible weapon transforms**: extra barrels, glowing pierce tip, ember (explosive), ring (double shot),
  sparks (chain). **Twin Weapon** (Legendary) adds a copy of your weapon that fires alongside it and
  follows weapon upgrades. No allies/drones (Drone Buddy was removed from the pool).
- **Damage numbers** pop off hits, aggregated per target every ~0.2 s (boss ~0.4 s).
- 3 shootable gates per level.
- Tuning knobs: `src/tuning.js` (`GEMS`, `CRATES`), `src/powerups.js` (`RARITIES`, `POWERUPS`),
  `src/level.js` (`SEG_ROWS`, `CRATE_AT`, `ARCH_AT`), `src/bosses.js` (`REF_BOOST`, per-boss hp).
- Tests: `node tests/e2e.mjs`, screenshots `node tests/screens-stage5.mjs`, bot tuning `node tests/tune4.mjs`.

## Stage 6 — Bonus run and year counter

- **Bonus run** (wins only): after the boss falls, ~5–8 s of rows of numbered blocks spanning the
  track, tagged x1.2, x1.5, x2, x2.5, x3, x4, x5. Row HP climbs steeply from the level's base weapon
  DPS, so how far you get depends on your real firepower (gates, weapon 2, power-ups, shop upgrades).
  The first row you can't break (a harmless bump) or clearing x5 ends it; the level's coins are
  multiplied by the best row broken, with a count-up and an "x2.5!" stamp on the result screen.
  The best multiplier per level is saved (`bonusBest` in the save) and shown on the track as
  "BEST: x3" on that row. Base coin values were scaled to 0.62 so the multiplier doesn't flood the shop.
  Knobs: `BONUS` and `COINS` in `src/tuning.js`; code in `src/bonus.js`.
- **Year counter**: the HUD shows a year next to the weapon name (and under the weapon) that climbs
  with XP through the level's era (Stone 10,000 BC–3,000 BC, Bronze 3,000–800 BC, Medieval
  500–1450 AD, Gunpowder 1450–1850 AD, Modern 1900–2025 AD, Future 2100–2400 AD). Weapon 2 arrives
  at a fitting year (7,000 BC, 1,800 BC, 1100, 1650, 1960, 2250 AD). Gem pickups pop "+N YRS"
  (aggregated every 0.5 s). Level 7+ reuses the ranges with a "LOOP 2" tag. Code: `src/years.js`.
- Tests: `node tests/e2e.mjs`; bonus/economy tuning `node tests/tune-bonus.mjs`;
  screenshots `node tests/screens-bonus.mjs`.

## Stage 7 — Gate clear zones, spread waves, chargers

Gates still block your shots (by design). Before, walking enemies caught up with gates, so a
wave often sat hidden right behind a gate and hit you just after you passed it (about half of all
hits a weak player took were within 2.5 s after a gate).

- **Waves are laid out by arrival time** (`buildLevel` in `src/level.js`, knobs in `WAVES` in
  `src/tuning.js`). Nothing arrives within 0.6 s before or 1.8 s after a gate (~650 units out
  when you pass it), and anything arriving before a gate also spawns in front of it, so it never
  walks through the gate while hidden. Waves have a minimum gap (scaled by enemy speed) and
  spare room is spread evenly; enemies in a wave are >= 110 apart sideways or >= 0.3 s apart.
- **Runtime guards** (`src/waves.js`): an enemy can't close in on a gate (or a gem crate in its
  lane) that is still in front of it; enemies that end up on top of each other push apart.
- **Harder later on, fairly**: enemies walk a bit faster per era / loop, wave HP is up ~10–30%
  (per-era, bot-tuned), Level 2+ gets an extra wave, loops another one, and from Level 4 on
  **chargers** (red, "!") walk in, stop at ~950 units and flash your lane red for 0.65 s, then
  rush down that lane. Steer out or kill them fast. They never telegraph while a gate hides them.
- Levels are ~9 % longer (LEN 23000, arches every ~14 s). Kill coins x0.72 keep coins per win
  about the same.
- Tests: `node tests/e2e.mjs` (layout, gate hold, spreading, charger dodge checks);
  static layout `node tests/layout-check.mjs`; bot stats `node tests/tune-gates.mjs`
  (`DIST_DIR=<old dist>` to compare builds); screenshots `node tests/screens-waves.mjs`.
