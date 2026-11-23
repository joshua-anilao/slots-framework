---
name: game-security-audit
description: Game security audit of the Slots Framework (math-core RNG, wallet, cascades, multipliers, free spins, buy bonus, max-win cap, autoplay, debug forcing, HTML and Cocos clients). Finds cheats, server-authority gaps, economy exploits and exploit chains, ranked by business priority, and says which gaps matter now and which once a real server exists. Use when Josh runs /game-security-audit or asks for a security, cheat or exploit review; the game-security-auditor agent follows this checklist.
argument-hint: "[games/<id> | file | folder | run folder]  (default: games/game-001 and the shared packages)"
---

# Game Security Audit

## How to run
1. Launch the `game-security-auditor` agent with the target (default `games/game-001`). If it says `Agent type not found`, ask Josh to restart Claude Code; never stand in a general-purpose agent.
2. Pass a run folder path if the audit is for one change; the agent then audits `changes.diff` plus everything it touches.
3. Save its reply word for word: inside a run folder as `security-audit.md`, otherwise as `games/<id>/reports/security-audit-<yyyymmdd>.md`.
4. Tell Josh the verdict, the top three findings by business priority, and the file path. Do not fix anything in the same turn; each fix goes through `/quick` or `/feature`.

## Trust model today
The build is a prototype: `LocalSpinService` runs math-core in the browser and `LocalWallet` is an in-memory demo balance. The client being able to change its own balance is expected and is **not** a finding alone. Findings are about (a) breaking the rule "the client never decides outcomes" inside the current code, and (b) seams that will let a modified client cheat once an RGS and operator wallet replace the local services. Mark every finding `now` or `once a server exists`.

## Checklist (slots pitfalls)
Work through each; write "checked, fine" for the ones that hold.

**Outcomes and RNG**
- RNG, win maths, outcome choice or cap logic anywhere outside `packages/math-core` (views, controllers, `prototype-web/`, `client-cocos/assets/`).
- Seed source: `Math.random`, time or round counter seeds; seed visible to or chosen by the client; seed reused across rounds or between free spins.
- `seededRng` used outside tests/sim/debug; modulo bias when mapping RNG to strip stops.
- Debug forcing: `SpinRequest.force` / `ForceOptions` and `applyOverrides` reachable in a non-debug build; a server contract that would accept them; overrides persisted into `game.json`.

**Money and rounds**
- Debit and credit not in one atomic step; balance arithmetic in the client (`LocalWallet.apply`) that a server version would copy.
- Floating point money (rounding drift per round, rounding direction that favours the player).
- No idempotent `roundId`: retry after `ConnectionError` or timeout could debit twice or credit twice; reconnect mid-round could re-roll.
- Concurrent spins (double click, autoplay plus manual, two tabs) before the previous round settles.
- Bet value or bet level not validated against the allowed list; bet changed during cascades or free spins.
- `balanceBefore` / `balanceAfter` taken from the client instead of the wallet.

**Features**
- Buy bonus: price computed or sent by the client, price not matched to the variant's buy RTP, buy allowed with a bet outside limits, buy during free spins.
- Max-win cap: applied per spin instead of per round including all cascades and free spins; applied only in presentation; cap and early feature end not consistent with the paytable disclosure.
- Multipliers: state carried across rounds when it should not; variant A–D selectable by the client in a way a server would honour; a variant or override that pushes RTP over target (check with `npm run sim` / `npm run sim:compare`).
- Free spins: retrigger count or remaining spins held by the client; feature resumable after disconnect with a fresh roll.
- Autoplay: loss limit, single-win limit and spin count enforced only in UI; turbo/skip changing outcome or credit timing.

**Data and operations**
- Secrets in the repo or bundle (`FAL_KEY`, `.env.local`, tokens in `.mcp.json`).
- History and win feed that leak other players' data or trust client-written entries.
- Expensive operations a client could spam (spin, sim, config load) with no rate limit planned.

## Output
Use the exact reply format in `.claude/agents/game-security-auditor.md` (verdict, scope, authority map, findings with technical severity and business priority kept separate, exploit chains, questions checked, good). Never invent money figures; say what data would size the loss. Describe fixes, never working cheat or bot code.
