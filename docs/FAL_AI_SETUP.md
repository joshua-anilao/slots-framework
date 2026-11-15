# fal.ai in the framework: setup and how it works

fal.ai is a pay-per-image service that hosts many image models (FLUX, Nano Banana, GPT Image,
Ideogram, Recraft, ...) behind one API and one key. We call it from a small Node tool, so prompts
live as files in the repo and images land straight in the game's folder.

## How the pieces fit

```
games/game-001/theme/style.json          the game's shared look (style lock)
games/game-001/theme/prompts/sym_H1.json one asset's prompt spec (model-agnostic)
            │
            ▼  npm run art:gen -- <spec>
tools/imagegen/spec.ts      merges style + spec, writes the prompt in the skill's order
tools/imagegen/adapters.ts  translates it for the chosen model (size, negatives, transparency...)
tools/imagegen/falClient.ts sends it to fal.ai (queue API), waits, downloads
            │
            ▼
games/game-001/theme/generated/sym_H1/sym_H1_flux-dev_<time>_1.png  (+ .json with prompt and seed)
```

The prompting rules are the Claude skill in `skills/image-prompting/`.

## Step 0: Turn on the skill for Claude Code (once)

Claude can't write into `.claude/` remotely, so the skill is kept in `skills/image-prompting/`.
Copy it into place once from the repo root in PowerShell:

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse -Force skills\image-prompting .claude\skills\
```

Commit both folders. After that, Claude Code picks it up whenever you ask for art in this repo.
If the skill changes later, run the `Copy-Item` line again.

## Step 1: Make a fal.ai account and add credit

1. Sign up at https://fal.ai (GitHub or Google login works).
2. Add a small amount of credit in **Billing** (e.g. $10). Images cost from about $0.003 (FLUX
   schnell) to $0.08 (Nano Banana 2) each; prices are at https://fal.ai/pricing.
3. Optional: set a spending limit in Billing so a mistake can't cost much.

## Step 2: Create an API key and store it safely

1. In the fal dashboard open **API Keys** → **Add key**. Copy it once (it isn't shown again).
2. The key is a password for your money. Rules: never commit it, never paste it into chat or a
   prompt spec, never put it in `game.json`. If it leaks, delete it in the dashboard and make a new one.
3. Store it in **one** of these ways:

   **A. A local file (easiest).** In the repo root create `.env.local` containing one line:
   ```
   FAL_KEY=paste-your-key-here
   ```
   `.env.local` is in `.gitignore`, so git will not pick it up. Check with `git status`: the file
   must not appear.

   **B. A Windows user environment variable.** In PowerShell:
   ```powershell
   setx FAL_KEY "paste-your-key-here"
   ```
   Close and reopen the terminal (and VS Code) so it sees the new variable.

The tool reads `FAL_KEY` from the environment first, then from `.env.local`.

## Step 3: Try it without spending anything

From `D:\SlotsGame\Slots-Framework`:

```powershell
npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --dry-run
```

This prints the exact request that would be sent: the final prompt, size, seed, count. No key
needed, no cost. Try another model to see the translation change:

```powershell
npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --dry-run --model gpt-image-2
npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --dry-run --model nano-banana-2
```

## Step 4: First real image (cheap)

```powershell
npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --model flux-schnell --count 2
```

You'll see `IN_QUEUE` → `IN_PROGRESS` → `COMPLETED`, then the saved paths. Open
`games/game-001/theme/generated/sym_H1/`. Each PNG has a `.json` next to it with the prompt, model and
seed, so any image can be made again.

Then the real quality pass:

```powershell
npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --final
```

## Step 5: Day-to-day use

- New asset: copy a spec in `games/<id>/theme/prompts/`, rename it to the frame name, change
  `subject` and `composition`. The style lock fills in the rest.
- Change one field at a time between runs, so you know what made the difference.
- Liked one? Put its seed in the spec's `output.seed` to make variations around it.
- Options: `--model <key>`, `--count <n>`, `--seed <n>`, `--final`, `--dry-run`, `--yes`
  (skip the "more than 20 images" question). Several specs at once:
  `npm run art:gen -- games/game-001/theme/prompts/*.json --dry-run`
- Or ask Claude: "make the H2 symbol spec and dry-run it on nano-banana-2". Claude can write specs and
  dry-run on its own; real generation runs on your PC, where your key is.

## Step 6: From draft to game

`generated/` is git-ignored (drafts get big). When you pick a keeper, follow step 7 to fit it into the
atlas, and commit the prompt spec with it so the art can be regenerated or moved to another model.

## Step 7: Drop approved symbols into the atlas

The atlas cells are 256×256 and the placeholder art fills each cell: tall pieces (skewers) touch the
top and bottom, wide pieces touch the left and right, everything centred. `art:symbols` does the same
fitting for AI art, so a result can go straight into the game.

1. Get background-removed images (the `--dry-run` output tells you which models need a cutout pass).
2. List them in `games/game-001/theme/symbols.json`, frame name to link or file path:
   `{ "sym_H1": "https://.../h1.png", "sym_L1": "theme/source/sym_L1.png" }`
3. One-time: `npm install` (it adds the `sharp` image library).
4. Run `npm run art:symbols -- games/game-001`. It downloads each image (and keeps a copy in
   `theme/source/`, because fal links expire), trims it, fits it into 256×256 and writes:
   - `games/game-001/theme/symbols/sym_H1.png` ... single frames
   - `games/game-001/theme/atlas/fishball.png` + `fishball.plist` the atlas, same layout and frame names
   Frames you didn't list stay as they are in the current atlas.
5. Happy with it? Add `--install` to copy the two atlas files into
   `client-cocos/assets/resources/atlas/` (this overwrites the current atlas; `git diff`/`git checkout`
   can undo it). Then rebuild/refresh in Cocos.

## Windows notes

- **"running scripts is disabled on this system"** (PowerShell blocks `npm`): either use `npm.cmd` instead of
  `npm` in every command, or run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- Paths in commands start with `games/`, never `/games/` (a leading slash means the drive root).
- **"unable to open for write ... Invalid argument"** when building the atlas: the PNG is open in an image
  viewer, a VS Code tab or Cocos. Close it and run the command again.
- Open PowerShell in the repo: File Explorer, click the folder's address bar, type `powershell`, Enter.

## The fal connector (optional, for experiments in Claude chat)

The API key + script above is the production route. The connector lets Claude call fal directly in a chat:
Claude settings, Connectors, add custom connector `https://mcp.fal.ai/mcp-relay`, leave the defaults
("Sign in now", "Use Claude's published identity", no headers), scroll down in the dialog to the Add button,
and sign in with your fal account. Claude can then price, run and show images, but cloud sessions cannot download
them to your PC (fal image links expire), so images still reach the game through `npm run art:symbols`.

## Troubleshooting

| Message | Fix |
|---|---|
| `FAL_KEY is not set` | Step 2. With `setx`, reopen the terminal. |
| `submit failed (401/403)` | Key wrong or deleted; make a new one. |
| `submit failed (402)` or balance error | Add credit in fal Billing. |
| `submit failed (422)` | The model rejected a parameter: run `--dry-run`, compare with the model's `/api` page on fal.ai, fix `tools/imagegen/adapters.ts`. |
| Text misspelled | Switch to `ideogram-v3` or `gpt-image-2`; spell the word letter by letter in `text`. |
| White halo around a cutout | Ask for "a clean edge" (already in the rule) or use `gpt-image-2` for native transparency. |

## Adding another model later

1. Find its endpoint and fields on `https://fal.ai/models/<endpoint>/api`.
2. Copy the closest entry in `tools/imagegen/adapters.ts`, change endpoint, size mode and flags.
3. Add a row to `.claude/skills/image-prompting/references/adapters.md`.
4. `npm test`, then `--dry-run --model <new key>`.

A non-fal provider (OpenAI direct, a local ComfyUI) needs its own client next to `falClient.ts`;
the spec and prompt builder stay the same.
