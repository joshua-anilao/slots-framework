import { BlockInputEvents, Graphics, Label, Mask, Node, Tween, UIOpacity, tween } from 'cc';
import type { EventTouch } from 'cc';
import { STRINGS } from '../../shared/game-logic/index';
import type { IKeyValueStore } from '../audio/audioManager';
import { loadSettings, saveSettings } from '../settings/playerSettings';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

const W = 720, H = 1280;
/** Tutorial turns to the next page by itself this often; any tap or drag restarts the wait. */
const AUTO_SECONDS = 4;
const PAGE_W = 600;

export interface LoadStep { label: string; run: () => Promise<unknown> | unknown }

/**
 * Loading screen: logo, volatility, a loading bar that moves with real load steps, a tutorial with dots and arrows
 * (turns by itself, swipe to turn), "Don't show next time", then Continue. With "Don't show next time" on, the game opens
 * by itself as soon as loading ends.
 */
export class LoadingScreen {
  readonly node: Node;
  private readonly bar: Graphics;
  private readonly pct: Label;
  private readonly barBox: Node;
  private readonly goBtn: Node;
  private readonly pages: Node[] = [];
  private readonly dots: Graphics[] = [];
  private readonly settings;
  private page = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private tickMark!: Label;

  constructor(parent: Node, title: string, volatility: number, private readonly store: IKeyValueStore) {
    this.settings = loadSettings(store);
    this.node = uiNode('Loading', W, H);
    const bg = this.node.addComponent(Graphics);
    bg.fillColor = hex('#241337'); bg.rect(-W / 2, -H / 2, W, H); bg.fill();
    this.node.addComponent(UIOpacity);
    this.node.addComponent(BlockInputEvents);

    const logo = makeLabel(this.node, title, 70, '#f5c542', 0, 480, 640);
    logo.enableOutline = true; logo.outlineColor = hex('#3a1f12'); logo.outlineWidth = 7;
    makeLabel(this.node, 'PROTOTYPE', 24, '#b9a8d6', 0, 420, 400);
    makeLabel(this.node, STRINGS.volatility, 24, '#f6efff', -90, 350, 260);
    for (let i = 0; i < 5; i++) makeLabel(this.node, '⚡', 34, i < volatility ? '#f5c542' : '#4a3f55', 40 + i * 44, 350, 44);

    // Tutorial pages: a picture row, a heading and a line of text.
    const slides = STRINGS.tutorial;
    const clip = uiNode('TutorialClip', PAGE_W, 460);
    clip.setPosition(0, 120, 0);
    clip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    this.node.addChild(clip);
    slides.forEach((s, i) => {
      const p = uiNode(`Page${i}`, PAGE_W, 460);
      this.picture(p, i);
      makeLabel(p, s.title, 44, '#f5c542', 0, -60, 580);
      makeLabel(p, s.text, 28, '#ffffff', 0, -150, 540, { wrap: true, bold: false });
      p.active = i === 0;
      clip.addChild(p);
      this.pages.push(p);
    });
    slides.forEach((_, i) => {
      const d = uiNode('Dot', 40, 40);
      d.setPosition((i - (slides.length - 1) / 2) * 44, -150, 0);
      this.dots.push(d.addComponent(Graphics));
      d.on(Node.EventType.TOUCH_END, () => this.go(i));
      this.node.addChild(d);
    });
    this.arrow('‹', -300, () => this.go(this.page - 1));
    this.arrow('›', 300, () => this.go(this.page + 1));
    this.swipe();

    // The bar and Continue share one spot: the bar shows while loading, Continue replaces it at 100%.
    this.barBox = uiNode('BarBox', 520, 70);
    this.barBox.setPosition(0, -300, 0);
    drawRoundRect(this.barBox.addComponent(Graphics), 520, 30, { fill: '#0f0a1a', stroke: '#4a3a5c', strokeWidth: 3, radius: 15 });
    const fill = uiNode('Fill', 520, 30);
    this.bar = fill.addComponent(Graphics);
    this.barBox.addChild(fill);
    this.pct = makeLabel(this.barBox, '0%', 24, '#f6efff', 0, -40, 200);
    this.node.addChild(this.barBox);

    this.goBtn = uiNode('Continue', 420, 96);
    this.goBtn.setPosition(0, -300, 0);
    drawRoundRect(this.goBtn.addComponent(Graphics), 420, 96, { fill: '#f5c542', stroke: '#8a5a00', strokeWidth: 5, radius: 48 });
    makeLabel(this.goBtn, STRINGS.continue, 40, '#3a1f12', 0, 0, 400);
    this.goBtn.active = false;
    this.node.addChild(this.goBtn);

    // "Don't show next time" tick.
    const check = uiNode('Check', 420, 60);
    check.setPosition(0, -420, 0);
    const box = uiNode('Box', 44, 44);
    box.setPosition(-180, 0, 0);
    const bg2 = box.addComponent(Graphics);
    this.tickMark = makeLabel(box, '✓', 34, '#3a1f12', 0, 0, 44);
    const paint = (): void => {
      drawRoundRect(bg2, 44, 44, { fill: this.settings.skipIntro ? '#f5c542' : '#352449', stroke: '#f5c542', strokeWidth: 3, radius: 10 });
      this.tickMark.node.active = this.settings.skipIntro;
    };
    check.addChild(box);
    makeLabel(check, STRINGS.dontShow, 26, '#f6efff', 20, 0, 340, { align: 'left' });
    check.on(Node.EventType.TOUCH_END, () => { this.settings.skipIntro = !this.settings.skipIntro; saveSettings(this.store, this.settings); paint(); });
    this.node.addChild(check);
    paint();

    parent.addChild(this.node);
    this.go(0);
  }

  /** Runs the load steps with the bar following them, then waits for Continue (or goes straight on when skipped). */
  async run(steps: LoadStep[], forceSkip = false): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      try { await steps[i]!.run(); } catch (e) { console.warn('load step failed', steps[i]!.label, e); }
      this.setProgress((i + 1) / steps.length);
      await new Promise(r => setTimeout(r, 60));
    }
    if (forceSkip || this.settings.skipIntro) { this.close(); return; }
    this.barBox.active = false;
    this.goBtn.active = true;
    await new Promise<void>(resolve => {
      this.goBtn.once(Node.EventType.TOUCH_END, () => { this.close(); resolve(); });
    });
  }

  private close(): void {
    clearInterval(this.timer);
    const fade = this.node.getComponent(UIOpacity)!;
    tween(fade).to(0.3, { opacity: 0 }).call(() => { this.slider?.stop(); this.node.destroy(); }).start();
  }

  private setProgress(k: number): void {
    this.bar.clear();
    this.bar.fillColor = hex('#f5c542');
    this.bar.roundRect(-260, -15, 520 * k, 30, 15);
    this.bar.fill();
    this.pct.string = `${Math.round(k * 100)}%`;
  }

  /** Page index wrapped into range. */
  private wrap(i: number): number { const n = this.pages.length; return ((i % n) + n) % n; }

  /**
   * Lays the pages out for a drag offset: the current page at `dx`, the previous one just to its left and the next one
   * just to its right, so the neighbour is visible while the finger moves.
   */
  private layout(dx: number): void {
    const cur = this.page, prev = this.wrap(cur - 1), next = this.wrap(cur + 1);
    this.pages.forEach((p, k) => {
      const show = k === cur || k === prev || k === next;
      p.active = show;
      if (!show) return;
      p.setPosition(k === cur ? dx : k === next ? dx + PAGE_W : dx - PAGE_W, 0, 0);
    });
  }

  /** Slide to page i (wraps round). Goes the short way: forward for the next page, back for the previous. */
  private go(i: number, from = 0): void {
    const n = this.pages.length;
    const target = this.wrap(i);
    const forward = n > 1 && target === this.wrap(this.page + 1);
    const backward = n > 1 && target === this.wrap(this.page - 1);
    clearInterval(this.timer);
    this.slider?.stop();
    const finish = (): void => {
      this.page = target;
      this.layout(0);
      this.dots.forEach((g, k) => drawRoundRect(g, 20, 20, { fill: k === this.page ? '#f5c542' : '#4a3f55', radius: 10 }));
      this.timer = setInterval(() => this.go(this.page + 1), AUTO_SECONDS * 1000);
    };
    if (target === this.page || (!forward && !backward)) { finish(); return; }
    // Slide the neighbour in: forward moves everything left, backward right.
    const end = forward ? -PAGE_W : PAGE_W;
    const state = { v: from };
    this.layout(from);
    this.slider = tween(state).to(0.25, { v: end }, { easing: 'quadOut', onUpdate: () => this.layout(state.v) }).call(finish).start();
  }
  private slider: Tween<{ v: number }> | undefined;

  private arrow(t: string, x: number, onTap: () => void): void {
    const a = makeLabel(this.node, t, 80, '#f5c542', x, 120, 80);
    a.node.on(Node.EventType.TOUCH_END, onTap);
  }

  /** Drag over the tutorial: the pages follow the finger; let go past a quarter of the width (or flick) to turn the page. */
  private swipe(): void {
    const area = uiNode('Swipe', 500, 460);
    area.setPosition(0, 120, 0);
    let dx = 0, t0 = 0, dragging = false;
    area.on(Node.EventType.TOUCH_START, () => {
      dragging = true; dx = 0; t0 = Date.now();
      clearInterval(this.timer);
      this.slider?.stop();
      this.layout(0);
    });
    area.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      if (!dragging) return;
      dx += e.getUIDelta().x;
      this.layout(dx);
    });
    const release = (): void => {
      if (!dragging) return;
      dragging = false;
      const flick = Date.now() - t0 < 250 && Math.abs(dx) > 40;
      if (dx < -PAGE_W / 4 || (flick && dx < 0)) this.go(this.page + 1, dx);
      else if (dx > PAGE_W / 4 || (flick && dx > 0)) this.go(this.page - 1, dx);
      else { // springs back
        const state = { v: dx };
        this.slider = tween(state).to(0.2, { v: 0 }, { easing: 'quadOut', onUpdate: () => this.layout(state.v) })
          .call(() => { this.layout(0); this.timer = setInterval(() => this.go(this.page + 1), AUTO_SECONDS * 1000); }).start();
      }
    };
    area.on(Node.EventType.TOUCH_END, release);
    area.on(Node.EventType.TOUCH_CANCEL, release);
    this.node.addChild(area);
  }

  /** Simple placeholder pictures for each tutorial page. */
  private picture(p: Node, i: number): void {
    const tile = (t: string, x: number, fill: string, color = '#3a1f12', w = 90): void => {
      const n = uiNode('Tile', w, 90);
      n.setPosition(x, 130, 0);
      drawRoundRect(n.addComponent(Graphics), w, 90, { fill, stroke: '#3a1f12', radius: 14 });
      makeLabel(n, t, t.length > 3 ? 26 : 38, color, 0, 0, w);
      p.addChild(n);
    };
    const arrow = (x: number): void => { makeLabel(p, '→', 50, '#f5c542', x, 130, 60); };
    switch (i) {
      case 0: tile('A', -200, '#fff1d0'); tile('A', -100, '#fff1d0'); tile('A', 0, '#fff1d0'); arrow(95); tile('1024', 200, '#f5c542', '#3a1f12', 130); break;
      case 1: tile('K', -120, '#d4a017'); arrow(-30); tile('WILD', 100, '#f5c542', '#3b2300', 130); break;
      case 2: ['x1', 'x2', 'x3', 'x5'].forEach((t, k) => tile(t, -200 + k * 135, k === 3 ? '#f5c542' : '#352449', k === 3 ? '#3a1f12' : '#ffffff')); break;
      default: tile('★', -200, '#be123c', '#ffffff'); tile('★', -100, '#be123c', '#ffffff'); tile('★', 0, '#be123c', '#ffffff'); arrow(95); tile('10', 200, '#f5c542', '#3a1f12', 130);
    }
  }
}
