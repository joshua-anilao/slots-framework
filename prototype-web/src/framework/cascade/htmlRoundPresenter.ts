import { DEFAULT_WIN_TIERS, StateMachine, winTierFor } from '@slots/game-logic';
import type { IRoundPresenter, SpeedMode, SpinResponse, WinTierThresholds } from '@slots/game-logic';
import type { CascadeStep, GameConfig, RoundResult, SpinOutcome } from '@slots/math-core';
import { audio } from '../core/audio';
import { Pace } from '../core/pace';
import { money, STRINGS } from '../strings';
import { GOLD_BANK_FX } from '../views/bankPot';
import { MULT_REVEAL_FX } from '../views/fx';
import type { FxLayer } from '../views/fx';
import type { HudView } from '../views/hudView';
import type { Overlays } from '../views/overlays';
import { rowAfterDrop } from './reelsView';
import type { ReelsView } from './reelsView';

/** Moments of a round that other views (the character) may react to. Sent only after the thing has happened on screen. */
export type PresenterCue =
  | { kind: 'baseLanded'; result: RoundResult }
  | { kind: 'freeSpinsStart' }
  | { kind: 'freeSpinsEnd' };

/**
 * Plays a Spin Result on the HTML screen. The sequence and normal-speed timing follow the
 * reference gameplay video: drop-in spin, spotlight anticipation, highlight with the win
 * amount, burst, drop, gold card back → WILD, scatter celebration, free spins intro/outro.
 * Never decides anything; every number comes from the result.
 */
export class HtmlRoundPresenter implements IRoundPresenter {
  private pace = new Pace();
  /** Playback of one round: idle → spinning (cards drop) → resolving (wins, cascades) → next spin or idle. */
  private readonly phase = new StateMachine<'idle' | 'spinning' | 'resolving', 'start' | 'landed' | 'end'>('idle', {
    idle: { start: 'spinning', end: 'idle' },
    spinning: { landed: 'resolving', end: 'idle' },
    resolving: { start: 'spinning', end: 'idle' },
  });
  private multValue = 1;
  /** Player tapped the board: the current spin jumps to its final grid and win. */
  private snapRequested = false;
  /** Set by the owner of the screen (same pattern as `reels.onAnticipate`). */
  onCue: (cue: PresenterCue) => void = () => {};

  constructor(
    private readonly reels: ReelsView,
    private readonly hud: HudView,
    private readonly overlays: Overlays,
    private readonly fx: FxLayer,
    private readonly config: () => GameConfig,
    private readonly tiers: WinTierThresholds = DEFAULT_WIN_TIERS,
  ) {
    reels.onReelStop = (_r, soFar, here) => {
      audio.play('reelStop');
      if (here > 0) audio.play('scatter', soFar - 1);
    };
    reels.onAnticipate = () => audio.play('anticipation');
  }

  async present(res: SpinResponse, speed: SpeedMode): Promise<void> {
    const r = res.result;
    const cfg = this.config();
    this.pace.reset(speed);
    let shown = 0;
    this.hud.win.set(0);

    if (r.base) shown = await this.playSpin(r.base, shown, () => this.onCue({ kind: 'baseLanded', result: r }));

    if (r.freeSpins) {
      const fs = r.freeSpins;
      const initial = fs.awarded - fs.spins.reduce((n, sp) => n + sp.freeSpinsAwarded, 0);
      let startCued = false;
      const cueStart = () => { if (!startCued) { startCued = true; this.onCue({ kind: 'freeSpinsStart' }); } };
      if (r.base && r.base.scatterCount >= cfg.freeSpins.minScatters) {
        cueStart();
        this.reels.celebrate(cfg.freeSpins.scatterSymbol);
        audio.play('fsIntro');
        await this.pace.wait(this.pace.t.scatterCelebrate);
        this.reels.endCelebrate();
      }
      cueStart(); // a bought bonus has no base spin: the character starts at the intro banner
      audio.play('fsIntro');
      const ladder = cfg.multiplier.variant === 'A' || cfg.multiplier.variant === 'C' ? cfg.multiplier[cfg.multiplier.variant].free : [];
      await this.overlays.banner(STRINGS.congrats, STRINGS.youWon(initial), this.pace.t.banner, this.pace, 'fs-intro',
        ladder.length ? STRINGS.ladderLine(ladder) : '');
      document.body.classList.add('fs');
      this.hud.mult.mode(true);
      if (!this.pace.hurry) await this.hud.mult.sweep(Math.min(1400, this.pace.t.banner * 0.6));
      let total = initial;
      this.hud.setFreeSpins(total, total);
      for (let i = 0; i < fs.spins.length; i++) {
        this.hud.setFreeSpins(total - i - 1, total);
        const spin = fs.spins[i];
        shown = await this.playSpin(spin, shown);
        if (spin.freeSpinsAwarded > 0) {
          total += spin.freeSpinsAwarded;
          this.hud.setFreeSpins(total - i - 1, total);
          audio.play('retrigger');
          await this.overlays.banner(STRINGS.retrigger(spin.freeSpinsAwarded), '', this.pace.t.banner * 0.7, this.pace, 'retrigger');
        }
      }
      audio.play('bigWin');
      await this.overlays.countBanner(STRINGS.congrats, STRINGS.youHaveWon, fs.totalWin, this.pace, () => audio.play('coin'));
      document.body.classList.remove('fs');
      this.onCue({ kind: 'freeSpinsEnd' });
    }

    this.hud.mult.mode(false); // ladder back to the first step for the next round
    this.hud.pot.hide();
    this.hud.win.set(r.totalWin);
    if (r.maxWinReached) this.overlays.toast(STRINGS.maxWin, 2500);
    const tier = winTierFor(r.winX, this.tiers);
    if (tier !== 'none' && !r.freeSpins) {
      audio.play('bigWin', ['big', 'super', 'ultra'].indexOf(tier));
      await this.overlays.bigWin(r.totalWin, r.bet, this.tiers, tier, this.pace, () => audio.play('coin'));
    }
    this.phase.send('end');
  }

  /**
   * Tap during playback: a banner or big win closes / finishes its count-up; otherwise the
   * current spin (base or one free spin) snaps straight to its final grid and win.
   */
  skip(): void {
    if (this.overlays.busy) { this.overlays.skip(); return; }
    if (this.phase.is('idle')) return;
    this.snapRequested = true;
    this.reels.slam();
    this.reels.finishAll();
    this.fx.clear();
    this.pace.cancelWaits();
  }

  /** Lights the multiplier step (`value` is the ladder part, `bank` the gold bank added); on a step up, plays a rising sound and a burst that grows with the step. */
  private setMultiplier(value: number, bank = 0, pulse = false): void {
    const up = value > this.multValue && this.multValue > 0;
    this.multValue = value;
    this.hud.mult.set(value, bank, pulse ? GOLD_BANK_FX.bankPulseMs[this.fxMode()] : 0);
    if (!up) return;
    const level = this.hud.mult.levelOf(value);
    audio.play('multUp', level);
    const on = this.hud.mult.root.querySelector('.on');
    if (on) {
      const c = this.fx.centerOf(on);
      this.fx.burst(c.x, c.y, 10 + level * 8);
    }
  }

  private async playSpin(spin: SpinOutcome, shownBefore: number, onLanded?: () => void): Promise<number> {
    const cfg = this.config();
    let shown = shownBefore;
    const steps = spin.steps;
    if (!steps.length || !steps[0].grid) return shown + spin.spinWin;
    this.snapRequested = false;
    this.phase.send('start');
    this.multValue = 0;
    this.setMultiplier(ladderPart(steps[0]), steps[0].bank ?? 0);
    this.hud.pot.set(steps[0].bank ?? 0); // reset mode: empty every spin; carry mode: keeps its value
    this.reels.showSpots(undefined);
    audio.play('spin');
    await this.reels.spin(steps[0].grid, this.pace);
    this.phase.send('landed');
    onLanded?.();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (this.snapRequested) return this.snapToEnd(spin, shownBefore);
      if (!step.wins.length) break;
      this.setMultiplier(ladderPart(step), step.bank ?? 0, true);
      const t = this.pace.t;
      // 1. Winning cards glow, the rest dim; the win pops up and flies to the WIN box.
      const winPos = step.wins.flatMap(w => w.positions);
      this.reels.highlight(winPos);
      audio.play('win', Math.min(i, 6));
      shown += step.stepWin;
      const base = step.wins.reduce((n, w) => n + w.baseWin, 0);
      await this.showStepWin(step, shown, t.highlight, base);
      // 2. Winning cards burst; winning gold cards flip to their back instead.
      audio.play('pop');
      for (const p of step.removed) {
        const c = this.fx.centerOf(this.reels.cellEl(p));
        this.fx.burst(c.x, c.y, 6, ['#fff6c8', '#f5c542', '#ffffff']);
      }
      const next = steps[i + 1];
      await Promise.all([this.reels.pop(step.removed, this.pace), this.reels.flipToBack(step.toWild, this.pace), this.bankCoins(step, next)]);
      // 3. Cards drop into the gaps (gold cards still face down), then flip to WILD.
      const backs = step.toWild.map(p => ({ reel: p.reel, row: rowAfterDrop(p, step.removed) }));
      if (next?.grid) await this.reels.drop(next.grid, step.removed, this.pace, backs);
      if (backs.length) {
        audio.play('toWild');
        await this.reels.revealWild(backs, cfg.wildSymbol, this.pace);
      }
      this.reels.showSpots(step.spots);
      await this.pace.wait(this.pace.t.stepPause);
    }
    if (this.snapRequested) return this.snapToEnd(spin, shownBefore);
    this.reels.clearMarks();
    return shown;
  }

  /** Shows the end state of a spin at once: final grid, final multiplier, full win. */
  private snapToEnd(spin: SpinOutcome, shownBefore: number): number {
    this.snapRequested = false;
    const steps = spin.steps;
    const last = steps[steps.length - 1];
    this.reels.finishAll();
    this.fx.clear();
    this.reels.clearMarks();
    if (last.grid) this.reels.setGrid(last.grid);
    const spotsStep = [...steps].reverse().find(s => s.spots);
    this.reels.showSpots(spotsStep?.spots);
    this.multValue = ladderPart(last);
    this.hud.mult.set(ladderPart(last), last.bank ?? 0);
    this.hud.pot.set(bankAfter(last));
    const shown = shownBefore + spin.spinWin;
    this.hud.win.set(shown);
    return shown;
  }

  /** Gold bank: each banked card's coin leaves its card and flies to the pot, then the pot ticks up to its new value. */
  private async bankCoins(step: CascadeStep, next: CascadeStep | undefined): Promise<void> {
    const banked = step.banked ?? [];
    if (!banked.length) return;
    const mode = this.fxMode();
    const to = this.fx.centerOf(this.hud.pot.root);
    const flights = banked.map(b => {
      const coin = this.reels.badgeEl(b.pos);
      const from = this.fx.centerOf(coin ?? this.reels.cellEl(b.pos));
      this.reels.takeBadge(b.pos);
      return this.fx.flyCoin(`+${b.value}`, from, to, GOLD_BANK_FX.coinFlyMs[mode]);
    });
    await Promise.all(flights);
    await this.hud.pot.tickTo(next ? next.bank ?? 0 : bankAfter(step), GOLD_BANK_FX.potTickMs[mode], GOLD_BANK_FX.bankPulseMs[mode]);
  }

  /** Which column of the prototype-only timing tables applies: hurry (auto spin) counts as super. */
  private fxMode(): SpeedMode {
    return this.pace.hurry ? 'super' : this.pace.speed;
  }

  /** The step's win pops over the winning cards, flies to the WIN box, then the WIN box updates. */
  private async showStepWin(step: CascadeStep, newTotal: number, highlightMs: number, base: number): Promise<void> {
    if (highlightMs < 300 || this.pace.hurry) {
      this.hud.win.set(newTotal, highlightMs * 0.8);
      await this.pace.wait(highlightMs);
      return;
    }
    // Josh: the amount appears only in the centre of the board, big; it grows, slowly settles back, then flies to WIN.
    const from = this.fx.centerOf(this.reels.root);
    const to = this.fx.centerOf(this.hud.win.valueEl);
    const popMs = Math.round(highlightMs * 0.75);
    const flyMs = Math.round(highlightMs * 0.22);
    const mode = this.fxMode();
    const multFlyMs = MULT_REVEAL_FX.multFlyMs[mode];
    const punchMs = MULT_REVEAL_FX.punchMs[mode];
    const reveal = step.multiplier > 1 && multFlyMs > 0 && punchMs > 0;
    const onLanded = () => { this.hud.win.raise(newTotal, 250); this.hud.win.bump(); };
    let landed: Promise<void>;
    let totalMs = popMs + flyMs + 60;
    if (reveal) {
      // The base prize pops, the multiplier flies into it, the amount punches to the multiplied prize, then flies to WIN.
      const lit = this.hud.mult.root.querySelector('.on') ?? this.hud.mult.root; // variant D has no lit step
      landed = this.fx.revealWin({
        baseText: money(base), finalText: money(step.stepWin), tagText: `x${step.multiplier}`,
        at: from, tagFrom: this.fx.centerOf(lit), to, popMs, multFlyMs, punchMs, punchScale: MULT_REVEAL_FX.punchScale, flyMs,
        onTagLanded: () => { audio.play('multUp', this.hud.mult.levelOf(ladderPart(step))); },
      }).then(onLanded);
      totalMs += multFlyMs + punchMs;
      setTimeout(() => audio.play('fly'), popMs + multFlyMs + punchMs);
    } else {
      landed = this.fx.flyWin(money(step.stepWin), from, to, popMs, flyMs, this.multValue > 1).then(onLanded);
      setTimeout(() => audio.play('fly'), popMs);
    }
    await Promise.race([landed, this.pace.wait(totalMs)]);
  }
}

/** The ladder part of a step's multiplier: the multiplier minus the gold bank that was added to it. */
function ladderPart(step: CascadeStep): number {
  return step.multiplier - (step.bank ?? 0);
}

/** The bank once this step's banked badges are in. */
function bankAfter(step: CascadeStep): number {
  return (step.bank ?? 0) + (step.banked ?? []).reduce((n, b) => n + b.value, 0);
}
