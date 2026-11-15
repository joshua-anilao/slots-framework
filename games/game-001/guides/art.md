# Game 001 (Fishball Fiesta) art overrides

Only the differences from `guides/art/ART_GUIDE.md`.

- **Look:** semi-realistic, glossy 3D-rendered Filipino street food, soft studio light, rich saturated colour
  (decided 2026-11-13, from Josh's reference screenshot, used as a style guide only). Not the flat sticker look
  of the placeholder art. The reference's own symbols, bottles and banner design are not copied.
- **Symbol frames:** `sym_H1` to `sym_H4`, `sym_L1` to `sym_L4`, `sym_SC`, `sym_WILD`; 256×256 cells; art touches the
  cell edge on its longer side and is centred (the atlas layout of `client-cocos/assets/resources/atlas/fishball.*`).
- **Skewers:** one single bamboo stick through the food (fishballs, kwek-kwek, barbecue, banana cue), never two.
- **Scatter:** `sym_SC` is a sorbetes cup with a ribbon banner reading "SCATTER" (the word is SCATTER, not Free Spins).
  **Wild:** `sym_WILD` is a golden fishball skewer with a ribbon reading "WILD".
- **How it is made:** prompt specs in `theme/prompts/`, shared look in `theme/style.json`, picks in `theme/symbols.json`,
  built with `npm run art:symbols`. See `docs/ART_WORKFLOW.md` and the `image-prompting` skill.
