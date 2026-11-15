---
name: commit-message
description: Draft a commit message for the Slots Framework in the user's format (ADDED / UPDATED / FIXED, then dash bullets). Use when the user runs /commit-message or asks for a commit message.
disable-model-invocation: true
argument-hint: "[optional: 'commit' to also run git commit after approval]"
---

# Commit Message

Draft a commit message from the actual changes, in the user's format. **Draft only.** Never stage or commit unless the user explicitly says to.

## 1. Read the changes

- Run `git status` and `git diff HEAD` (plus `git diff --cached` if anything is staged). Read untracked `.ts`, `.json` and `.md` files too.
- Describe what the code **actually does now**, not what the conversation intended. The user edits live.
- Skip noise in the bullets: Cocos `.meta` files, the generated copy in `client-cocos/assets/shared/` and `assets/game/generated/` (one bullet "sync shared code to cocos" is enough), and sim reports under `games/*/reports/` (one bullet with the new RTP). These files still go in the commit.
- **Flag files that look unrelated** instead of silently including them: `client-cocos/settings/` or `profiles/` that Creator rewrote, `.meta` files with no matching asset change, sim reports from a change that did not touch math, debug-only edits. **Never** include `.env.local` or anything holding `FAL_KEY`. Ask whether the rest belong in this commit.

## 2. Pick the type

Use one type for the whole commit, based on the change that matters most:
- **ADDED**: a new feature, system, script or mechanic.
- **UPDATED**: changes or improvements to existing behavior, refactors, cleanup.
- **FIXED**: the main purpose is correcting bugs.

If the changes really mix two big purposes (e.g. a new feature plus unrelated fixes), suggest splitting them into two commits and say which files go where.

## 3. Format

```
<TYPE>: <one-line summary of the commit, about 50 characters>
- <change 1, concise, starts with a lowercase verb>
- <change 2>
- ...
```

Rules:
- Each bullet is one change, in plain words, ideally under about 70 characters.
- Say **what changed and why it matters**, not line-by-line edits ("golden cards now turn wild after the second cascade too", not "changed applyGolden line 145").
- Use 2–6 bullets. Merge tiny related edits into one.
- No trailing period. No file paths unless they help.

**Example:**
```
FIXED: free spins counter and retrigger
- counter in the title now shows spins left, not spins played
- retrigger adds +2 per extra scatter as the config says
- free spins outro waits for the last cascade to finish
- sync shared code to cocos
```

## 4. Deliver

Show the message in a code block, list any flagged files under it, and stop.

Only if the user asks you to commit (or passed `commit` as the argument and then approves the message):
- Stage only the files that belong in the commit (named paths, not `git add -A`).
- Commit with the message as approved.
- End the commit body with the attribution trailer required by the session's system instructions.
- Show the resulting `git log --oneline -1`.
