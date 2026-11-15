# Hand-off format

Every file in a run folder (`.pipeline/runs/<run-id>/`) uses this format. Write only your own file.

## Header (every file)
```
# <File title> — <run title>
Run: <run id> · Agent: <agent> · Date: <YYYY-MM-DD>
Status: Ready | Blocked | Partial
Summary: <one sentence>
```

## Files in a run
| File | Written by | Sections |
|---|---|---|
| `00-request.md` | conductor | Josh's request verbatim, lane, parent run if `/iterate` |
| `01-spec.md` | planner | Goal · Acceptance criteria (numbered, testable) · Where it lands (framework / game, exact folders, feature number) · Interface sketch · Config and defaults (new `docs/TUNING.md` rows) · Events and state machine changes · Math impact (none / needs sim) · Edge cases · Out of scope · Open questions (each **Blocking** or **Non-blocking, default: …**) · last line `Test scope: FULL` or `Test scope: RELATED (<test files>)` |
| `01-triage.md` | triager | `QUICK` or `ESCALATE` · Repro (seed + steps, where seen) · Likely cause (file:line) · Fix in ≤ 3 steps · Regression test |
| `02-implementation.md` | coder | What changed per file · How each acceptance criterion is met · Commands run and results (`npm.cmd run check`, sim if math) · `sync:cocos` run? · Deviations from spec (with why) · Play check |
| `03-tests.md` | tester | One test per criterion (name → criterion) · Edge cases (empty, zero, max, repeated, out-of-order, cleanup) · Sim result if math changed · last line `TESTS: <passed>/<total>` |
| `04-review.md` | reviewer | `VERDICT: PASS` or `CHANGES_NEEDED` · Must fix (file:line, why, fix) · Should fix · Good · Suggested commit message. No tests run = CHANGES_NEEDED |
| `process-feedback.md` | conductor | Each agent's Process feedback, merged |

## Process feedback (end of every agent reply)
```
## Process feedback
- Slowed me down: …
- Missing or unclear: …
- One suggestion: …
```

## Final report to Josh (end of a run), in this order
1. **Outcome** in one line.
2. **Commit message**
   ```
   ADDED|UPDATED|FIXED: <one-line summary, ~50 chars>
   - <change, lowercase verb, ~70 chars>
   - <2–6 bullets, no trailing period>
   ```
3. **Items to commit**: exact paths; what to leave out; unrelated changed files flagged.
4. **How to check**: commands with expected counts; what to click; **Play check** list for anything visual or audible (open in Creator preview or the prototype).
5. **Waiting on Josh**: open gates, if any.
6. `Prompt rating: N/10` plus one fix for the instructions given.
7. Reminder: commit before the next run.

Show a rough time estimate (labelled a guess) on each step of a progress list.
