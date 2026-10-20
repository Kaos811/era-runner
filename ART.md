# Era Runner art pipeline

Painted, semi-3D art per era. Style target: `/workspace/era-runner-art/style-target-stone.jpg`
(passed as a reference image to every generation for consistency).

## Steps
1. Generate each source with GenerateImage on a **flat #00FF00 background** (prompts below),
   reference image = the style target. Save sources to `/workspace/era-runner-art/src/<name>.jpg`.
2. `python3 art/build_stone.py` → chroma-key (green-dominance alpha, 1px erode + 0.7px feather,
   edge despill), trim, premultiplied Lanczos fit into the *same pixel box as the code-drawn
   texture*, WebP q≈88 → `public/assets/eras/stone/`.
3. `src/scenes/Boot.js` `ERA_ART` maps file → game texture key. Loaded art replaces the
   code-drawn texture of that key; missing files fall back to the code-drawn art. A 3rd entry
   (e.g. `2` for the boss) marks HD art; `texScale()` divides it out.
4. Background: `bg_<era>` is placed by `showBgArt()` with the painting's horizon fraction on HY.
   Roadside props: `decor` list in `src/eras.js`.

Boxes (px): enemy 160x200 (feet at bottom) · block 180x160 · crate 260x224 · weapon 220x300
(origin 0.5,0.92) · boss 1040x880 (2x) · p_pebble 44 · p_rock 36 · bp_rock 80 · decor 300x260 / 260x360.

## Prompts (Stone Age)
Shared suffix: "painted semi-realistic mobile game style matching the reference, warm sunset
lighting, centered, whole body visible with margin, no ground shadow, no text", on
"a pure flat solid #00FF00 green background, nothing else".
- bg: portrait prehistoric landscape, smoking volcano with lava left, cliffs right, hazy orange
  sunset sky, dirt path to a horizon at 40% from the top, ferns/palms only at the edges, no characters/UI.
- caveman: muscular caveman, shaggy hair/beard, fur loincloth, wooden club, facing viewer.
- cavewoman: lean hunter, fur tunic, bone necklace, stone-tipped spear upright.
- brute: huge brute caveman, fur pelt, war paint, massive stone-headed club.
- boar (Level 4+ charger): angry tusked boar charging toward the viewer, front view.
- mammoth (boss): giant woolly mammoth head-on, curved tusks, raised trunk, red eyes.
- sling: first-person hand gripping a fur-wrapped Y slingshot, rope-tied straps, stone in pouch.
- rockhand: first-person hand/forearm from the bottom gripping a rough fist-sized rock.
- props (2x2 sheet): rope-bound wooden crate, mossy granite boulder, fern bush, rock cluster.
- palm_stone (sheet): small palm tree (left), round grey throwing stone (right).
