import type { WinTier } from '@slots/game-logic';
import { el, fitText } from '../core/dom';
import type { Pace } from '../core/pace';
import { money, STRINGS } from '../strings';

/** Toasts, banners and the Big/Super/Ultra win overlay. All tap-to-skip. */
export class Overlays {
  readonly root = el('div.overlays');
  private toastEl = el('div.toast');
  private skipFn: (() => void) | null = null;

  constructor() {
    this.root.append(this.toastEl);
  }

  toast(text: string, ms = 1600): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout((this.toastEl as unknown as { _t: number })._t);
    (this.toastEl as unknown as { _t: number })._t = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  /** Called by the presenter's skip(): closes the current banner or finishes a count-up. */
  skip(): void { this.skipFn?.(); }

  /** A banner (free spins intro/outro). Closes on tap or after `ms`. */
  async banner(title: string, sub: string, ms: number, pace: Pace, cls = '', extra = ''): Promise<void> {
    const node = el(`div.banner${cls ? '.' + cls : ''}`, {}, [el('div.banner-title', { text: title }), el('div.banner-sub', { text: sub }),
      ...(extra ? [el('div.banner-extra', { text: extra })] : []), el('div.banner-hint', { text: STRINGS.tapToContinue })]);
    await this.show(node, ms, pace);
  }

  /** Every banner line fits the 720 stage with a margin (art guide: text scales with the screen). */
  private fit(node: HTMLElement, amountSample?: string): void {
    Array.from(node.querySelectorAll<HTMLElement>('.banner-title, .banner-sub, .banner-extra, .bw-title')).forEach(t => fitText(t, 640));
    const v = node.querySelector<HTMLElement>('.bw-value');
    if (v) fitText(v, 640, amountSample);
  }

  /** Big/Super/Ultra win: count-up that escalates through the tiers it passes. */
  async bigWin(amount: number, bet: number, tiers: { big: number; super: number; ultra: number }, finalTier: WinTier, pace: Pace, onCoin: () => void = () => {}): Promise<void> {
    const title = el('div.bw-title', { text: STRINGS.tier.big });
    const value = el('div.bw-value', { text: money(0) });
    const node = el('div.bigwin', {}, [el('div.bw-rays'), title, value]);
    const coins = el('div.coins');
    node.append(coins);
    for (let i = 0; i < (finalTier === 'ultra' ? 40 : finalTier === 'super' ? 25 : 14); i++) {
      const c = el('i.coin');
      c.style.left = `${Math.random() * 100}%`;
      c.style.animationDelay = `${Math.random() * 1.2}s`;
      c.style.animationDuration = `${1 + Math.random()}s`;
      coins.append(c);
    }
    this.root.append(node);
    this.fit(node, money(amount));
    title.textContent = STRINGS.tier.ultra; fitText(title, 640); title.textContent = STRINGS.tier.big;
    const ms = pace.t.countUp;
    let done = false;
    let resolveCount!: () => void;
    const counted = new Promise<void>(r => { resolveCount = r; });
    this.skipFn = () => { done = true; };
    const t0 = performance.now();
    let current: WinTier = 'big';
    let lastCoin = 0;
    const frame = (now: number) => {
      if (now - lastCoin > 90 && !done) { lastCoin = now; onCoin(); }
      const k = done ? 1 : Math.min(1, (now - t0) / ms);
      const v = amount * (1 - Math.pow(1 - k, 2));
      value.textContent = money(k >= 1 ? amount : v);
      const x = (k >= 1 ? amount : v) / bet;
      const tier: WinTier = x >= tiers.ultra ? 'ultra' : x >= tiers.super ? 'super' : 'big';
      if (tier !== current) {
        current = tier;
        title.textContent = STRINGS.tier[tier as 'big'];
        node.dataset.tier = tier;
        title.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
      }
      if (k < 1) requestAnimationFrame(frame); else resolveCount();
    };
    node.dataset.tier = 'big';
    requestAnimationFrame(frame);
    await counted;
    await this.holdThenClose(node, pace.hurry ? 400 : 1500);
  }

  /** Free spins outro: total counts up with coins, then holds. */
  async countBanner(title: string, sub: string, amount: number, pace: Pace, onCoin: () => void = () => {}): Promise<void> {
    const value = el('div.bw-value', { text: money(0) });
    const coins = el('div.coins');
    for (let i = 0; i < 24; i++) {
      const c = el('i.coin');
      c.style.left = `${Math.random() * 100}%`;
      c.style.animationDelay = `${Math.random() * 1.2}s`;
      coins.append(c);
    }
    const node = el('div.banner.fs-outro', {}, [el('div.bw-rays'), coins, el('div.banner-title', { text: title }), el('div.banner-sub', { text: sub }), value]);
    this.root.append(node);
    this.fit(node, money(amount));
    node.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'ease-out' });
    let done = false;
    this.skipFn = () => { done = true; };
    const ms = pace.t.countUp;
    const t0 = performance.now();
    let lastCoin = 0;
    await new Promise<void>(resolve => {
      const frame = (now: number) => {
        const k = done ? 1 : Math.min(1, (now - t0) / ms);
        value.textContent = money(k >= 1 ? amount : amount * (1 - Math.pow(1 - k, 2)));
        if (now - lastCoin > 90 && k < 1) { lastCoin = now; onCoin(); }
        if (k < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    await this.holdThenClose(node, pace.hurry ? 400 : 1600);
  }

  private async show(node: HTMLElement, ms: number, pace: Pace): Promise<void> {
    this.root.append(node);
    this.fit(node);
    node.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
    await this.holdThenClose(node, pace.hurry ? Math.min(ms, 500) : ms);
  }

  private holdThenClose(node: HTMLElement, ms: number): Promise<void> {
    return new Promise(resolve => {
      const close = () => {
        clearTimeout(t);
        this.skipFn = null;
        node.removeEventListener('pointerdown', close);
        node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.then(() => { node.remove(); resolve(); });
      };
      const t = setTimeout(close, ms);
      this.skipFn = close;
      node.addEventListener('pointerdown', close);
    });
  }
}
