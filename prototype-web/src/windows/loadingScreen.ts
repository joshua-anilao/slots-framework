import { el } from '../core/dom';
import { STRINGS } from '../strings';

const SKIP_KEY = 'slots.game001.skipIntro';

export function readSkip(): boolean {
  try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
}
export function writeSkip(v: boolean): void {
  try { if (v) localStorage.setItem(SKIP_KEY, '1'); else localStorage.removeItem(SKIP_KEY); } catch { /* private mode */ }
}

export interface LoadStep { label: string; run: () => Promise<unknown> | unknown }

/**
 * Loading screen (feature 9): logo, volatility, a loading bar that moves with real
 * load steps, a swipeable tutorial with dots, "Don't show next time", then Continue.
 * With "Don't show next time" on, the game opens by itself as soon as loading ends.
 */
export class LoadingScreen {
  readonly root: HTMLElement;
  private bar = el('div.load-fill');
  private pct = el('div.load-pct', { text: '0%' });
  private barBox = el('div.load-box', {}, [el('div.load-bar', {}, [this.bar]), this.pct]);
  private track = el('div.tut-track');
  private dots = el('div.tut-dots');
  private continueBtn = el('button.primary.load-go', { text: STRINGS.continue }) as HTMLButtonElement;
  private slide = 0;
  /** Position on the track, counting the copies: 0 = copy of last, 1..n = pages, n+1 = copy of first. */
  private pos = 1;
  private timer = 0;
  /** Tutorial turns to the next page by itself this often; any tap or drag restarts the wait. */
  static readonly AUTO_MS = 4000;
  private skip = readSkip();

  constructor(title: string, volatility: number) {
    const slides = STRINGS.tutorial;
    const pages = slides.map((s, i) => el('div.tut-slide', {}, [
      el(`div.tut-pic.p${i}`, {}, LoadingScreen.pic(i)),
      el('div.tut-head', { text: s.title }),
      el('div.tut-text', { text: s.text }),
    ]));
    // Endless loop: a copy of the last page sits before the first and a copy of the first after the last.
    // Sliding onto a copy, then jumping (unseen) to the real page, means it never rewinds to the start.
    this.track.append(pages[pages.length - 1].cloneNode(true), ...pages, pages[0].cloneNode(true));
    this.track.addEventListener('transitionend', () => this.settle());
    this.dots.append(...slides.map((_, i) => el('button.tut-dot', { 'aria-label': `${i + 1}`, onclick: () => this.go(i) })));
    const check = el('button.check', { 'aria-pressed': String(this.skip) }, [el('span.box'), el('span', { text: STRINGS.dontShow })]);
    check.classList.toggle('on', this.skip);
    check.addEventListener('click', () => {
      this.skip = !this.skip;
      writeSkip(this.skip);
      check.classList.toggle('on', this.skip);
      check.setAttribute('aria-pressed', String(this.skip));
    });
    this.continueBtn.hidden = true;
    this.root = el('div.loading', {}, [
      el('div.load-logo', {}, [el('span.logo-main', { text: title }), el('span.logo-sub', { text: 'PROTOTYPE' })]),
      el('div.vol', {}, [el('span', { text: STRINGS.volatility }),
        ...Array.from({ length: 5 }, (_, i) => el(`span.bolt${i < volatility ? '.on' : ''}`, { text: '⚡' }))]),
      el('div.tut-wrap', {}, [
        el('button.tut-arrow.prev', { 'aria-label': 'Previous', text: '‹', onclick: () => this.go(this.slide - 1) }),
        el('div.tut', {}, [this.track]),
        el('button.tut-arrow.next', { 'aria-label': 'Next', text: '›', onclick: () => this.go(this.slide + 1) }),
      ]),
      this.dots,
      // The bar and Continue share one spot: the bar shows while loading, Continue replaces it at 100%.
      el('div.load-slot', {}, [this.barBox, this.continueBtn]), check,
    ]);
    this.swipe();
    this.place(1, false);
    this.go(0);
  }

  /** Simple placeholder pictures for each tutorial page. */
  private static pic(i: number): HTMLElement[] {
    const tile = (t: string, c = '') => el(`span.tp${c}`, { text: t });
    switch (i) {
      case 0: return [tile('A'), tile('A'), tile('A'), el('span.tp-arrow', { text: '→' }), tile('1024', '.wide')];
      case 1: return [tile('K', '.gold'), el('span.tp-arrow', { text: '→' }), tile('WILD', '.wild')];
      case 2: return ['x1', 'x2', 'x3', 'x5'].map((t, k) => tile(t, k === 3 ? '.on' : ''));
      default: return [tile('★', '.sc'), tile('★', '.sc'), tile('★', '.sc'), el('span.tp-arrow', { text: '→' }), tile('10', '.wide')];
    }
  }

  private place(pos: number, animate: boolean): void {
    this.pos = pos;
    this.track.style.transition = animate ? '' : 'none';
    this.track.style.transform = `translateX(${-pos * 100}%)`;
    if (!animate) void this.track.offsetWidth; // apply the jump before any next slide animates
  }

  /** After sliding onto a copy, jump to the real page it shows. */
  private settle(): void {
    const n = STRINGS.tutorial.length;
    if (this.pos === 0) this.place(n, false);
    else if (this.pos === n + 1) this.place(1, false);
  }

  /** Slide to page i. i = -1 or n slides one step onto the copy, so it keeps going the same way. */
  private go(i: number): void {
    const n = STRINGS.tutorial.length;
    this.settle(); // a fast second tap may land before the first slide finished
    const step = Math.max(-1, Math.min(n, i));
    this.slide = (step + n) % n;
    this.place(step + 1, step + 1 !== this.pos);
    Array.from(this.dots.children).forEach((d, k) => d.classList.toggle('on', k === this.slide));
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.go(this.slide + 1), LoadingScreen.AUTO_MS);
  }

  /**
   * Drag: the page follows the finger, so the next (or previous) page is half visible midway.
   * Let go past a quarter of the width, or with a quick flick, to change page; otherwise it springs back.
   */
  private swipe(): void {
    const tut = this.track.parentElement!;
    let x0 = 0;
    let t0 = 0;
    let dx = 0;
    let dragging = false;
    tut.addEventListener('pointerdown', e => {
      dragging = true;
      dx = 0;
      x0 = e.clientX;
      t0 = performance.now();
      clearInterval(this.timer);
      this.settle();
      this.track.style.transition = 'none';
      tut.setPointerCapture(e.pointerId);
    });
    tut.addEventListener('pointermove', e => {
      if (!dragging) return;
      const scale = tut.getBoundingClientRect().width / tut.offsetWidth; // the stage is scaled to fit the screen
      dx = (e.clientX - x0) / scale;
      const max = tut.offsetWidth; // never more than one page either way
      dx = Math.max(-max, Math.min(max, dx));
      this.track.style.transform = `translateX(calc(${-this.pos * 100}% + ${dx}px))`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      const fast = Math.abs(dx) > 30 && performance.now() - t0 < 250;
      if (Math.abs(dx) > tut.offsetWidth * 0.25 || fast) this.go(this.slide + (dx < 0 ? 1 : -1));
      else {
        this.place(this.pos, true); // spring back to the same page
        this.timer = window.setInterval(() => this.go(this.slide + 1), LoadingScreen.AUTO_MS);
      }
    };
    tut.addEventListener('pointerup', end);
    tut.addEventListener('pointercancel', end);
  }


  /** Runs each load step, moving the bar. Resolves when the player continues (or at once if they opted out). */
  async run(host: HTMLElement, steps: LoadStep[], minMs = 900): Promise<void> {
    host.append(this.root);
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    const t0 = performance.now();
    for (let i = 0; i < steps.length; i++) {
      await steps[i].run();
      // The bar never jumps faster than minMs in total, so it reads as loading, not flicker.
      const target = (i + 1) / steps.length;
      const wait = Math.max(0, t0 + minMs * target - performance.now());
      await this.fill(target, wait);
    }
    await this.barBox.animate([{ opacity: 1 }, { opacity: 0, transform: 'scaleX(.9)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished;
    this.barBox.hidden = true;
    this.continueBtn.hidden = false;
    this.continueBtn.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }],
      { duration: 320, easing: 'ease-out' });
    if (!this.skip) await new Promise<void>(res => this.continueBtn.addEventListener('click', () => res(), { once: true }));
    clearInterval(this.timer);
    await this.root.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 350, easing: 'ease-in', fill: 'forwards' }).finished;
    this.root.remove();
  }

  private fill(frac: number, ms: number): Promise<void> {
    const from = parseFloat(this.bar.style.width || '0') / 100;
    return new Promise(res => {
      const start = performance.now();
      const tick = () => {
        const k = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
        const v = from + (frac - from) * k;
        this.bar.style.width = `${v * 100}%`;
        this.pct.textContent = `${Math.round(v * 100)}%`;
        if (k < 1) requestAnimationFrame(tick); else res();
      };
      tick();
    });
  }
}
