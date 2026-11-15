---
name: image-prompting
description: Write and translate image-generation prompts for slot game art (symbols, backgrounds, UI, logos, FX) and run them through fal.ai or other models. Use when asked to generate, prompt, edit or iterate on any game image, or to move a prompt to a different image model.
---

# Image prompting

One way of writing prompts that works on every image model, plus an adapter per model that
translates it. Based on OpenArt's GPT Image 2.5 prompt guide, extended for fal.ai and our art pipeline.

Read before generating anything:
- `guides/art/ART_GUIDE.md` (sizes, frame names, atlases) and `games/<id>/guides/art.md` if it exists.
- `games/<id>/theme/style.json` (the game's style lock, see below).
- `references/adapters.md` for the target model, `references/slot-assets.md` for the asset type.

## 1. The core rule

Models reward a **clear description of what should be visible, written in a fixed order**.
No special syntax, no keyword stacks ("masterpiece, 8k, trending"), no `(word:1.3)` weights.
If you cannot picture the sentence, the model cannot either.

## 2. The prompt spec (model-agnostic)

Every prompt is first written as a spec with these fields, in this order. The adapter turns it
into the model's own format. Fields left empty are skipped.

| # | Field | What goes in it | Example (Fishball Fiesta H1) |
|---|---|---|---|
| 1 | `purpose` | What the image is for. Drives framing and empty space. | "Slot machine symbol icon for a mobile game, read at thumbnail size" |
| 2 | `subject` | The thing itself, concrete: shape, count, material, colour. | "Three golden-brown fishballs on a bamboo skewer, glossy with sweet brown sauce" |
| 3 | `composition` | Framing, angle, position, scale, empty space. | "Front view, skewer vertical and centred, fills 85% of the height, small even margin" |
| 4 | `style` | The look, as named techniques, not moods. | "Sticker-style illustration, thick dark-brown outline, flat colour with one soft highlight" |
| 5 | `lighting` | Light by source and direction; materials by name. | "Soft light from the top left, small white specular highlight on each ball" |
| 6 | `palette` | Colours to use and colours to avoid. | "Warm golds and browns, sauce deep amber; no blue or green" |
| 7 | `text` | Exact words in quotes, with placement and type look. Empty = no text. | `"FISHBALL FIESTA" in chunky rounded letters, top centre` |
| 8 | `constraints` | Short exclusion list, one item each. | "No text", "No watermark", "No background, nothing behind the subject" |
| – | `output` | Size/aspect, transparency, count, seed. **Never written into the prompt text**; the adapter sends these as parameters. | 1024×1200, transparent, 4 images |

Writing rules (from the guide, all models):
1. **Replace mood words with visible details.** Not "cozy, epic, premium" but what makes it so:
   "steam rising from the cup", "gold rim catching a hard light from above".
2. **Name materials and light sources.** "Brushed gold metal", "glossy sauce", "single warm lamp behind".
3. **Text in quotes**, spelled exactly; say where each line sits and how the type looks;
   spell unusual words letter by letter (F-I-S-H-B-A-L-L) if a model keeps misspelling;
   always add "No other text". Read every result: stray text is the most common failure.
4. **Keep the request focused.** One asset per prompt. Unrelated asks pull the model two ways.
5. **Short exclusion list** (3 to 6 items). It is the cheapest quality win.
6. **Quality settings do not fix a vague prompt.** Fix the description first.
7. **Long prompts use labelled lines** (`PURPOSE:`, `SUBJECT:`, ... `CONSTRAINTS:`) so one line can
   be changed for a variation. The builder does this automatically.

## 3. Editing and references

When editing an existing image or using reference images:
- **Give every reference a role:** "Use image 1 for the character's face and outfit. Use image 2 for the
  colour palette only." Without roles the model blends them.
- **Change one thing per turn, and say it first:** "Change only the sauce colour to deep red."
- **Always restate what stays the same, every turn:** "Keep the skewer, outline thickness, size and
  position exactly as they are." Details drift over long edit sessions if you stop saying it.
- "Same style as before" is extra context, never a replacement for the specifics.

## 4. Style lock: keeping a whole set consistent

A slot game needs 10+ symbols that look like one family. Put the shared parts in
`games/<id>/theme/style.json` once (style, lighting, palette, constraints, purpose). Each asset spec
only adds its subject/composition. The tool merges them (asset fields win; constraints are combined).
Then:
- Generate the **hero symbol first** (H1), pick the best result, note its seed.
- Use it as a style reference (`references` with role "style") for the rest of the set on models that
  accept image input (Nano Banana 2, GPT Image 2, FLUX Kontext, Ideogram style refs).
- Keep the same model for a whole set. Switching models mid-set changes the look more than any prompt.
- **Looking at another game for style:** describe the look in words ("semi-realistic glossy 3D render, soft
  studio light") and write it into `style.json`. Do not feed another game's screenshot to a model as a
  reference image, and do not copy its characters, layouts or label designs. A word like SCATTER on a banner
  is fine; the picture and banner design must be ours.

## 5. Transparency (symbols, UI, logos)

Our symbols and UI are PNGs with alpha. Only GPT Image models generate real transparency.
For every other model the adapter (a) adds "isolated on a plain flat white background, nothing
behind the subject, no shadow on the ground" and (b) runs a background-removal pass
(`fal-ai/birefnet`) after generation. Ask for "a clean edge" so the cutout is tidy.

## 6. Two ways to run it

| | Script on Josh's PC (`npm run art:gen`) | fal connector in chat (`mcp__fal__*`) |
|---|---|---|
| Good for | Real production runs: saves files into `theme/generated/` with prompt + seed sidecars | Quick experiments and checking results with Claude |
| Can Claude see the images? | No (they download to the PC) | Yes, inline in the tool result |
| Can the images reach the repo? | Yes, directly | **No from the cloud session**: fal.media is blocked by the proxy (403), so links must be turned into files on the PC with `npm run art:symbols` |
| Links | n/a | **Expire**; tell Josh to run `art:symbols` soon after |

Both use the same spec and the same prompt rules. With the connector, build the call from the spec by
hand: same field order, labelled lines for Nano Banana / GPT Image, prose for FLUX and Ideogram.
Before spending: show Josh the model, why, and the cost (`get_pricing`), and wait for "go".
In a cloud session, never say a file is on his PC until you have verified it there (see section 9).

## 7. Workflow

1. **Pick the asset recipe** in `references/slot-assets.md` (symbol, special symbol, background,
   desktop backdrop, button, logo, banner, FX).
2. **Write the spec** as JSON in `games/<id>/theme/prompts/<frame-name>.json` (frame name = the atlas
   contract, e.g. `sym_H1`). Fill only the fields the style lock doesn't cover.
3. **Dry run** to see the exact payload each model will get, with no cost:
   `npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --dry-run`
4. **Explore cheap** (FLUX schnell or Nano Banana 2 at 4 images), then **finalise** on the
   quality model. Note the seed of the winner in the spec.
5. Results land in `games/<id>/theme/generated/<frame-name>/` with a `.json` sidecar (prompt, model,
   seed, params) next to each image, so any image can be reproduced or moved to another model.
6. Look at the images (Read the PNGs). Check: silhouette readable at 128 px, no stray text,
   outline/style matches the set, clean edges. Iterate by changing **one spec field at a time**.
7. Pick the keeper: put `"sym_X": "generated:N"` in `games/<id>/theme/symbols.json`, then
   `npm run art:symbols -- games/<id>` fits each symbol into its 256x256 atlas cell (trim, scale to touch the
   longer edge, centre, exactly like the placeholder atlas) and builds `theme/atlas/`; `--install` copies it
   into `client-cocos/assets/resources/atlas/`. Generated files are drafts; Josh approves before `--install`.
   Full steps: `docs/ART_WORKFLOW.md`.
8. **Log it:** after a run or a decision, call the `art-log` agent (or `npm run art:log`) so the prompt, model, seed,
   cost, Josh's decision and why, and thumbnails of picked/rejected images are recorded in
   `games/<id>/theme/art-log/LOG.md`.

## 8. Translating to another model

Never rewrite a prompt by hand for a new model. Keep the spec, change `model`, dry-run, compare.
Each adapter in `references/adapters.md` lists what that model accepts (size vs aspect ratio,
negative prompt field, seed, transparency, reference images) and its prompt quirks. To add a model:
add an entry in `tools/imagegen/adapters.ts` and a row in `references/adapters.md`.

## 9. Rules and lessons

- Every asset must be **original**: never name another game, studio, character or artist in a prompt.
  References from other games are for genre and layout only (see ART_GUIDE.md).
- No real people, brands or logos in prompts.
- `FAL_KEY` lives in an environment variable or `.env.local` (git-ignored). Never in a file that is
  committed, never in a prompt spec, never pasted into chat.
- Generation costs money: dry-run first, explore at low cost, and tell Josh the rough cost before a
  batch of more than ~20 images.

### Lessons from Fishball Fiesta (Nov 2026)

Art that worked:
- **Set consistency:** make H1 first, then every other symbol with `nano-banana-2/edit` and H1 as a style
  reference ("use image 1 for the rendering style only, do not copy its subject"). The set matched.
- **Words on art** (WILD, SCATTER): WILD worked on Nano Banana 2; SCATTER on Ideogram v3 with
  `expand_prompt: false` spelled correctly in both candidates. Still read every result.
- **Fixing one detail:** state the count and the negation twice ("exactly one stick ... never two",
  "No second stick"). The banana cue's double stick needed this. If a model drifts (the second banana
  attempt looked like fishballs), ask for 2 candidates and pick; $0.08 each is cheap.
- Describe food by its real parts (banana slices with caramel), or the model returns generic balls.
- Cutouts: `fal-ai/birefnet` after generation is about a tenth of a cent each and worked on all symbols.
  Soft off-white studio backdrops cut out fine; still check edges for halos.
- Typical cost: 2 candidates of the hero ~$0.16, the other 8 symbols ~$0.65, scatter ~$0.07, cutouts ~$0.05.

Process rules learned the hard way:
- Atlas cells are 256x256 and the art touches the cell edge on its longer side. Do not deliver 85 percent
  margins; `art:symbols` handles the fitting, so any aspect ratio can be generated.
- When replacing a frame in the atlas, the old pixels must be wiped first (`dest-out` with an OPAQUE
  rectangle). A transparent rectangle wipes nothing and the old art shows through.
- Josh is on Windows PowerShell: plain `npm` can be blocked ("scripts disabled"). Give commands as
  `npm.cmd ...` or the one-time `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
  Paths in commands start with `games/`, never `/games/`.
- Windows cannot overwrite a PNG that is open in an image viewer, VS Code tab or Cocos: close it first
  ("unable to open for write ... Invalid argument").
- Files written to `/mnt/project-files` are on a network mount: wait ~10 s and grep the file before
  `device_commit_files`, or the commit can copy the stale version (this shipped an unfixed script once).
  After a commit, stage the device file back and confirm the change is there before telling Josh.
- Remote tools cannot write into `.claude/`; the skill source is `skills/image-prompting/` and Josh copies it.
- Josh is learning: explain each command part by part, one step at a time, and give the exact folder and
  how to open PowerShell there.
