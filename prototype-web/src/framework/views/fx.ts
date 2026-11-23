import type { SpeedMode } from '@slots/game-logic';
import { el, fitText } from '../core/dom';

/**
 * Multiplier reveal timings (ms). Prototype only for now; they move to pace.ts in the Cocos parity drop.
 * Rows in docs/TUNING.md, section "Multiplier reveal". All 0 (super) = no reveal.
 */
export const MULT_REVEAL_FX = {
  /** The x7 tag flies from the bar to the prize. */
  multFlyMs: { normal: 450, turbo: 250, super: 0 } as Record<SpeedMode, number>,
  /** The amount swaps, grows and springs back. */
  punchMs: { normal: 420, turbo: 220, super: 0 } as Record<SpeedMode, number>,
  /** Peak scale of the punch. */
  punchScale: 1.45,
};

/** Free-floating effects above the reels: flying win amounts and particle bursts. */
export class FxLayer {
  readonly root = el('div.fx-layer');

  constructor(private screen: HTMLElement) {}

  /** Removes flying win amounts and particles at once (snap to result). */
  clear(): void {
    this.gen++;
    for (const a of this.root.getAnimations({ subtree: true })) { try { a.finish(); } catch { /* infinite */ } }
  }

  /** Touch feedback: a ring and a few sparks wherever the player touches (drawn above everything). */
  touch(clientX: number, clientY: number, layer: HTMLElement): void {
    const s = this.screen.getBoundingClientRect();
    const k = s.width / 720;
    const x = (clientX - s.left) / k;
    const y = (clientY - s.top) / k;
    const ring = el('i.touch-ring');
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    layer.append(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }],
      { duration: 450, easing: 'ease-out' }).finished.then(() => ring.remove());
    for (let i = 0; i < 8; i++) {
      const p = el('i.touch-spark');
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      layer.append(p);
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const d = 40 + Math.random() * 30;
      p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
        { duration: 420 + Math.random() * 150, easing: 'cubic-bezier(.1,.7,.4,1)' }).finished.then(() => p.remove());
    }
  }

  /** Centre of an element in design (720x1280) coordinates. */
  centerOf(node: Element): { x: number; y: number } {
    const s = this.screen.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const k = s.width / 720;
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
  }

  /**
   * Win amount scales up in the middle of the reels, then flies into the WIN box.
   * Resolves when it lands, so the WIN box updates on arrival.
   */
  async flyWin(text: string, from: { x: number; y: number }, to: { x: number; y: number }, popMs: number, flyMs: number, big: boolean): Promise<void> {
    const gen = this.gen;
    const node = this.popAmount(text, from, popMs, big);
    await node.pop;
    if (gen !== this.gen) { node.el.remove(); return; }
    this.sparkle(from.x, from.y, big ? 18 : 10, 140);
    await this.flyAmount(node.el, from, to, flyMs, gen);
  }

  /**
   * Multiplier reveal: the base prize pops, the `x7` tag flies into it, the amount swaps to the
   * multiplied prize with a punch, then it flies to the WIN box. Resolves when it lands.
   * A `clear()` (tap to skip) ends every phase and no later phase starts.
   */
  async revealWin(o: {
    baseText: string; finalText: string; tagText: string;
    at: { x: number; y: number }; tagFrom: { x: number; y: number }; to: { x: number; y: number };
    popMs: number; multFlyMs: number; punchMs: number; punchScale: number; flyMs: number;
    onTagLanded?: () => void;
  }): Promise<void> {
    const gen = this.gen;
    const node = this.popAmount(o.baseText, o.at, o.popMs, true);
    await node.pop;
    if (gen !== this.gen) { node.el.remove(); return; }
    this.sparkle(o.at.x, o.at.y, 18, 140);
    // (b) the tag flies from the lit step into the prize
    const tag = el('div.fly-mult', { text: o.tagText });
    tag.style.left = `${o.tagFrom.x}px`;
    tag.style.top = `${o.tagFrom.y}px`;
    this.root.append(tag);
    await tag.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 },
      { transform: `translate(calc(-50% + ${o.at.x - o.tagFrom.x}px), calc(-50% + ${o.at.y - o.tagFrom.y}px)) scale(1)`, opacity: 1 },
    ], { duration: o.multFlyMs, easing: 'cubic-bezier(.45,0,.75,.6)', fill: 'forwards' }).finished.catch(() => {});
    tag.remove();
    if (gen !== this.gen) { node.el.remove(); return; }
    // (c) punch: sparkle, swap to the multiplied amount, grow and spring back
    this.sparkle(o.at.x, o.at.y, 14, 120);
    node.el.textContent = o.finalText;
    fitText(node.el, 640);
    o.onTagLanded?.();
    await node.el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', easing: 'ease-out' },
      { transform: `translate(-50%,-50%) scale(${o.punchScale})`, offset: 0.4, easing: 'cubic-bezier(.3,0,.3,1.4)' },
      { transform: 'translate(-50%,-50%) scale(1)' },
    ], { duration: o.punchMs }).finished.catch(() => {});
    if (gen !== this.gen) { node.el.remove(); return; }
    // (d) then to WIN
    await this.flyAmount(node.el, o.at, o.to, o.flyMs, gen);
  }

  /** Bumped by `clear()`; each phase of a multi-step effect checks it so nothing starts after a skip. */
  private gen = 0;

  private popAmount(text: string, from: { x: number; y: number }, popMs: number, big: boolean): { el: HTMLElement; pop: Promise<unknown> } {
    const node = el(`div.fly-win${big ? '.big' : ''}`, { text });
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    this.root.append(node);
    fitText(node, 640); // long amounts shrink to fit the screen width
    // Quick grow, then a slow settle back to normal size.
    const pop = node.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.1)' },
      { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1, offset: 0.25, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    ], { duration: popMs, fill: 'forwards' }).finished;
    return { el: node, pop };
  }

  private async flyAmount(node: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, flyMs: number, gen: number): Promise<void> {
    if (gen !== this.gen) { node.remove(); return; }
    await node.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.45)`, opacity: 0.9 },
    ], { duration: flyMs, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' }).finished.catch(() => {});
    node.remove();
    this.sparkle(to.x, to.y, 8, 70);
  }

  /** A gold bank coin flies from a card to the pot. Resolves when it lands (or at once when `ms` is 0 or the layer is cleared). */
  async flyCoin(text: string, from: { x: number; y: number }, to: { x: number; y: number }, ms: number): Promise<void> {
    if (ms <= 0) return;
    const node = el('div.fly-coin', { text });
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    this.root.append(node);
    await node.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.7)`, opacity: 1 },
    ], { duration: ms, easing: 'cubic-bezier(.45,0,.75,.6)', fill: 'forwards' }).finished.catch(() => {});
    node.remove();
    this.sparkle(to.x, to.y, 4, 30);
  }

  /** Particle burst; `count` grows with the multiplier step for a premium feel. */
  burst(x: number, y: number, count: number, colors = ['#fff6c8', '#f5c542', '#ffb347', '#ffffff']): void {
    for (let i = 0; i < count; i++) {
      const p = el('i.particle');
      const size = 8 + Math.random() * 12;
      p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]}`;
      this.root.append(p);
      const a = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * (80 + count * 4);
      const dur = 500 + Math.random() * 500;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 40}px)) scale(0)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(.1,.7,.4,1)' }).finished.then(() => p.remove());
    }
  }

  /** Small twinkles, e.g. where the win lands. */
  sparkle(x: number, y: number, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const s = el('i.twinkle');
      s.style.left = `${x + (Math.random() - 0.5) * radius * 2}px`;
      s.style.top = `${y + (Math.random() - 0.5) * radius}px`;
      this.root.append(s);
      s.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.2) rotate(90deg)', opacity: 1, offset: 0.4 },
        { transform: 'translate(-50%,-50%) scale(0) rotate(180deg)', opacity: 0 }], { duration: 450 + Math.random() * 300, delay: Math.random() * 120 })
        .finished.then(() => s.remove());
    }
  }
}
