# Slot asset recipes

What to put in each spec field per asset type. Sizes and names come from `guides/art/ART_GUIDE.md`;
the frame name is the spec's `asset` and the file name.

| Asset | Frame name | Generate at | Deliver at | Transparent | Model to start with |
|---|---|---|---|---|---|
| Normal symbol (H1-H4, L1-L4) | `sym_<id>` | 1024×1200 | 256×300 | yes | flux-dev, then nano-banana-2 with the hero as reference |
| Golden symbol | `sym_<id>_gold` | 1024×1200 | 256×300 | yes | edit the normal one (nano-banana-2 / flux-kontext) |
| Wild / Scatter | `sym_WILD`, `sym_SC` | 1024×1200 | 256×300 | yes | ideogram-v3 or gpt-image-2 (they carry a word) |
| Main background | `bg_main` | 720×1280 or larger | 720×1280 | no | flux-dev / nano-banana-2 |
| Free spins background | `bg_freespins` | 720×1280 | 720×1280 | no | edit `bg_main` ("change only the time to golden sunset...") |
| Desktop backdrop | `bg_desktop` | 1920×1080 | ≥1920×1080 | no | flux-dev |
| Logo | `logo` | 1536×768 | per layout | yes | ideogram-v3 |
| Buttons, panels | `btn_*`, `panel_*` | 1024×1024 | 2x on-screen | yes | recraft-v3 / gpt-image-2 |
| Big win titles | `fx_bigwin_*` | 1536×768 | 2x on-screen | yes | ideogram-v3 |

## Symbols

- `purpose`: "Slot symbol icon for a mobile game, must read in half a second at 128 px".
- `subject`: one object, concrete count/shape/material. High symbols get the richest subjects
  (characters, hero foods); low symbols simpler shapes.
- `composition`: "Front view, centred, fills about 85 percent of the height, small even margin,
  strong simple silhouette". Same wording for the whole set so sizes match on the reels.
- Each symbol needs its **own dominant colour** so the board reads at a glance; set it in `palette`.
- Check at 128 px wide: can you tell every symbol apart in half a second? If not, simplify the subject.

## Special symbols (Wild, Scatter)

- Bigger glow or burst, a frame or ribbon, and the word: `"WILD"` / `"SCATTER"` in quotes in `text`
  (the word is SCATTER, not Free Spins).
- Golden versions: edit the normal symbol, "Change only the colours to polished metallic gold with a
  soft glow. Keep the shape, outline and size exactly as they are."

## Backgrounds

- Say where the reels go: "the middle 65 percent is calm and slightly darker, no strong detail".
  Detail lives in the top and bottom bands only.
- No words on signs (they come out garbled): add "No text or signs with words".

## UI pieces

- One piece per image, flat front view, transparent, states as edits of the normal state
  ("Change only: pressed state, darker and 4 px lower. Keep everything else.").
- Prefer building simple panels in code or 9-slice; generate only decorative parts.

## Fishball Fiesta (game-001) symbol set

From the placeholder art in `prototype-web/src/game/theme/foodArt.ts`:

| Id | Subject |
|---|---|
| H1 | Fishballs on a bamboo skewer with sweet sauce (hero) |
| H2 | Halo-halo in a tall glass: ube scoop, shaved ice, layers, wafer |
| H3 | Kwek-kwek: orange battered quail eggs on a stick |
| H4 | Barbecue pork skewer, grilled and glazed |
| L1 | Banana cue: caramelised bananas on a stick |
| L2 | Sago't gulaman: orange iced drink with pearls and a pink straw |
| L3 | Pandesal in a clear bag |
| L4 | Puto: three steamed rice cakes in pleated cups with cheese |
| SC | Sorbetes: dirty ice cream cup with three scoops, "SCATTER" |
| WILD | Golden fishball skewer with a sparkle burst, "WILD" |

The shared look is in `games/game-001/theme/style.json`.
