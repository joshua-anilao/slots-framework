import { Graphics, Node, Tween, Vec3, tween } from 'cc';
import type { GameConfig } from '../../shared/math-core/index';
import { addGlow } from '../ui/glow';
import { GLOW_STYLE } from '../ui/glowStyle';
import { drawRoundRect, makeLabel, uiNode } from '../ui/uiKit';

/** Size and corner radius of one step (px). */
const STEP_HEIGHT = 54;
const STEP_RADIUS = 14;

/** Multiplier bar (feature 6): ladder steps with the current one lit. Endless variants show one growing step. */
export class MultiplierBar {
  readonly node: Node;
  private ladder: number[] = [];
  private free = false;

  constructor(parent: Node, private readonly config: () => GameConfig, private readonly width = 600) {
    this.node = uiNode('MultBar', width, 64);
    parent.addChild(this.node);
    this.mode(false);
  }

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
      await new Promise<void>(r => setTimeout(r, per));
    }
    this.set(this.ladder[0]!);
  }

  /** 0 for the first ladder step, 1 for the next... (B: grows with the value). */
  levelOf(value: number): number {
    const i = this.ladder.indexOf(value);
    return i >= 0 ? i : Math.min(6, Math.max(0, Math.round(Math.log2(Math.max(1, value)))));
  }

  /** Centre of the lit step in world space (for the burst when it moves up). */
  litWorld(): Vec3 { return (this.lit ?? this.node).getWorldPosition(); }

  private lit: Node | undefined;

  set(value: number): void {
    Tween.stopAllByTarget(this.lit);
    this.node.removeAllChildren();
    this.lit = undefined;
    const v = this.config().multiplier.variant;
    const gold = this.free ? '#29d3c0' : '#f5c542';
    if (this.ladder.length) {
      const n = this.ladder.length, gap = 12, w = (this.width - gap * (n - 1)) / n;
      this.ladder.forEach((x, i) => {
        const on = x === value;
        const step = uiNode(`Step${x}`, w, 54);
        step.setPosition(-this.width / 2 + w / 2 + i * (w + gap), 0, 0);
        drawRoundRect(step.addComponent(Graphics), w, 54, { fill: on ? gold : '#2b1c40', stroke: on ? '#fff6c8' : '#352449', strokeWidth: on ? 4 : 3, radius: 14 });
        makeLabel(step, `x${x}`, on ? 34 : 28, on ? (this.free ? '#002b28' : '#3b2300') : '#74698a', 0, 0, w);
        this.node.addChild(step);
        if (on) { this.lit = step; this.addStepGlow(step, w); }
      });
    } else if (v === 'B') {
      const step = uiNode('StepEndless', 200, 54);
      step.setPosition(-110, 0, 0);
      drawRoundRect(step.addComponent(Graphics), 200, 54, { fill: gold, stroke: '#fff6c8', strokeWidth: 4, radius: 14 });
      makeLabel(step, `x${value}`, 36, this.free ? '#002b28' : '#3b2300', 0, 0, 200);
      this.node.addChild(step);
      this.lit = step;
      this.addStepGlow(step, 200);
      makeLabel(this.node, 'Endless', 26, '#f6efff', 140, 0, 200);
    } else {
      makeLabel(this.node, 'Spots: cells that win twice get x2, x4, x8...', 24, '#f6efff', 0, 0, this.width);
    }
    if (this.lit) {
      // The lit step draws above its neighbours so its glow is not covered.
      this.lit.setSiblingIndex(this.node.children.length - 1);
      this.lit.setScale(1.3, 1.3, 1);
      tween(this.lit).to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }
  }

  /** Glow behind the lit step: gold in the base game, teal in free spins. */
  private addStepGlow(step: Node, width: number): void {
    const s = GLOW_STYLE.multStep;
    addGlow(step, 'StepGlow', width, STEP_HEIGHT, STEP_RADIUS, { glow: this.free ? s.free : s.base });
  }
}
