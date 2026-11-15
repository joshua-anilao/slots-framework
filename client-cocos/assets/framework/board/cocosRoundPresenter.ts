import { DEFAULT_WIN_TIERS, Pace, STRINGS, StateMachine, money, winTierFor } from '../../shared/game-logic/index';
import type { IRoundPresenter, SpeedMode, SpinResponse, WinTierThresholds } from '../../shared/game-logic/index';
import type { GameConfig, SpinOutcome } from '../../shared/math-core/index';
import type { FxLayer } from '../fx/fxLayer';
import type { MultiplierBar } from '../hud/multiplierBar';
import type { TitleBar } from '../hud/titleBar';
import type { WinBox } from '../hud/winBox';
import type { Overlays } from '../overlays/overlays';
import { rowAfterDrop } from './boardView';
import type { BoardView } from './boardView';

/** Plays sounds by name. The game passes its AudioManager.play. */
export type PlaySfx = (name: string, level?: number) => void;

/** Everything the presenter drives besides the board. */
export interface RoundScreen {
  board: BoardView;
  mult: MultiplierBar;
  win: WinBox;
  title: TitleBar;
  overlays: Overlays;
  fx: FxLayer;
}

/**
 * Plays a Spin Result on the Cocos screen. The sequence and normal-speed timing follow the HTML prototype, which
 * follows the reference gameplay video: drop-in spin, scatter anticipation, highlight with the win amount flying to
 * WIN, burst, drop, gold card back to WILD, scatter celebration, free spins intro and outro, big win.
 * Never decides anything; every number comes from the result.
 */
export class CocosRoundPresenter implements IRoundPresenter {
  private readonly pace = new Pace();
  private screen: RoundScreen | undefined;
  private config: () => GameConfig = () => { throw new Error('presenter not attached'); };
  private tiers: WinTierThresholds = DEFAULT_WIN_TIERS;
  private sfx: PlaySfx = () => undefined;
  /** Playback of one round: idle, then spinning (cards drop), then resolving (wins, cascades), then the next spin or idle. */
  private readonly phase = new StateMachine<'idle' | 'spinning' | 'resolving', 'start' | 'landed' | 'end'>('idle', {
    idle: { start: 'spinning', end: 'idle' },
    spinning: { landed: 'resolving', end: 'idle' },
    resolving: { start: 'spinning', end: 'idle' },
  });
  private multValue = 1;
  /** Player tapped the board: the current spin jumps to its final grid and win. */
  private snapRequested = false;

  attach(screen: RoundScreen, config: () => GameConfig, sfx: PlaySfx, tiers: WinTierThresholds = DEFAULT_WIN_TIERS): void {
    this.screen = screen;
    this.config = config;
    this.sfx = sfx;
    this.tiers = tiers;
    const { board, fx } = screen;
    board.hooks = {
      onReelStop: (_r, soFar, here) => { sfx('reelStop'); if (here > 0) sfx('scatter', soFar - 1); },
      onAnticipate: () => sfx('anticipation'),
      onBurst: centres => fx.burst(centres, 6),
    };
  }

  async present(res: SpinResponse, speed: SpeedMode): Promise<void> {
    const s = this.screen;
    if (!s) return;
    const r = res.result;
    const cfg = this.config();
    this.pace.reset(speed);
    let shown = 0;
    s.win.set(0);
    s.win.setNote('');

    if (r.base) shown = await this.playSpin(r.base, shown);

    if (r.freeSpins) {
      const fs = r.freeSpins;
      const initial = fs.awarded - fs.spins.reduce((n, sp) => n + sp.freeSpinsAwarded, 0);
      if (r.base && r.base.scatterCount >= cfg.freeSpins.minScatters) {
        s.board.celebrate(cfg.freeSpins.scatterSymbol);
        this.sfx('fsIntro');
        await this.pace.wait(this.pace.t.scatterCelebrate);
        s.board.endCelebrate();
      }
      this.sfx('fsIntro');
      const ladder = cfg.multiplier.variant === 'A' || cfg.multiplier.variant === 'C' ? cfg.multiplier[cfg.multiplier.variant].free : [];
      await s.overlays.banner(STRINGS.congrats, STRINGS.youWon(initial), this.pace.t.banner, this.pace, ladder.length ? STRINGS.ladderLine(ladder) : '');
      s.title.setFreeSpinsMode(true);
      s.mult.mode(true);
      if (!this.pace.hurry) await s.mult.sweep(Math.min(1400, this.pace.t.banner * 0.6));
      let total = initial;
      s.title.setFreeSpins(total, total);
      for (let i = 0; i < fs.spins.length; i++) {
        s.title.setFreeSpins(total - i - 1, total);
        const spin = fs.spins[i]!;
        shown = await this.playSpin(spin, shown);
        if (spin.freeSpinsAwarded > 0) {
          total += spin.freeSpinsAwarded;
          s.title.setFreeSpins(total - i - 1, total);
          this.sfx('retrigger');
          await s.overlays.banner(STRINGS.retrigger(spin.freeSpinsAwarded), '', this.pace.t.banner * 0.7, this.pace);
        }
      }
      this.sfx('bigWin');
      await s.overlays.countBanner(STRINGS.congrats, STRINGS.youHaveWon, fs.totalWin, this.pace, () => this.sfx('coin'));
      s.title.setFreeSpinsMode(false);
    }

    s.mult.mode(false); // ladder back to the first step for the next round
    s.win.set(r.totalWin);
    if (r.maxWinReached) s.overlays.toast(STRINGS.maxWin, 2500);
    const tier = winTierFor(r.winX, this.tiers);
    if (tier !== 'none' && !r.freeSpins) {
      this.sfx('bigWin', ['big', 'super', 'ultra'].indexOf(tier));
      await s.overlays.bigWin(r.totalWin, r.bet, this.tiers, tier, this.pace, () => this.sfx('coin'));
    }
    this.phase.send('end');
  }

  /**
   * Tap during playback: a banner or big win closes / finishes its count-up; otherwise the current spin
   * (base or one free spin) snaps straight to its final grid and win.
   */
  skip(): void {
    const s = this.screen;
    if (!s) return;
    if (s.overlays.busy) { s.overlays.skip(); return; }
    if (this.phase.is('idle')) return;
    this.snapRequested = true;
    s.board.slam();
    s.board.finishAll();
    s.fx.clear();
    this.pace.cancelWaits();
  }

  /** Lights the multiplier step; on a step up, plays a rising sound and a burst that grows with the step. */
  private setMultiplier(value: number): void {
    const s = this.screen!;
    const up = value > this.multValue && this.multValue > 0;
    this.multValue = value;
    s.mult.set(value);
    if (!up) return;
    const level = s.mult.levelOf(value);
    this.sfx('multUp', level);
    s.fx.burst([s.mult.litWorld()], 10 + level * 6, ['#fff3b0', '#ffd36b', '#ffffff']);
  }

  private async playSpin(spin: SpinOutcome, shownBefore: number): Promise<number> {
    const s = this.screen!;
    const cfg = this.config();
    let shown = shownBefore;
    const steps = spin.steps;
    if (!steps.length || !steps[0]!.grid) return shown + spin.spinWin;
    this.snapRequested = false;
    this.phase.send('start');
    this.multValue = 0;
    this.setMultiplier(steps[0]!.multiplier);
    s.board.showSpots(undefined);
    this.sfx('spin');
    await s.board.spin(steps[0]!.grid!, this.pace);
    this.phase.send('landed');

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      if (this.snapRequested) return this.snapToEnd(spin, shownBefore);
      if (!step.wins.length) break;
      this.setMultiplier(step.multiplier);
      const t = this.pace.t;
      // 1. Winning cards glow, the rest dim; the win pops up and flies to the WIN box.
      const winPos = step.wins.flatMap(w => w.positions);
      s.board.highlight(winPos);
      this.sfx('win', Math.min(i, 6));
      shown += step.stepWin;
      const base = step.wins.reduce((n, w) => n + w.baseWin, 0);
      s.win.setNote(step.multiplier > 1 ? `${money(base)} × ${step.multiplier}` : '');
      await this.showStepWin(step.stepWin, shown, t.highlight);
      // 2. Winning cards burst; winning gold cards flip to their back instead.
      this.sfx('pop');
      await Promise.all([s.board.pop(step.removed, this.pace), s.board.flipToBack(step.toWild, this.pace)]);
      // 3. Cards drop into the gaps (gold cards still face down), then flip to WILD.
      const next = steps[i + 1];
      const backs = step.toWild.map(p => ({ reel: p.reel, row: rowAfterDrop(p, step.removed) }));
      if (next?.grid) await s.board.drop(next.grid, step.removed, this.pace, backs);
      if (backs.length) {
        this.sfx('toWild');
        await s.board.revealWild(backs, cfg.wildSymbol, this.pace);
      }
      s.board.showSpots(step.spots);
      await this.pace.wait(this.pace.t.stepPause);
    }
    if (this.snapRequested) return this.snapToEnd(spin, shownBefore);
    s.board.clearMarks();
    s.win.setNote('');
    return shown;
  }

  /** Shows the end state of a spin at once: final grid, final multiplier, full win. */
  private snapToEnd(spin: SpinOutcome, shownBefore: number): number {
    const s = this.screen!;
    this.snapRequested = false;
    const steps = spin.steps;
    const last = steps[steps.length - 1]!;
    s.board.finishAll();
    s.fx.clear();
    s.board.clearMarks();
    if (last.grid) s.board.setGrid(last.grid);
    const spotsStep = [...steps].reverse().find(st => st.spots);
    s.board.showSpots(spotsStep?.spots);
    this.multValue = last.multiplier;
    s.mult.set(last.multiplier);
    const shown = shownBefore + spin.spinWin;
    s.win.set(shown);
    s.win.setNote('');
    return shown;
  }

  /** The step's win pops over the board, flies to the WIN box, then the WIN box updates. */
  private async showStepWin(stepWin: number, newTotal: number, highlightMs: number): Promise<void> {
    const s = this.screen!;
    if (highlightMs < 300 || this.pace.hurry) {
      s.win.set(newTotal, (highlightMs * 0.8) / 1000);
      await this.pace.wait(highlightMs);
      return;
    }
    const popMs = Math.round(highlightMs * 0.75);
    const flyMs = Math.round(highlightMs * 0.22);
    const landed = s.fx.flyWin(money(stepWin), s.board.centerWorld, s.win.worldPos, popMs / 1000, flyMs / 1000, this.multValue > 1)
      .then(() => { s.win.raise(newTotal, 0.25); s.win.bump(); });
    await Promise.race([landed, this.pace.wait(highlightMs + 200)]);
    await landed;
  }
}
