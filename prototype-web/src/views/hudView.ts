import type { LocalGame, SpeedMode } from '@slots/game-logic';
import type { GameConfig } from '@slots/math-core';
import { el } from '../core/dom';
import { buzz } from '../core/settings';
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
    this.glow();
  }

  /** Radial glow that expands quickly from the centre of the WIN box (Josh, 2026-11-09). */
  private glow(): void {
    const g = el('span.win-glow');
    this.root.append(g);
    g.animate([
      { transform: 'translate(-50%,-50%) scale(.25)', opacity: 0.95 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.6, offset: 0.55 },
      { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 },
    ], { duration: 380, easing: 'cubic-bezier(.1,.7,.3,1)' }).finished.then(() => g.remove(), () => g.remove());
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
  /** Tap AUTO: start infinite auto spin (or stop it while running). */
  onAuto(): void;
  /** Hold AUTO: open the Auto Spin options window. */
  onAutoHold(): void;
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
  private turboBtn: HTMLButtonElement;
  private autoBtn: HTMLButtonElement;
  private autoLabel = el('span.lb', { text: STRINGS.auto });
  /** Auto icon when idle; pause icon while auto play runs (tap = pause). */
  private autoIcon = el('span.ic.auto-ic', { text: '↻' });
  /** How long AUTO must be held to open the options (a fill shows the progress). */
  static readonly HOLD_MS = 500;
  readonly buyBtn: HTMLButtonElement;
  /** Spins left while auto spin runs; the spin button turns into STOP. */
  private autoCount = el('span.auto-count');
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
      this.buyBtn = el('button.buy-btn', { text: STRINGS.buyBonus, onclick: () => h.onBuy() }) as HTMLButtonElement,
    ]);
    this.betBtn = el('button.ctl.bet-btn', { onclick: () => h.onBet() }) as HTMLButtonElement;
    this.spinBtn = el('button.spin-btn', { 'aria-label': STRINGS.spin, onclick: () => h.onSpin() },
      [el('span.spin-ring'), el('span.spin-face'), el('span.spin-shine'), this.spinIcon, this.autoCount]) as HTMLButtonElement;
    this.turboBtn = el('button.ctl.turbo-btn', { onclick: () => h.onTurbo() }) as HTMLButtonElement;
    this.controls = el('div.controls', {}, [
      el('button.ctl', { onclick: () => h.onSettings() }, [el('span.ic', { text: '☰' }), el('span.lb', { text: 'MENU' })]),
      this.betBtn,
      this.spinBtn,
      this.autoBtn = this.holdButton(el('button.ctl.auto-btn', {}, [el('span.hold-fill'), this.autoIcon, this.autoLabel]) as HTMLButtonElement,
        () => h.onAuto(), () => h.onAutoHold()),
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
    const auto = game.models.autoSpin;
    const lock = () => {
      const p = game.models.spin.phase.value;
      const busy = p !== 'idle';
      const running = auto.active.value;
      this.spinBtn.classList.toggle('spinning', busy || running);
      if (this.iconActive !== (busy || running)) { this.iconActive = busy || running; this.updateIconSpeed(); }
      this.spinBtn.classList.toggle('auto', running);
      // Locked while a round animates, except during auto spin, where it is the STOP button.
      this.spinBtn.disabled = busy && !running;
      this.spinBtn.setAttribute('aria-label', running ? STRINGS.stop : STRINGS.spin);
      this.betBtn.disabled = busy || running;
      // During auto spin AUTO stays live as a second STOP button.
      this.autoBtn.disabled = busy && !running;
      this.autoBtn.classList.toggle('on', running);
      this.autoLabel.textContent = running ? STRINGS.stop : STRINGS.auto;
      if (this.autoIcon.classList.contains('pause') !== running) {
        this.autoIcon.classList.toggle('pause', running);
        this.autoIcon.textContent = running ? '' : '↻';
        this.autoIcon.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
      }
      this.buyBtn.disabled = busy || running;
    };
    game.models.spin.phase.subscribe(lock);
    auto.active.subscribe(lock);
    const showCount = () => {
      const n = auto.remaining.value;
      const was = this.autoCount.textContent;
      this.autoCount.textContent = auto.active.value ? (n === Infinity ? '∞' : String(n)) : '';
      if (was && was !== this.autoCount.textContent) this.autoCount.animate([{ transform: 'scale(1.3)' }, { transform: 'none' }], { duration: 220 });
    };
    auto.remaining.subscribe(showCount);
    auto.active.subscribe(showCount);
    game.models.speed.mode.subscribe(m => this.showSpeed(m));
    this.mult.mode(false);
    this.startIcon();
  }

  /** Tap runs onTap; holding for HOLD_MS runs onHold instead (with a fill showing the hold). */
  private holdButton(btn: HTMLButtonElement, onTap: () => void, onHold: () => void): HTMLButtonElement {
    let timer = 0;
    let held = false;
    let fill: Animation | null = null;
    const cancel = () => { clearTimeout(timer); timer = 0; fill?.cancel(); fill = null; };
    btn.addEventListener('pointerdown', () => {
      if (btn.disabled) return;
      held = false;
      cancel();
      if (btn.classList.contains('on')) return; // running: a tap stops, no hold menu
      fill = btn.querySelector('.hold-fill')!.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: HudView.HOLD_MS, easing: 'linear', fill: 'forwards' });
      timer = window.setTimeout(() => { held = true; cancel(); buzz(15); onHold(); }, HudView.HOLD_MS);
    });
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('contextmenu', e => e.preventDefault()); // long-press on phones
    btn.addEventListener('click', () => { if (held) { held = false; return; } onTap(); });
    return btn;
  }

  /** Two arrows chasing each other round a circle (Josh's reference), centred exactly on the button. */
  private static arrowIcon(): HTMLElement {
    const icon = el('span.spin-icon');
    // One clockwise arc (radius 30, 140 degrees) with its arrowhead; the second is the same turned 180 degrees.
    const arrow = '<path d="M60.3 21.8 A30 30 0 0 1 60.3 78.2" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>'
      + '<path d="M49 82.3 L64 88.5 L56.5 67.9 Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>';
    icon.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">${arrow}<g transform="rotate(180 50 50)">${arrow}</g></svg>`;
    return icon;
  }

  /**
   * The icon never stops turning. Idle it turns slowly; while the slot animates it speeds up to the
   * turbo speed, and when the round ends it eases back to the idle pace (Josh, 2026-11-09).
   * One turn takes IDLE_TURN_MS idle, or ACTIVE_TURN_MS[speed] while a round animates.
   */
  private static readonly IDLE_TURN_MS = 7143; // idle: 20% slower than 5714 (Josh, 2026-11-09)
  private static readonly ACTIVE_TURN_MS: Record<SpeedMode, number> = { normal: 1213, turbo: 727, super: 364 }; // normal 20% faster than 1455
  private iconActive = false;
  private rateRaf = 0;

  private startIcon(): void {
    this.spinAnim = this.spinIcon.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1000, iterations: Infinity });
    this.spinAnim.playbackRate = 1000 / HudView.IDLE_TURN_MS;
  }

  /** Eases the turning speed to the pace for the current state, so it never jumps. */
  private updateIconSpeed(): void {
    const a = this.spinAnim;
    if (!a) return;
    const turn = this.iconActive ? HudView.ACTIVE_TURN_MS[this.speed] : HudView.IDLE_TURN_MS;
    const from = a.playbackRate;
    const to = 1000 / turn;
    const t0 = performance.now();
    const ms = this.iconActive ? 250 : 600; // quick to speed up, slower to settle
    cancelAnimationFrame(this.rateRaf);
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      a.playbackRate = from + (to - from) * k;
      if (k < 1) this.rateRaf = requestAnimationFrame(tick);
    };
    this.rateRaf = requestAnimationFrame(tick);
  }

  /** ▷ normal, ▶ turbo, ▶▶ super turbo: the current speed is always visible on the button. */
  private showSpeed(m: SpeedMode): void {
    this.speed = m;
    this.updateIconSpeed();
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
