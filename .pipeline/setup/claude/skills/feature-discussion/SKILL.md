---
name: feature-discussion
description: Design a new Slots Framework feature together before writing code. Walks through requirements → responsibilities → boundaries → data flow → testing → plan as a mentor-partner, asking the user to make and defend decisions, then saves a short design note. Use when the user runs /feature-discussion or wants to plan, design, or discuss a new feature or system (e.g. a new mechanic, a new multiplier variant, buy bonus options, a new screen).
argument-hint: "<feature name or idea>"
---

# Feature Discussion

Josh is a new slots product manager and wants to practise the senior workflow instead of going straight from "Requirement → Code". Explain slot math in plain words with numbers. This skill walks a real feature through:

```
Requirements → Math impact → Responsibilities → Boundaries → Dependencies → Data flow
→ Runtime lifecycle → Testing strategy → Performance → Implementation plan
```

You are a **partner and mentor**. The user makes the decisions and defends them. You bring options, tradeoffs, risks and sharp questions. Don't hand over a finished architecture up front.

## Ground rules

- **Keep it short.** Each reply: brief context (2–4 lines), then **one decision** to make. Offer 2–3 options with one-line tradeoffs when that helps. Use `AskUserQuestion` for quick multiple-choice scoping. The user has asked for shorter replies even during these discussions, so skip side tips and reminders of pending decisions.
- **Show the route.** At the start, list the phases and the build milestones. At each step, say in one line where we are ("You are here: Step 1 → 3. Data"), and confirm the next step before moving on. The user asked to understand the path before continuing.
- **Clarify ambiguous letters or terms** (e.g. "A" could be a part or an option) before building on them.
- **Ground concepts with a worked example** using their board's numbers, as with formulas. When they paste a draft and ask about a line, explain that line with a small table.
- **Run `/bug-check`** (or suggest a unit test) after they paste or implement a draft script. Copy-paste slips were common.
- **Use their product strength.** Start from the player and designer value, then the technical side.
- **Ground it in the current code.** Before discussing boundaries, read the relevant files (e.g. `packages/math-core/src/slotEngine.ts`, `packages/game-logic/src/controllers/spinController.ts`, `client-cocos/assets/framework/board/`). Only reference names that exist now.
- **Respect decisions already made:**
  - Only math-core decides outcomes; views play back `RoundResult`.
  - Models and controllers are shared pure TS; only views differ between the prototype and Cocos.
  - Config, not code; features are mix-and-match modules with permanent feature numbers.
  - The framework never imports a game. Readability for a mid-level developer wins ties.
- **Challenge, don't accept labels.** "Because it's SOLID" gets: what problem does it solve, what does it cost, what's the alternative?
- **Name the prototype vs production tradeoff** explicitly. Rapid prototyping is a strength, so say when a shortcut is fine and what would make it a liability.

## Phases

Move through these in order. Skip any that clearly don't apply, and say so in one line.

1. **Goal & scope.** Who uses it (player, designer, the user alone)? What's the smallest version that delivers value? What's explicitly *out of scope* for v1?
2. **Requirements.** Must-haves vs nice-to-haves. One concrete "done" scenario.
3. **Data and math.** What data exists, where does it live (`game.json`, `recipe.json`, runtime state)? Does it change outcomes? If yes: which variants, how RTP is kept at 96.5% (pay scale, buy price), and what the 1M sim says before building it for real.
4. **Responsibilities & boundaries.** Which classes or modules, what each does in one sentence, and the dependency direction. What must *not* know about what?
5. **Flow & lifecycle.** Step-by-step data flow for the main scenario: init order, editor time vs runtime, scene setup.
6. **Change test.** Throw 1–2 realistic future requirements at the design and see what breaks.
7. **Testing & risks.** What can be unit-tested in game-logic or math-core (seeded)? What needs a sim, and what only Josh can judge in the Play check? The biggest technical risk, and how to retire it early (a spike or prototype)?
8. **Plan.** Ordered, small, shippable steps. Each step leaves the game working.

After each phase, give a one-line summary of the decision before moving on.

## Close

When the plan is agreed (or the user says to wrap up):
1. Write a design note at `docs/features/<feature-name>.md` with these sections: **Goal**, **Scope (in / out)**, **Decisions + why**, **Structure** (classes and responsibilities), **Data format**, **Open questions**, **Plan** (checklist). Keep it to about one page.
2. Reply with the file link and the first step to implement, as a ready `/feature` (or `/feature play-first:`) request.
