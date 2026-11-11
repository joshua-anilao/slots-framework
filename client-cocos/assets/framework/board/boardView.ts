import { Mask, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import type { Cell, Grid, Pos } from '../../shared/math-core/index';
import { uiNode } from '../ui/uiKit';
import type { BoardLayout } from './boardLayout';
import { SymbolView } from './symbolView';

/** All the board's timings in one place (seconds), so the game can tune the feel. */
export interface BoardTiming {
  /** Delay between one reel starting to drop and the next. */
  reelStagger: number;
  /** Seconds for a card to fall to its place. */
  fall: number;
  /** Seconds the winning cards are shown before they pop. */
  highlight: number;
  /** Seconds winning cards take to fade out. */
  pop: number;
  /** Pause after each cascade step. */
  stepPause: number;
}

/**
 * The reels: a grid of SymbolViews inside a clipping window. It only animates what the presenter tells it;
 * the grid it shows always comes from a RoundResult.
 */
export class BoardView {
  readonly node: Node;
  private readonly content: Node;
  private cells: Array<Array<SymbolView | null>>;
  private readonly pending = new Set<() => void>();

  constructor(
    parent: Node,
    private readonly reels: number,
    private readonly rows: number,
    private readonly layout: BoardLayout,
    private readonly makeSymbol: (cell: Cell) => SymbolView,
    private readonly timing: BoardTiming,
  ) {
    this.node = uiNode('Board', layout.width, layout.height);
    const mask = this.node.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    this.content = uiNode('Cards', layout.width, layout.height);
    this.node.addChild(this.content);
    parent.addChild(this.node);
    this.cells = this.empty();
  }

  /** Symbol ids on the board, [reel][row]. Used by tests to compare with the engine's grid. */
  snapshot(): string[][] {
    return this.cells.map(col => col.map(v => v?.symbol ?? ''));
  }

  /** Shows a grid at once, no animation. */
  setGrid(grid: Grid): void {
    this.clear();
    for (let reel = 0; reel < this.reels; reel++) {
      for (let row = 0; row < this.rows; row++) {
        const view = this.spawn(grid[reel]![row]!);
        const p = this.layout.cell(reel, row);
        view.node.setPosition(p.x, p.y, 0);
        this.cells[reel]![row] = view;
      }
    }
  }

  /** New cards fall in from above, reel by reel. */
  async land(grid: Grid): Promise<void> {
    this.clear();
    const above = this.layout.height + this.layout.card;
    const falls: Array<Promise<void>> = [];
    for (let reel = 0; reel < this.reels; reel++) {
      for (let row = 0; row < this.rows; row++) {
        const view = this.spawn(grid[reel]![row]!);
        const p = this.layout.cell(reel, row);
        view.node.setPosition(p.x, p.y + above, 0);
        this.cells[reel]![row] = view;
        falls.push(this.moveTo(view.node, p.x, p.y, this.timing.fall, reel * this.timing.reelStagger));
      }
    }
    await Promise.all(falls);
  }

  /** Winning cards stay bright, the rest dim, for a moment. */
  async highlight(positions: Pos[]): Promise<void> {
    const win = new Set(positions.map(p => `${p.reel},${p.row}`));
    this.each((v, reel, row) => v.setDim(!win.has(`${reel},${row}`)));
    await this.wait(this.timing.highlight);
  }

  /** Removed cards fade out and are cleared from the board. */
  async pop(removed: Pos[]): Promise<void> {
    const fades = removed.map(p => {
      const v = this.cells[p.reel]![p.row];
      return v ? this.fadeOut(v) : Promise.resolve();
    });
    await Promise.all(fades);
    for (const p of removed) { this.cells[p.reel]![p.row]?.node.destroy(); this.cells[p.reel]![p.row] = null; }
  }

  /** Cards above the gaps fall down, new cards from the strip fall in on top, then the grid is exactly `grid`. */
  async drop(grid: Grid, removed: Pos[]): Promise<void> {
    const above = this.layout.height + this.layout.card;
    const moves: Array<Promise<void>> = [];
    for (let reel = 0; reel < this.reels; reel++) {
      const kept = this.cells[reel]!.filter((v): v is SymbolView => v !== null);
      const missing = this.rows - kept.length;
      const column: Array<SymbolView> = [];
      for (let i = 0; i < missing; i++) {
        const view = this.spawn(grid[reel]![i]!);
        const p = this.layout.cell(reel, i);
        view.node.setPosition(p.x, p.y + above, 0);
        column.push(view);
      }
      column.push(...kept);
      this.cells[reel] = column;
      column.forEach((view, row) => {
        const p = this.layout.cell(reel, row);
        moves.push(this.moveTo(view.node, p.x, p.y, this.timing.fall, missing > 0 ? reel * this.timing.reelStagger * 0.5 : 0));
      });
    }
    void removed;
    await Promise.all(moves);
    // Golden cards that became wilds, and any other change, show up here.
    this.each((v, reel, row) => { v.setCell(grid[reel]![row]!); v.setDim(false); });
    await this.wait(this.timing.stepPause);
  }

  /** Player skipped: stop every animation at once and release anything waiting on one. */
  finish(): void {
    Tween.stopAll();
    for (const done of Array.from(this.pending)) done();
  }

  // --- helpers -------------------------------------------------------------------------------

  private empty(): Array<Array<SymbolView | null>> {
    return Array.from({ length: this.reels }, () => new Array<SymbolView | null>(this.rows).fill(null));
  }

  private clear(): void {
    this.content.removeAllChildren();
    this.cells = this.empty();
  }

  private spawn(cell: Cell): SymbolView {
    const v = this.makeSymbol(cell);
    this.content.addChild(v.node);
    return v;
  }

  private each(fn: (v: SymbolView, reel: number, row: number) => void): void {
    this.cells.forEach((col, reel) => col.forEach((v, row) => { if (v) fn(v, reel, row); }));
  }

  /** Runs an animation as a promise that also resolves when finish() is called. */
  private anim(start: (done: () => void) => void): Promise<void> {
    return new Promise(resolve => {
      const done = (): void => { this.pending.delete(done); resolve(); };
      this.pending.add(done);
      start(done);
    });
  }

  private wait(seconds: number): Promise<void> {
    return this.anim(done => { setTimeout(done, seconds * 1000); });
  }

  private moveTo(node: Node, x: number, y: number, seconds: number, delay: number): Promise<void> {
    return this.anim(done => {
      tween(node).delay(delay).to(seconds, { position: new Vec3(x, y, 0) }, { easing: 'quadIn' }).call(done).start();
    });
  }

  private fadeOut(v: SymbolView): Promise<void> {
    return this.anim(done => {
      tween(v.fade as UIOpacity).to(this.timing.pop, { opacity: 0 }).call(done).start();
    });
  }
}

