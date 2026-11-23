import type { SpeedMode } from '@slots/game-logic';
import { el } from '../core/dom';
import { BANK_LABEL } from '../strings';

/**
 * Gold Frame Bank look timings (ms). Prototype only for now; they move to pace.ts in the Cocos parity drop.
 * Rows in docs/TUNING.md, section "Gold bank look".
 */
export const GOLD_BANK_FX = {
  /** The coin flies from its card to the pot. */
  coinFlyMs: { normal: 450, turbo: 250, super: 0 } as Record<SpeedMode, number>,
  /** The pot counts up to its new value. */
  potTickMs: { normal: 300, turbo: 150, super: 0 } as Record<SpeedMode, number>,
  /** The pot fades in or out (all speeds). */
  potFadeMs: 200,
  /** Pot and lit bar step yoyo (scale up and back) when the bank grows. */
  bankPulseMs: { normal: 360, turbo: 240, super: 0 } as Record<SpeedMode, number>,
  /** Peak scale of that yoyo. */
  bankPulseScale: 1.25,
};

/** The bank pot beside the multiplier bar: "BANK +n". Hidden at 0. Only shows the number it is given. */
export class BankPot {
  readonly root = el('div.bank-pot');
  private readonly valueEl = el('span.bank-value');
  private value = 0;
  private raf = 0;
  private finishTick: (() => void) | null = null;

  constructor() {
    this.root.style.transitionDuration = `${GOLD_BANK_FX.potFadeMs}ms`;
    this.root.append(el('span.bank-label', { text: BANK_LABEL }), this.valueEl);
  }

  /** Jumps to a value with no count-up (and ends a running count-up). */
  set(v: number): void {
    this.stopTick();
    this.show(v);
  }

  /** Counts up (or down) to `v` over `ms`, then pulses. Resolves when done, or at once if `set` cuts it short. */
  tickTo(v: number, ms: number, pulseMs = 260): Promise<void> {
    this.stopTick();
    if (ms <= 0 || v === this.value) { this.show(v); return Promise.resolve(); }
    const from = this.value;
    this.root.classList.toggle('show', v > 0 || from > 0);
    return new Promise<void>(resolve => {
      this.finishTick = resolve;
      const t0 = performance.now();
      const step = (now: number): void => {
        const k = Math.min(1, (now - t0) / ms);
        this.print(Math.round(from + (v - from) * k));
        if (k < 1) { this.raf = requestAnimationFrame(step); return; }
        this.finishTick = null;
        this.show(v);
        this.pulse(pulseMs);
        resolve();
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  /** Fades the pot out (end of round). */
  hide(): void { this.set(0); }

  private show(v: number): void {
    this.print(v);
    this.root.classList.toggle('show', v > 0);
  }

  private print(v: number): void {
    this.value = v;
    this.valueEl.textContent = `+${v}`;
  }

  /** Brightness flash plus a scale yoyo. */
  private pulse(ms: number): void {
    if (ms <= 0) return;
    const s = GOLD_BANK_FX.bankPulseScale;
    this.root.animate([
      { filter: 'brightness(1)', transform: 'scale(1)' },
      { filter: 'brightness(1.8)', transform: `scale(${s})`, offset: 0.4 },
      { filter: 'brightness(1)', transform: 'scale(1)' },
    ], { duration: ms, easing: 'ease-out' });
  }

  private stopTick(): void {
    cancelAnimationFrame(this.raf);
    const done = this.finishTick;
    this.finishTick = null;
    done?.();
  }
}
