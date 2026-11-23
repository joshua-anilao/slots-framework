import { Graphics, Mask, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import type { Cell, Grid, Pos } from '../../shared/math-core/index';
import type { Pace } from '../../shared/game-logic/index';
import { drawGlow, drawHorizontalLight } from '../ui/glow';
import { GLOW_STYLE } from '../ui/glowStyle';
import { hex, makeLabel, uiNode } from '../ui/uiKit';
import type { BoardLayout } from './boardLayout';
import { SymbolView } from './symbolView';

/** Where a cell ends up after the cascade drop: it falls by the number of removed cells below it. */
export function rowAfterDrop(p: Pos, removed: Pos[]): number {
  return p.row + removed.filter(r => r.reel === p.reel && r.row > p.row).length;
}

export interface BoardHooks {
  /** A reel landed: how many scatters have landed so far, and how many on this reel. */
  onReelStop(reel: number, scattersSoFar: number, newScatters: number): void;
  onAnticipate(): void;
  /** Winning cards burst: centres in world space. */
  onBurst(worldCentres: Vec3[]): void;
}

/**
 * The reels (feature 21): five masked columns of cards. It only animates what the presenter tells it;
 * the grid it shows always comes from a RoundResult. Card-drop style: old cards fall out, new cards fall in
 * reel by reel, bottom card first; with 2+ scatters landed the remaining reels drop alone under a light beam.
 */
export class BoardView {
  readonly node: Node;
  hooks: BoardHooks = { onReelStop: () => undefined, onAnticipate: () => undefined, onBurst: () => undefined };
  private readonly columns: Node[] = [];
  /** Light inside each reel, behind its cards, shown only under the beam. */
  private readonly beamLights: Node[] = [];
  private readonly beamLightFades: UIOpacity[] = [];
  /** Ring and halo around each reel, drawn above the neighbouring reels. */
  private readonly beamGlows: Node[] = [];
  /** Winning cards live here so their ring, halo and sway draw above every reel. */
  private readonly winLayer: Node;
  private winners: Array<{ view: SymbolView; reel: number }> = [];
  private readonly spotLayer: Node;
  private cells: Array<Array<SymbolView | null>>;
  private readonly pending = new Set<() => void>();
  private slammed = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    parent: Node,
    private readonly reels: number,
    private readonly rows: number,
    private readonly layout: BoardLayout,
    private readonly makeSymbol: (cell: Cell) => SymbolView,
    private readonly scatterId: string,
  ) {
    this.node = uiNode('Board', layout.width, layout.height);
    const beam = GLOW_STYLE.beam;
    // Child order, back to front: beam lights, reels, winning cards, beam glows, spots.
    for (let r = 0; r < reels; r++) {
      const light = uiNode(`BeamLight${r}`, layout.cellW, layout.height);
      light.setPosition(layout.cell(r, 0).x, 0, 0);
      drawHorizontalLight(light.addComponent(Graphics), layout.cellW, layout.height, beam.light);
      this.beamLightFades.push(light.addComponent(UIOpacity));
      light.active = false;
      this.beamLights.push(light);
      this.node.addChild(light);
    }
    for (let r = 0; r < reels; r++) {
      const col = uiNode(`Reel${r}`, layout.cellW, layout.height);
      col.setPosition(layout.cell(r, 0).x, 0, 0);
      const mask = col.addComponent(Mask);
      mask.type = Mask.Type.GRAPHICS_RECT;
      this.columns.push(col);
      this.node.addChild(col);
    }
    this.winLayer = uiNode('WinLayer');
    this.node.addChild(this.winLayer);
    for (let r = 0; r < reels; r++) {
      const glow = uiNode(`BeamGlow${r}`);
      glow.setPosition(layout.cell(r, 0).x, 0, 0);
      drawGlow(glow.addComponent(Graphics), layout.cellW, layout.height, beam.radius, { ring: beam.ring, glow: beam.glow });
      glow.active = false;
      this.beamGlows.push(glow);
      this.node.addChild(glow);
    }
    this.spotLayer = uiNode('Spots');
    this.node.addChild(this.spotLayer);
    parent.addChild(this.node);
    this.cells = this.empty();
  }

  /** Symbol ids on the board, [reel][row]. Used by tests to compare with the engine's grid. */
  snapshot(): string[][] { return this.cells.map(col => col.map(v => v?.symbol ?? '')); }

  /** World position of a cell centre (for effects). */
  cellWorld(p: Pos): Vec3 {
    const v = this.cells[p.reel]?.[p.row];
    return v ? v.node.getWorldPosition() : this.node.getWorldPosition();
  }

  get centerWorld(): Vec3 { return this.node.getWorldPosition(); }

  /** Draws a grid with no animation. `backs` are drawn as card backs (gold cards waiting to become WILD). */
  setGrid(grid: Grid, backs: Pos[] = []): void {
    this.clearAll();
    const isBack = new Set(backs.map(p => `${p.reel}:${p.row}`));
    for (let reel = 0; reel < this.reels; reel++) {
      for (let row = 0; row < this.rows; row++) {
        const v = this.spawn(reel, grid[reel]![row]!);
        if (isBack.has(`${reel}:${row}`)) v.showBack();
        v.node.setPosition(0, this.layout.cell(reel, row).y, 0);
        this.cells[reel]![row] = v;
      }
    }
  }

  /** Game intro: cards flip in one at a time, top to bottom, column by column. */
  async reveal(grid: Grid, cardSec: number, gapSec: number): Promise<void> {
    this.setGrid(grid);
    const flips: Array<Promise<void>> = [];
    let k = 0;
    this.each(v => { v.node.setScale(0.02, 1, 1); });
    for (let reel = 0; reel < this.reels; reel++) {
      for (let row = 0; row < this.rows; row++) {
        const v = this.cells[reel]![row]!;
        const delay = k++ * gapSec;
        flips.push(this.anim(done => { tween(v.node).delay(delay).to(cardSec, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).call(done).start(); }));
      }
    }
    await Promise.all(flips);
  }

  /** Cards fall out, new cards fall in. With 2+ scatters landed, later reels slow down under a light beam. */
  async spin(grid: Grid, pace: Pace): Promise<void> {
    this.clearMarks();
    this.slammed = false;
    const t = pace.t;
    // Old cards fall out of the grid.
    const out: Array<Promise<void>> = [];
    let i = 0;
    for (let reel = 0; reel < this.reels; reel++) {
      for (let row = 0; row < this.rows; row++) {
        const v = this.cells[reel]![row];
        if (!v) continue;
        Tween.stopAllByTarget(v.node);
        const p = v.node.position;
        out.push(this.moveTo(v.node, p.x, p.y - (this.layout.height + 60), t.clear / 1000, (reel * this.rows + row) * 0.015, 'quadIn'));
        i++;
      }
    }
    void i;
    await Promise.all(out);
    if (this.slammed) { this.setGrid(grid); return; }
    this.clearAll();

    let scattersSoFar = 0;
    let cursor = 0;
    let anticipating = false;
    const landings: Array<Promise<void>> = [];
    for (let reel = 0; reel < this.reels; reel++) {
      const antic = t.anticipation > 0 && scattersSoFar >= 2;
      let start: number;
      let fall = t.cardFall;
      let stagger = t.cardStagger;
      if (antic) {
        // Near miss: scatters already on the board pulse, then this reel's cards drop alone in a light beam.
        start = cursor + t.anticipation * (anticipating ? 0.45 : 0.9);
        fall = t.cardFall * 0.7;
        stagger = fall + t.anticipation * 0.5;
        const beamAt = cursor;
        this.later(() => {
          if (!anticipating) { anticipating = true; this.hooks.onAnticipate(); }
          this.moveBeam(reel);
        }, beamAt);
      } else {
        start = reel * t.reelStagger;
      }
      const falls: Array<Promise<void>> = [];
      for (let row = this.rows - 1; row >= 0; row--) {
        const k = this.rows - 1 - row;
        const v = this.spawn(reel, grid[reel]![row]!);
        const y = this.layout.cell(reel, row).y;
        v.node.setPosition(0, y + (row + 1) * this.layout.cellH + 30, 0);
        this.cells[reel]![row] = v;
        falls.push(this.land(v.node, y, this.slammed ? 0 : fall / 1000, this.slammed ? 0 : (start + k * stagger) / 1000));
      }
      cursor = Math.max(cursor, start + (this.rows - 1) * stagger + fall);
      const here = grid[reel]!.filter(c => c.s === this.scatterId).length;
      scattersSoFar += here;
      const soFar = scattersSoFar;
      landings.push(Promise.all(falls).then(() => { this.hooks.onReelStop(reel, soFar, here); }));
    }
    await Promise.all(landings);
    this.endSpin();
  }

  /** Tap to stop: everything lands now. */
  slam(): void {
    this.slammed = true;
    this.finishAll();
    this.endSpin();
  }

  /** Stops every animation at once and releases anything waiting on one. */
  finishAll(): void {
    // Only the board's own tweens: other screens (ticker, marquee, windows) keep running.
    this.each(v => { Tween.stopAllByTarget(v.node); Tween.stopAllByTarget(v.fade); });
    this.beamLightFades.forEach(f => Tween.stopAllByTarget(f));
    this.columns.forEach(c => Tween.stopAllByTarget(c));
    for (const done of Array.from(this.pending)) done();
  }

  /** Lights the winning cells and dims the rest. Winners move to the win layer so they draw above every reel. */
  highlight(positions: Pos[]): void {
    this.lowerWinners();
    const win = new Set(positions.map(p => `${p.reel}:${p.row}`));
    this.each((v, reel, row) => {
      const on = win.has(`${reel}:${row}`);
      if (on) this.raiseWinner(v, reel);
      v.setWin(on);
      v.setDim(!on);
    });
  }

  clearMarks(): void {
    this.lowerWinners();
    this.each(v => { v.setWin(false); v.setDim(false); v.setCelebrate(false); });
  }

  /** Winning gold cards flip over to their back; they become WILD after the drop. */
  async flipToBack(positions: Pos[], pace: Pace): Promise<void> {
    const d = pace.t.wildReveal / 1000;
    await Promise.all(positions.map(p => {
      const v = this.cells[p.reel]![p.row];
      if (!v) return Promise.resolve();
      // Back into its column at its exact cell (the other winners are still bursting in the win layer).
      this.lowerWinners(v);
      Tween.stopAllByTarget(v.node);
      v.node.angle = 0;
      return this.anim(done => { void v.flip(d, () => v.showBack()).then(done); });
    }));
  }

  /** Card backs flip to show WILD. */
  async revealWild(positions: Pos[], wildId: string, pace: Pace): Promise<void> {
    const d = pace.t.wildReveal / 1000;
    await Promise.all(positions.map(p => {
      const v = this.cells[p.reel]![p.row];
      if (!v) return Promise.resolve();
      return this.anim(done => {
        // The new WILD shows only its resting wild glow; it glows as a winner when it wins the next step.
        void v.flip(d, () => v.setCell({ s: wildId, g: false })).then(() => done());
      });
    }));
  }

  /** Winning cards burst: a hard shake, then fade out. */
  async pop(removed: Pos[], pace: Pace): Promise<void> {
    const d = pace.t.pop / 1000;
    this.hooks.onBurst(removed.map(p => this.cellWorld(p)));
    await Promise.all(removed.map(p => {
      const v = this.cells[p.reel]![p.row];
      if (!v) return Promise.resolve();
      v.setWin(false);
      const x = v.node.position.x, y = v.node.position.y;
      return this.anim(done => {
        tween(v.node)
          .to(d * 0.15, { position: new Vec3(x - 3, y, 0) }).to(d * 0.15, { position: new Vec3(x + 3, y, 0) })
          .to(d * 0.15, { position: new Vec3(x - 2, y, 0) }).to(d * 0.15, { position: new Vec3(x, y, 0) }).start();
        tween(v.fade).delay(d * 0.45).to(d * 0.55, { opacity: 0 }).call(done).start();
      });
    }));
    for (const p of removed) { this.cells[p.reel]![p.row]?.node.destroy(); this.cells[p.reel]![p.row] = null; }
  }

  /** Cards above the gaps fall down, new cards fall in on top, then the grid is exactly `next`. */
  async drop(next: Grid, removed: Pos[], pace: Pace, backs: Pos[] = []): Promise<void> {
    const d = pace.t.drop / 1000;
    this.lowerWinners();
    const moves: Array<Promise<void>> = [];
    for (let reel = 0; reel < this.reels; reel++) {
      const kept = this.cells[reel]!.filter((v): v is SymbolView => v !== null);
      const missing = this.rows - kept.length;
      const column: SymbolView[] = [];
      for (let i = 0; i < missing; i++) {
        const v = this.spawn(reel, next[reel]![i]!);
        v.node.setPosition(0, this.layout.cell(reel, i).y + this.layout.height + this.layout.cellH, 0);
        column.push(v);
      }
      column.push(...kept);
      this.cells[reel] = column;
      column.forEach((v, row) => {
        Tween.stopAllByTarget(v.node);
        v.node.angle = 0;
        const y = this.layout.cell(reel, row).y;
        if (Math.abs(v.node.position.y - y) < 0.5) return;
        moves.push(this.land(v.node, y, d, missing > 0 ? reel * d * 0.08 : 0));
      });
    }
    void removed;
    await Promise.all(moves);
    // Anything that differs from the engine's grid (golden to wild, for example) is corrected here.
    const isBack = new Set(backs.map(p => `${p.reel}:${p.row}`));
    this.each((v, reel, row) => {
      v.setDim(false);
      if (isBack.has(`${reel}:${row}`)) { if (!v.isBack) v.showBack(); return; }
      const cell = next[reel]![row]!;
      if (v.symbol !== cell.s || v.isBack) v.setCell(cell);
    });
  }

  /** Scatters pulse before free spins start. */
  celebrate(symbol: string): void {
    this.each(v => {
      const hit = v.symbol === symbol;
      v.setDim(!hit);
      v.setCelebrate(hit);
    });
  }

  endCelebrate(): void { this.clearMarks(); }

  /** Variant D multiplier spots: x2, x4... badges on cells. */
  showSpots(spots: number[][] | undefined): void {
    this.spotLayer.removeAllChildren();
    if (!spots) return;
    spots.forEach((col, reel) => col.forEach((v, row) => {
      if (v <= 1) return;
      const c = this.layout.cell(reel, row);
      const badge = makeLabel(this.spotLayer, `x${v}`, 30, '#fff3b0', c.x + this.layout.cellW / 2 - 34, c.y + this.layout.cellH / 2 - 26, 70);
      badge.enableOutline = true;
      badge.outlineColor = hex('#5a2a00');
      badge.outlineWidth = 4;
    }));
  }

  // --- helpers -------------------------------------------------------------------------------

  /**
   * Puts the beam on `reel` (the previous reel's beam goes out). Cards in the beam reel stay bright;
   * every other non-scatter card dims, and scatters celebrate at the faster anticipation period.
   */
  private moveBeam(reel: number): void {
    this.beamLights.forEach((light, r) => {
      const on = r === reel;
      const fade = this.beamLightFades[r]!;
      Tween.stopAllByTarget(fade);
      light.active = on;
      this.beamGlows[r]!.active = on;
      if (on) this.pulseBeamLight(fade);
    });
    const antic = GLOW_STYLE.celebrate.anticipationPeriodSec;
    this.each((v, r) => {
      const sc = v.symbol === this.scatterId;
      v.setDim(r !== reel && !sc);
      v.setCelebrate(sc, antic);
    });
  }

  /** The beam light breathes between its low and high opacity. */
  private pulseBeamLight(fade: UIOpacity): void {
    const { min, max, halfSec } = GLOW_STYLE.beam.pulse;
    fade.opacity = Math.round(min * 255);
    tween(fade).repeatForever(tween<UIOpacity>()
      .to(halfSec, { opacity: Math.round(max * 255) }, { easing: 'sineInOut' })
      .to(halfSec, { opacity: Math.round(min * 255) }, { easing: 'sineInOut' })).start();
  }

  private endSpin(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    this.beamLights.forEach((light, r) => {
      Tween.stopAllByTarget(this.beamLightFades[r]!);
      light.active = false;
      this.beamGlows[r]!.active = false;
    });
    this.each(v => { v.setCelebrate(false); v.setDim(false); });
  }

  /** Moves a winning card into the win layer, keeping its place on the board. */
  private raiseWinner(v: SymbolView, reel: number): void {
    if (v.node.parent === this.winLayer) return;
    const x = this.columns[reel]!.position.x + v.node.position.x, y = v.node.position.y;
    this.winLayer.addChild(v.node);
    v.node.setPosition(x, y, 0);
    this.winners.push({ view: v, reel });
  }

  /** Puts winners (all, or just `only`) back into their reel at their exact cell: local x 0, angle 0, no win look. */
  private lowerWinners(only?: SymbolView): void {
    const keep: typeof this.winners = [];
    for (const w of this.winners) {
      if (!w.view.node.isValid) continue;
      if (only && w.view !== only) { keep.push(w); continue; }
      w.view.setWin(false);
      this.columns[w.reel]!.addChild(w.view.node);
      w.view.node.setPosition(0, w.view.node.position.y, 0);
      w.view.node.angle = 0;
    }
    this.winners = keep;
  }

  private later(fn: () => void, ms: number): void {
    if (this.slammed) return;
    this.timers.push(setTimeout(() => { if (!this.slammed) fn(); }, ms));
  }

  private empty(): Array<Array<SymbolView | null>> {
    return Array.from({ length: this.reels }, () => new Array<SymbolView | null>(this.rows).fill(null));
  }

  private clearAll(): void {
    for (const col of this.columns) col.removeAllChildren();
    this.winLayer.removeAllChildren();
    this.winners = [];
    this.cells = this.empty();
    this.spotLayer.removeAllChildren();
  }

  private spawn(reel: number, cell: Cell): SymbolView {
    const v = this.makeSymbol(cell);
    this.columns[reel]!.addChild(v.node);
    return v;
  }

  private each(fn: (v: SymbolView, reel: number, row: number) => void): void {
    this.cells.forEach((col, reel) => col.forEach((v, row) => { if (v) fn(v, reel, row); }));
  }

  /** Runs an animation as a promise that also resolves when finishAll() is called. */
  private anim(start: (done: () => void) => void): Promise<void> {
    return new Promise(resolve => {
      const done = (): void => { this.pending.delete(done); resolve(); };
      this.pending.add(done);
      start(done);
    });
  }

  private moveTo(node: Node, x: number, y: number, seconds: number, delay: number, easing: 'quadIn' | 'quadOut'): Promise<void> {
    return this.anim(done => {
      tween(node).delay(delay).to(seconds, { position: new Vec3(x, y, 0) }, { easing }).call(done).start();
    });
  }

  /** A card falls to y with a small bounce at the end. */
  private land(node: Node, y: number, seconds: number, delay: number): Promise<void> {
    return this.anim(done => {
      const x = node.position.x;
      if (seconds <= 0) { node.setPosition(x, y, 0); done(); return; }
      tween(node).delay(delay)
        .to(seconds * 0.82, { position: new Vec3(x, y - 8, 0) }, { easing: 'quadIn' })
        .to(seconds * 0.18, { position: new Vec3(x, y, 0) }, { easing: 'quadOut' })
        .call(done).start();
    });
  }
}

