import type { LocalGame, SpeedMode } from '@slots/game-logic';
import type { GameConfig } from '@slots/math-core';
import { el } from '../core/dom';
import { money, STRINGS } from '../strings';

/** Multiplier bar (feature 6): ladder steps with the current one lit. */
export class MultiplierBar {
  readonly root = el('div.mult-bar');
  private ladder: number[] = [];
  private free = false;

  constructor(private config: () => GameConfig) {}

  /** Shows the base or free spins ladder. */
  mode(free: boolean): void {
    this.free = free;
    const m = this.config().multiplier;
    const v = m.variant;
    this.ladder = v === 'A' || v === 'C' ? (free ? m[v].free : m[v].base) : [];
    this.set(this.ladder[0] ?? (v === 'B' ? (free ? m.B.free.start : m.B.base.start) : 1));
  }

  /** Free spins start: light each ladder step in turn so the player sees the bigger ladder. */
  async sweep(totalMs: number): Promise<void> {
    if (!this.ladder.length) return;
    const per = totalMs / this.ladder.length;
    for (const x of this.ladder) {
      this.set(x);
      await new Promise(r => setTimeout(r, per));
    }
    this.set(this.ladder[0]);
  }

  /** 0 for the first ladder step, 1 for the next... (B: grows with the value). */
  levelOf(value: number): number {
    const i = this.ladder.indexOf(value);
    return i >= 0 ? i : Math.min(6, Math.max(0, Math.round(Math.log2(Math.max(1, value)))));
  }

  set(value: number): void {
    const v = this.config().multiplier.variant;
    if (this.ladder.length) {
      this.root.replaceChildren(...this.ladder.map(x => el(`div.step${x === value ? '.on' : ''}`, { text: `x${x}` })));
    } else if (v === 'B') {
      this.root.replaceChildren(el('div.step.on.wide', { text: `x${value}` }), el('div.note', { text: 'Endless' }));
    } else {
      this.root.replaceChildren(el('div.note', { text: 'Multiplier spots: cells that win twice get x2, x4, x8...' }));
    }
    this.root.classList.toggle('free', this.free);
    const on = this.root.querySelector('.on');
    on?.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'ease-out' });
  }
}

/** Win row: counts up to the running round win. */
export class WinBox {
  readonly root = el('div.win-box');
  readonly valueEl = el('span.win-value', { text: money(0) });
  private stepNote = el('span.step-note');
  private shown = 0;
  private anim = 0;

  constructor() {
    this.root.append(el('span.win-label', { text: STRINGS.win }), this.valueEl, this.stepNote);
  }

  private target = 0;

  /** Only moves up (a late fly-in can't lower a newer total). */
  raise(amount: number, ms = 0): void {
    if (amount > this.target) this.set(amount, ms);
  }

  /** The WIN box pulses when a win lands in it. */
  bump(): void {
    this.root.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)', filter: 'brightness(1.6)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
  }

  set(amount: number, ms = 0): void {
    this.target = amount;
    cancelAnimationFrame(this.anim);
    const from = this.shown;
    if (ms <= 0 || amount <= from) { this.shown = amount; this.valueEl.textContent = money(amount); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      this.shown = from + (amount - from) * k;
      this.valueEl.textContent = money(k >= 1 ? amount : this.shown);
      if (k < 1) this.anim = requestAnimationFrame(tick);
    };
    this.anim = requestAnimationFrame(tick);
  }

  note(text: string): void {
    this.stepNote.textContent = text;
    if (text) this.stepNote.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 180 });
  }
}

export interface HudHandlers {
  onSpin(): void;
  onBet(): void;
  onAuto(): void;
  onTurbo(): void;
  onSettings(): void;
  onBuy(): void;
  onVersionTap(): void;
  onSound(): void;
}

/** Everything around the reels: top bar, header, controls, footer. */
export class HudView {
  readonly top: HTMLElement;
  readonly header: HTMLElement;
  readonly controls: HTMLElement;
  readonly footer: HTMLElement;
  readonly mult: MultiplierBar;
  readonly win = new WinBox();
  private fsLeft = el('span.fs-left', { text: '0' });
  private fsTotal = el('span.fs-total');
  readonly betBtn: HTMLButtonElement;
  private spinBtn: HTMLButtonElement;
  private spinIcon = HudView.arrowIcon();
  private spinAnim: Animation | null = null;
  private speed: SpeedMode = 'normal';
  /** Arrow (and ring) turn faster in turbo and super turbo: one turn per 0.7 s / 0.4 s / 0.22 s. */
  private static readonly ARROW_RATE: Record<SpeedMode, number> = { normal: 1, turbo: 1.75, super: 3.2 };
  private turboBtn: HTMLButtonElement;
  private balance = el('span.bal-value');
  private roundId = el('span.round-id');
  readonly versionEl: HTMLElement;
  readonly soundBtn: HTMLElement;

  constructor(game: LocalGame, private h: HudHandlers, version: string) {
    const cfg = () => game.services.config.config.value;
    this.mult = new MultiplierBar(cfg);
    this.top = el('div.top-bar', {}, [el('div.marquee', {}, [el('span', { text: STRINGS.marquee })])]);
    this.header = el('div.header', {}, [
      el('div.fs-title', {}, [el('span.fs-label', { text: STRINGS.freeSpinsLeftLabel }), el('div.fs-count', {}, [this.fsLeft, this.fsTotal])]),
      el('div.logo', {}, [el('span.logo-main', { text: cfg().name.replace(/\s*\(.*\)\s*/, '').toUpperCase() }), el('span.logo-sub', { text: 'PROTOTYPE' })]),
      el('button.buy-btn', { text: STRINGS.buyBonus, onclick: () => h.onBuy() }),
    ]);
    this.betBtn = el('button.ctl.bet-btn', { onclick: () => h.onBet() }) as HTMLButtonElement;
    this.spinBtn = el('button.spin-btn', { 'aria-label': STRINGS.spin, onclick: () => h.onSpin() },
      [el('span.spin-ring'), el('span.spin-face'), el('span.spin-shine'), this.spinIcon]) as HTMLButtonElement;
    this.turboBtn = el('button.ctl.turbo-btn', { onclick: () => h.onTurbo() }) as HTMLButtonElement;
    this.controls = el('div.controls', {}, [
      el('button.ctl', { onclick: () => h.onSettings() }, [el('span.ic', { text: '☰' }), el('span.lb', { text: 'MENU' })]),
      this.betBtn,
      this.spinBtn,
      el('button.ctl', { onclick: () => h.onAuto() }, [el('span.ic', { text: '↻' }), el('span.lb', { text: STRINGS.auto })]),
      this.turboBtn,
    ]);
    this.soundBtn = el('button.sound-btn', { onclick: () => h.onSound() });
    this.versionEl = el('span.version', { text: `v${version}`, onclick: () => h.onVersionTap() });
    this.footer = el('div.footer', {}, [
      el('div.bal', {}, [el('span.bal-label', { text: STRINGS.balance }), this.balance]),
      el('div.foot-right', {}, [this.soundBtn, el('span.wifi.bars-3', { title: 'Connection' }, [el('i'), el('i'), el('i')]), this.roundId, this.versionEl]),
    ]);

    game.models.wallet.balance.subscribe(v => { this.balance.textContent = money(v); });
    game.models.bet.index.subscribe(() => {
      this.betBtn.replaceChildren(el('span.lb', { text: STRINGS.bet }), el('span.bet-val', { text: money(game.models.bet.bet) }));
    });
    game.models.spin.lastRoundId.subscribe(id => { this.roundId.textContent = id ? `#${id}` : ''; });
    game.models.spin.phase.subscribe(p => {
      this.spinBtn.classList.toggle('spinning', p !== 'idle');
      this.rotateIcon(p !== 'idle');
      this.spinBtn.disabled = p !== 'idle';
      this.betBtn.disabled = p !== 'idle';
    });
    game.models.speed.mode.subscribe(m => this.showSpeed(m));
    this.mult.mode(false);
  }

  /** Circular arrow drawn around the exact centre of the button. */
  private static arrowIcon(): HTMLElement {
    const icon = el('span.spin-icon');
    // Clockwise ring (radius 30 around 50,50) with the arrowhead at its end, pointing the way it turns.
    icon.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">'
      + '<path d="M65 24 A30 30 0 1 1 27 30.7" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>'
      + '<path d="M40.5 17 L37.5 40 L16.5 21.5 Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>';
    return icon;
  }

  /**
   * Spin arrow: turns while a round plays; when it ends it eases forward to its
   * upright starting angle instead of snapping back.
   */
  private rotateIcon(on: boolean): void {
    if (on) {
      if (this.spinAnim) return;
      this.spinAnim = this.spinIcon.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 700, iterations: Infinity });
      this.spinAnim.playbackRate = HudView.ARROW_RATE[this.speed];
      return;
    }
    const a = this.spinAnim;
    if (!a) return;
    this.spinAnim = null;
    const m = new DOMMatrix(getComputedStyle(this.spinIcon).transform === 'none' ? undefined : getComputedStyle(this.spinIcon).transform);
    const deg = (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360;
    a.cancel();
    const rest = 360 - deg;
    this.spinIcon.animate([{ transform: `rotate(${deg}deg)` }, { transform: 'rotate(360deg)' }],
      { duration: Math.max(250, rest / 360 * 900), easing: 'cubic-bezier(.2,.6,.35,1)' });
  }

  /** ▷ normal, ▶ turbo, ▶▶ super turbo: the current speed is always visible on the button. */
  private showSpeed(m: SpeedMode): void {
    this.speed = m;
    if (this.spinAnim) this.spinAnim.playbackRate = HudView.ARROW_RATE[m];
    this.spinBtn.dataset.speed = m;
    this.turboBtn.dataset.mode = m;
    const icon = { normal: '▷', turbo: '▶', super: '▶▶' }[m];
    const label = { normal: 'NORMAL', turbo: 'TURBO', super: 'SUPER' }[m];
    this.turboBtn.replaceChildren(el('span.ic.speed-ic', { text: icon }), el('span.lb', { text: label }));
  }

  showSound(muted: boolean): void {
    this.soundBtn.textContent = muted ? '🔇' : '🔊';
  }

  /** During free spins the game title is replaced by the spins remaining (body.fs). */
  setFreeSpins(left: number, total: number): void {
    const changed = this.fsLeft.textContent !== String(left);
    this.fsLeft.textContent = String(left);
    this.fsTotal.textContent = `/ ${total}`;
    if (changed) this.fsLeft.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
  }

  shakeBet(): void {
    this.betBtn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
      { duration: 300, iterations: 2 });
  }
}
