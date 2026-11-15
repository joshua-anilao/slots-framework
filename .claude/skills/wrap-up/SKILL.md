---
name: wrap-up
description: End-of-session wrap-up for the Slots Framework. Saves what was learned and decided to memory, updates related project skills, and runs a short efficiency retro on how the session could have used fewer tokens. Use when the user runs /wrap-up or says they're ending, closing, or restarting the session.
disable-model-invocation: true
---

# Session Wrap-up

The user is upskilling toward Senior/Lead level over many sessions on this project. The next session starts cold, with only memory and skills, so this wrap-up is what makes learning carry over. Keep the final report short: the user has repeatedly asked for concise answers.

## 1. Gather from this session

Scan the conversation and note:
- **Decisions** the user made, and their reasons: architecture, naming, patterns chosen *or* deliberately deferred (e.g. "if/else until a third movement").
- **Concepts covered.** These are things not to re-teach. Note where the user needed more than one explanation, since that marks a weak spot or an explanation that didn't land.
- **Open items:** known bugs, unfinished refactors, unanswered mentoring questions.
- **Feedback on how I worked:** corrections ("too long", "that method doesn't exist") and approaches the user confirmed worked.

## 2. Verify before saving

The user edits code live, so check every code claim against the current files first: run `git status`, then grep for the names. Never save a method or field name you haven't just seen in the code. If an open item was fixed during the session, drop it instead of saving it.

## 3. Update memory

Memory lives in this project's Claude Code memory folder (`MEMORY.md` lists the files). **Update existing files before creating new ones**: one file per subject (game decisions, framework conventions, how Josh wants to work, pipeline lessons). Game decisions with dates also go in `games/<id>/brief.md`, framework decisions in the `FRAMEWORK_SPEC.md` decisions log.

Rules:
- Rewrite outdated lines instead of only appending. Each file should read as the current truth.
- Dates are absolute (YYYY-MM-DD).
- Don't save what the code or git history already records. Save the *why* and the *what's next*.
- Create a new file only for a genuinely new topic, and add a one-line pointer to `MEMORY.md`.

## 4. Update related skills

Check whether this session's feedback should change a project skill in `.claude/skills/` (e.g. `bug-check`, `slots-verify`). Examples: the user disliked a review format, a convention changed, or a new project decision should be checked in future reviews. Make small, targeted edits. Don't edit a skill for a one-off.

## 5. Efficiency retro

Look for where tokens or round-trips were wasted. Common patterns in this project:
- **Long answers the user had to ask to shorten**, or answers that included tables and side tips nobody asked for.
- **The same concept asked about 2–3 times.** The first explanation probably lacked a concrete numeric example.
- **Stale names.** Code that referenced functions that no longer existed, which forced a re-do.
- **Expensive reads:** large files (`game.json` reel strips, `par-sheet.csv`, `client-cocos/library/`, logs) or whole files when a grep would have done. Reading the same file several times without it changing.
- **Sequential tool calls that could have run in parallel.**
- **Long questions the user never answered**, so the effort was wasted.
- **Editor collisions:** a Cocos CLI build tried while Creator was open, edits to `assets/shared/` lost on the next `sync:cocos`, loose-mode traps (see the `slots-verify` skill).
- **Slow sims:** 10M sims run in the foreground or repeated while tuning when a 1M sim would do.
- **Tool friction:** inline eval or shell quoting that broke and had to be redone.
- **Misread asks:** an ambiguous UI name acted on without a one-line confirm, then reverted.

Pick the **top 3** with the biggest impact. Save any lesson that should change future behavior to the matching `feedback_*.md` memory.

## 6. Report

Reply in this shape, and keep it to about 15 lines:

```
## Session wrap-up

**Saved**
- <file>: <what changed, one line each>

**Skills updated**
- <skill>: <change>, or "none"

**Efficiency — next time**
1. <specific lesson>
2. ...
3. ...

**Next session starts with**
- <the 1–3 most relevant open items>
```
