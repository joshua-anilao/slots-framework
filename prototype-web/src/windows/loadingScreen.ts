import { el } from '../core/dom';
import { STRINGS } from '../strings';

const SKIP_KEY = 'slots.game001.skipIntro';

function readSkip(): boolean {
  try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
}
function writeSkip(v: boolean): void {
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
  private timer = 0;
  private skip = readSkip();

  constructor(title: string, volatility: number) {
    const slides = STRINGS.tutorial;
    this.track.append(...slides.map((s, i) => el('div.tut-slide', {}, [
      el(`div.tut-pic.p${i}`, {}, LoadingScreen.pic(i)),
      el('div.tut-head', { text: s.title }),
      el('div.tut-text', { text: s.text }),
    ])));
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

  private go(i: number): void {
    const n = STRINGS.tutorial.length;
    this.slide = (i + n) % n;
    this.track.style.transform = `translateX(${-this.slide * 100}%)`;
    Array.from(this.dots.children).forEach((d, k) => d.classList.toggle('on', k === this.slide));
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.go(this.slide + 1), 3500);
  }

  private swipe(): void {
    let x0: number | null = null;
    this.root.addEventListener('pointerdown', e => { if ((e.target as Element).closest('.tut')) x0 = e.clientX; });
    this.root.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 30) this.go(this.slide + (dx < 0 ? 1 : -1));
    });
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
