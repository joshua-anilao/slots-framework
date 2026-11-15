---
description: Quick implement for small bug fixes — triage → coder (compiles + runs existing tests) → reviewer, one fix loop. Escalates to /feature if the change isn't small.
argument-hint: <the bug or small change: what happens, what should happen, where>
---
Quick implement:

$ARGUMENTS

Follow `.pipeline/PIPELINE.md`. `P` = `node .pipeline/tools/pipeline.mjs`.

1. `P start --type quick --title "<short title>" --request "<request>"`. Pass `--run <RUN_ID>` to every later `P` command. Write the request to `00-request.md`.
2. **triager** (read-only) → save its reply as `01-triage.md`.
   - **ESCALATE**: `P gate --question "Not a quick fix: <reason>. Switch to /feature, run quick anyway, or cancel?"`. Switch → finish as cancelled and give the `/feature` request from the triage, ending with "Triage notes: `.pipeline/runs/<RUN_ID>/01-triage.md`" so the planner starts from it instead of exploring again. Run anyway → continue. Cancel → finish as cancelled.
   - **Anomalies** listed: mention them to the person in one line while continuing (no gate unless they are blocking).
3. **coder** → tell it: "Fix run. `01-triage.md` is your spec. Make the smallest change that fixes it. Then typecheck, run the existing test files named in the triage, add the regression test it names, and run `npm run sync:cocos` if a package changed. Record files changed and test results (`TESTS: <passed>/<total>`) in `02-implementation.md`."
4. `P diff`, then **reviewer** (read-only) → tell it: "Fix run: judge against `01-triage.md` instead of a spec. Also check the change is minimal and nothing unrelated was touched." Save as `04-review.md`.
5. `CHANGES_NEEDED` → one fix loop only: `P stage --name coder --status running --loop 1`, coder fixes the Must-fix items, `P diff`, reviewer again (`04-review-loop1.md`). Still failing → finish as failed and suggest `/feature`.
6. `PASS` → `P diff` again if code changed since, then `P finish --summary "<what was fixed>"` and give the final message from `PIPELINE.md`: commit message, the files from `changes.json`, how to check.
