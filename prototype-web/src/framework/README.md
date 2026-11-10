# framework/ (reusable pieces)

Rule: nothing in here imports from `../game/`. A game plugs these in from `main.ts`.
Ask Josh before adding anything new here (see the Programming Guide, framework vs game).

| Piece | File | What it does | How a game plugs it in |
|---|---|---|---|
| DOM helper | `core/dom.ts` | `el()` builds elements, `fitText()` shrinks text to fit | import and use |
| Pacing | `core/pace.ts` | Timing table per speed (normal / turbo / super), hurry and cancel | create a `Pace`, read `pace.t.*` (timings per speed in `TIMINGS`) |
| Sound | `core/audio.ts` | `audio.play(name)` (`SoundFx`, Web Audio tones) | call `audio.play` from presenters |
| Player settings | `core/settings.ts` | Saved settings (sound, vibration, speed) | `loadSettings()` / `saveSettings()` / `buzz()` |
| Text | `strings.ts` | Every player-facing string, plus `money()` | edit or replace per game |
| Theme | `theme/theme.ts` | `Theme` interface (frame and symbol names) | game supplies one, e.g. `game/theme/placeholderTheme.ts` |
| HUD | `views/hudView.ts` | Balance, bet, win box, spin / AUTO / turbo buttons, `MultiplierBar`, `WinBox`, hold button | `new HudView(...)` then wire the callbacks |
| Effects | `views/fx.ts` | Touch sparkle, bursts, win fly-in | `new FxLayer(...)` |
| Overlays | `views/overlays.ts` | Toast, banner, big win count-up | `new Overlays(...)` |
| Windows | `windows/*.ts` | Modal base, Change Bet, Auto Spin Settings, loading + tutorial, menu / Settings / Rules / History | `Modal`, `openMenu`, `openBetWindow`, `openAutoSpinWindow`, `LoadingScreen` |
| Cascading ways reels | `cascade/reelsView.ts` | The base for cascading games: card drop, near miss, winners pop and sway, new cards fall in, golden to wild | `new ReelsView(...)`, driven by the presenter |
| Round playback | `cascade/htmlRoundPresenter.ts` | Plays a Spin Result step by step (spin, wins, cascades, multiplier steps, free spins, banners, big win); has the playback state machine | pass it to `createLocalGame` as the round presenter |
| Winner notice | `views/winnerNotice.ts` | Notice shown over the multiplier bar | used by the presenter |
| Buy Bonus | `windows/buyBonusWindow.ts` | Buy free spins popup (a game turns it on in its config) | `openBuyBonusWindow(host, game, onBuy)` from a HUD callback |
| Debug panel | `debug/debugPanel.ts` | Session-only overrides (force result, network tools) | `new DebugPanel(...)` when `?debug` is on |

State machines live in `packages/game-logic` (`StateMachine`, used by the spin flow, auto spin and connection) and in `cascade/htmlRoundPresenter.ts` for playback.

The multiplier and cascade rules (ladder, endless, persistent, spots; cascade loop) live in `packages/math-core` (`multipliers.ts`, `slotEngine.ts`), and the bar that shows them is `MultiplierBar` in `views/hudView.ts`.
