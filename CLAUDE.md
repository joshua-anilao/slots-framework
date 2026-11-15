# Slots Framework: rules for Claude

Read before working in this repo: `FRAMEWORK_SPEC.md`, `PLAN.md`, `guides/` (and `games/<id>/guides/` overrides for a game), `docs/SCREENS_AND_FEATURES.md` (feature numbers are permanent).

## Layout
- `packages/math-core`: engine, pure TS, no DOM/Node/Cocos imports.
- `packages/game-logic`: Models + Controllers + service interfaces (shared by HTML prototype and Cocos).
- `packages/simulator`: `npm run sim -- games/<id>`.
- `games/<id>/`: `game.json`, `strip-weights.json`, `brief.md`, `reports/`.
- `tools/`: `build-strips.ts`, `quick-sim.ts` (tuning helpers); `imagegen/` (fal.ai art generation, `npm run art:gen`).
- Art generation: follow the `image-prompting` skill (`.claude/skills/image-prompting/`); setup in `docs/FAL_AI_SETUP.md`, step-by-step flow in `docs/ART_WORKFLOW.md` (`npm run art:gen`, then `npm run art:symbols`). Never read, print or commit `FAL_KEY`. Josh is on Windows PowerShell: give `npm.cmd` commands and paths like `games/game-001/...`.

## Commands
- `npm install`, `npm test`, `npm run typecheck`, `npm run check` (both).
- `npm run sim -- games/game-001 --spins 10000000` before handing over any math change.

## Rules
- SOLID + MVC; readability for a mid-level dev wins any tie. No magic numbers: config.
- The client never decides outcomes; views only play back `RoundResult`.
- Debug overrides are session only; never write them into `game.json` without Josh's OK.
- Claude never commits. Each hand-off ends with: commit message, files to commit, how to check.
- Update the Work Status page (https://claude.ai/artifact/BLhH8DVsHFymfQE6jf38bH) at each step, hand-off and blocker.
- Art log: after generating images or when Josh decides something about art, use the `art-log` agent (`agents/art-log.md`, copy to `.claude/agents/`) or `npm run art:log` to record prompt, model, seed, cost, decision, why and thumbnails in `games/<id>/theme/art-log/LOG.md`.
