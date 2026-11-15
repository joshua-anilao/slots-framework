# Art workflow: from a prompt to the atlas in the game

Everything runs on your PC in `D:\SlotsGame\Slots-Framework` (PowerShell: click the folder's address
bar in File Explorer, type `powershell`, Enter). It needs the one-time setup in `docs/FAL_AI_SETUP.md`
(account, credit, `FAL_KEY` in `.env.local`, `npm install`).

```
prompt spec  ->  npm run art:gen  ->  look at candidates  ->  symbols.json  ->  npm run art:symbols --install  ->  game
(theme/prompts)   generate + cutout     theme/generated/       pick one          fit to 256x256 + pack atlas
```

## 1. Write or edit the prompt spec

One file per asset in `games/game-001/theme/prompts/`, named after the atlas frame (`sym_H2.json`).
The shared look comes from `theme/style.json`; the spec only holds what is different: subject,
composition, output. Ready-made specs exist for all 10 symbols. Ask Claude to write or change specs.

## 2. Check the cost for free

```
npm run art:gen -- games/game-001/theme/prompts/sym_H2.json --dry-run
```

It prints the exact request, the model and the cost ("about $0.19"). Nothing is spent and no key is needed.

## 3. Generate

```
npm run art:gen -- games/game-001/theme/prompts/sym_H2.json
```

- Several at once: `... prompts/sym_*.json` (over 20 images it asks "Continue? (y/N)").
- Different model for this run: `--model flux-dev` (see `docs/FAL_AI_SETUP.md`). Cheaper test: `--model flux-schnell --count 1`.
- Best quality: add `--final`. More candidates: `--count 4`.
- Specs with `"transparent": true` get their background removed automatically.
- Images are saved in `games/game-001/theme/generated/sym_H2/` as `sym_H2_<model>_<time>_1.png`, `_2.png`, ...
  next to a `.json` with the prompt and seed.

The first symbol, H1, sets the style for the rest. The other specs use `theme/source/sym_H1.png`
(saved by `art:symbols`) as a style reference, so run H1 first.

## 4. Look and pick

Open the images in `theme/generated/<frame>/`. Check: readable small, one stick on skewers, no stray
text, spelling of WILD and SCATTER, clean edges. Not good? Change one thing in the spec and run again
(old results stay).

## 5. Tell the atlas which one to use

Edit `games/game-001/theme/symbols.json`, frame name to image. The short forms are the easiest:

```json
{
  "sym_H1": "generated",
  "sym_H2": "generated:2",
  "sym_L1": "generated/sym_L1/sym_L1_nano-banana-2_20261113-011500_1.png"
}
```

- `"generated"` = candidate 1 of the newest run. `"generated:2"` = candidate 2 of the newest run.
- A path (from `theme/`) = that exact file. An `https://` link also works while it lasts.
- Frames you leave out keep their current art in the atlas.

## 6. Build the atlas

```
npm run art:symbols -- games/game-001
```

Writes the single 256×256 frames to `theme/symbols/` and the atlas to `theme/atlas/fishball.png` + `.plist`
(same layout and frame names as now; art fitted like the placeholders: touching the cell edge on its longer
side, centred). Open the PNG and check it. When happy, put it in the game:

```
npm run art:symbols -- games/game-001 --install
```

This overwrites `client-cocos/assets/resources/atlas/fishball.png/.plist` (git can undo it), then
refresh the project in Cocos Creator.

## 7. Log it

Every prompt, pick and decision should be written down, with thumbnails. Ask Claude's `art-log` agent
(`agents/art-log.md`) after a run or a decision, or add an entry yourself:

```
npm.cmd run art:log -- games/game-001 --asset sym_H2 --decision "Picked candidate 2" --why "One stick, best glaze" --by Josh --cost "$0.16" --sidecar games/game-001/theme/generated/sym_H2/<file>.json --pick games/game-001/theme/generated/sym_H2/<picked>.png --reject games/game-001/theme/generated/sym_H2/<other>.png
```

The log is `games/game-001/theme/art-log/LOG.md`, with 384 px thumbnails in `art-log/images/`. The sidecar (`.json`
next to each generated image) supplies the model, seed and exact prompt.

To turn the agent on, copy it once: `New-Item -ItemType Directory -Force .claude\agents | Out-Null` then
`Copy-Item -Force agents\art-log.md .claude\agents\`.

## Redoing one symbol

Edit its spec, run step 3 for just that file, set `"sym_X": "generated"` in step 5, run step 6. Cost: one image.

## If something goes wrong

| Message | Fix |
|---|---|
| `FAL_KEY is not set` | `.env.local` in the repo root with `FAL_KEY=...` |
| `No generated images for sym_X` | Run step 3 for that spec first |
| `Not frames in the atlas` | Frame name typo in `symbols.json` (use `sym_H1` ... `sym_WILD`) |
| `The image has no visible pixels` | The cutout failed; set `"transparent": true` in the spec and generate again |
| Anything else | Paste the message to Claude (never the key) |
