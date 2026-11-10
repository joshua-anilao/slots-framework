import type { Grid, Pos } from '@slots/math-core';
import { el } from '../core/dom';
import type { Pace, SpinStyle } from '../core/pace';
import type { Theme } from '../theme/theme';

export const CELL_W = 128;
export const CELL_H = 150;
const REEL_GAP = 6;

/** Where a cell ends up after the cascade drop: it falls by the number of removed cells below it. */
export function rowAfterDrop(p: Pos, removed: Pos[]): number {
  return p.row + removed.filter(r => r.reel === p.reel && r.row > p.row).length;
}

/**
 * The 5x4 reel area (feature 21: reel spinning). Only animates; the grid always
 * comes from the Spin Result. One column element per reel, cells absolutely placed.
 */
export class ReelsView {
  readonly root: HTMLElement;
  private readonly cols: HTMLElement[] = [];
  private cells: HTMLElement[][] = [];
  private spotLayer: HTMLElement;
  private running: Animation[] = [];
  private timers: number[] = [];
  private slammed = false;
  private grid: Grid;
  /** "drop" = cards fall out and in (card cascade games); "scroll" = spinning strips. */
  spinStyle: SpinStyle = 'drop';
  /** Sound hooks: a reel landed (with how many scatters have landed so far), anticipation started. */
  onReelStop: (reel: number, scattersSoFar: number, newScatters: number) => void = () => {};
  onAnticipate: () => void = () => {};

  constructor(private theme: Theme, private readonly reelCount: number, private readonly rows: number,
    private readonly blurPool: string[], private readonly scatterId: string) {
    this.root = el('div.reels');
    for (let r = 0; r < reelCount; r++) {
      const col = el('div.reel');
      col.style.height = `${rows * CELL_H}px`;
      this.cols.push(col);
      this.root.append(col);
    }
    this.spotLayer = el('div.spots');
    this.root.append(this.spotLayer);
    this.grid = this.randomGrid();
    this.setGrid(this.grid);
  }

  setTheme(theme: Theme): void { this.theme = theme; this.setGrid(this.grid); }

  cellEl(p: Pos): HTMLElement { return this.cells[p.reel][p.row]; }

  /**
   * Game intro after Continue: cards flip in one at a time, top to bottom in a column,
   * then the next column (Josh, 2026-11-09). onColumn fires as each column completes.
   */
  async reveal(cardMs: number, gapMs: number, delay = 0, onColumn?: (reel: number) => void): Promise<void> {
    const anims: Promise<unknown>[] = [];
    let k = 0;
    this.cells.forEach((col, r) => {
      col.forEach(n => {
        anims.push(n.animate([
          { transform: 'perspective(600px) rotateY(90deg)', opacity: 0, filter: 'brightness(2.5)' },
          { transform: 'perspective(600px) rotateY(0)', opacity: 1, filter: 'brightness(1)' },
        ], { duration: cardMs, delay: delay + k * gapMs, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }).finished.catch(() => {}));
        k++;
      });
      if (onColumn) setTimeout(() => onColumn(r), delay + k * gapMs);
    });
    await Promise.all(anims);
  }

  /** Draws a grid with no animation. `backs` are drawn as card backs (gold cards waiting to become WILD). */
  setGrid(grid: Grid, backs: Pos[] = []): void {
    this.grid = grid;
    const isBack = new Set(backs.map(p => `${p.reel}:${p.row}`));
    this.cells = grid.map((col, r) => {
      const strip = el('div.strip');
      const nodes = col.map((cell, row) => this.place(isBack.has(`${r}:${row}`) ? this.theme.cardBack() : this.theme.symbol(cell), row));
      strip.append(...nodes);
      this.cols[r].replaceChildren(strip);
      return nodes;
    });
  }

  /** Spins and lands on `grid`. With 2+ scatters landed, later reels slow down under a spotlight (never changes the result). */
  async spin(grid: Grid, pace: Pace): Promise<void> {
    this.clearMarks();
    this.slammed = false;
    this.running = [];
    if (this.spinStyle === 'drop') await this.spinDrop(grid, pace);
    else await this.spinScroll(grid, pace);
    this.endSpin();
    this.setGrid(grid);
  }

  /** Tap to stop: everything lands now. */
  slam(): void {
    this.slammed = true;
    for (const a of this.running) a.finish();
    this.endSpin();
  }

  /** Jumps every running card animation to its end (infinite CSS loops are left alone). */
  finishAll(): void {
    for (const a of this.root.getAnimations({ subtree: true })) {
      if (a.effect?.getComputedTiming().endTime === Infinity) continue;
      try { a.finish(); } catch { /* already done */ }
    }
  }

  /** Lights the winning cells and dims the rest. */
  highlight(positions: Pos[]): void {
    const win = new Set(positions.map(p => `${p.reel}:${p.row}`));
    this.root.classList.add('dimmed');
    this.cells.forEach((col, r) => {
      let any = false;
      col.forEach((n, row) => {
        const on = win.has(`${r}:${row}`);
        any ||= on;
        n.classList.toggle('win', on);
        n.classList.toggle('dim', !on);
      });
      // A column with winners stops clipping, so its cards can sway and glow over the neighbours.
      this.cols[r].classList.toggle('has-win', any);
    });
  }

  clearMarks(): void {
    this.root.classList.remove('dimmed');
    for (const col of this.cells) for (const n of col) n.classList.remove('win', 'dim');
    for (const c of this.cols) c.classList.remove('has-win');
  }

  /** Winning gold cards flip over to their back; they become WILD after the drop. */
  async flipToBack(positions: Pos[], pace: Pace): Promise<void> {
    if (!positions.length) return;
    const d = pace.t.wildReveal;
    await Promise.all(positions.map(async p => {
      const old = this.cells[p.reel][p.row];
      await old.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: d / 2, easing: 'ease-in' }).finished.catch(() => {});
      const back = this.place(this.theme.cardBack(), p.row);
      old.replaceWith(back);
      this.cells[p.reel][p.row] = back;
      await back.animate([{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }], { duration: d / 2, easing: 'ease-out' }).finished.catch(() => {});
    }));
  }

  /** Card backs flip to show WILD. */
  async revealWild(positions: Pos[], wildId: string, pace: Pace): Promise<void> {
    if (!positions.length) return;
    const d = pace.t.wildReveal;
    await Promise.all(positions.map(async p => {
      const old = this.cells[p.reel][p.row];
      await old.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: d / 2, easing: 'ease-in' }).finished.catch(() => {});
      const wild = this.place(this.theme.symbol({ s: wildId, g: false }), p.row);
      wild.classList.add('to-wild');
      old.replaceWith(wild);
      this.cells[p.reel][p.row] = wild;
    }));
    await pace.wait(d / 2);
  }

  /** Winning cards burst. */
  async pop(removed: Pos[], pace: Pace): Promise<void> {
    const d = pace.t.pop;
    for (const p of removed) this.cells[p.reel][p.row].classList.remove('win');
    for (const c of this.cols) c.classList.remove('has-win'); // clip again before new cards fall in from above
    const anims = removed.map(p => this.cells[p.reel][p.row].animate(
      // Burst without any scaling (Josh: no squash and stretch): a hard shake, flash, then fade.
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1, filter: 'brightness(1)' },
        { transform: 'translate(-2px,0) rotate(-1deg)', filter: 'brightness(1.8)', offset: 0.15 },
        { transform: 'translate(2px,0) rotate(1deg)', filter: 'brightness(2.2)', offset: 0.3 },
        { transform: 'translate(-1px,0) rotate(-.5deg)', filter: 'brightness(2.6)', offset: 0.45 },
        { transform: 'translate(0,0) rotate(0)', opacity: 1, filter: 'brightness(3)', offset: 0.6 },
        { transform: 'translate(0,0) rotate(0)', opacity: 0, filter: 'brightness(3)' }],
      { duration: d, easing: 'ease-in', fill: 'forwards' }).finished);
    await Promise.race([Promise.all(anims), pace.wait(d + 50)]);
  }

  /** Cards above fall into the gaps; new cards fall in from the top, landing on `next`. */
  async drop(next: Grid, removed: Pos[], pace: Pace, backs: Pos[] = []): Promise<void> {
    const d = pace.t.drop;
    const anims: Promise<unknown>[] = [];
    this.setGrid(next, backs);
    this.root.classList.remove('dimmed');
    for (let r = 0; r < this.reelCount; r++) {
      const gone = new Set(removed.filter(p => p.reel === r).map(p => p.row));
      if (!gone.size) continue;
      const keptFrom = [...Array(this.rows).keys()].filter(row => !gone.has(row));
      const n = gone.size;
      for (let row = 0; row < this.rows; row++) {
        const fromRow = row < n ? row - n : keptFrom[row - n];
        const dy = (fromRow - row) * CELL_H;
        if (dy === 0) continue;
        anims.push(this.cells[r][row].animate(
          [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(6px)', offset: 0.85 }, { transform: 'translateY(0)' }],
          { duration: d, delay: r * d * 0.08, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'backwards' }).finished);
      }
    }
    await Promise.race([Promise.all(anims), pace.wait(d * 1.4 + 50)]);
  }

  /** Scatters pulse before free spins start. */
  celebrate(symbol: string): void {
    this.root.classList.add('dimmed');
    for (const col of this.cells) for (const n of col) {
      const hit = n.dataset.s === symbol;
      n.classList.toggle('celebrate', hit);
      n.classList.toggle('dim', !hit);
    }
  }

  endCelebrate(): void {
    for (const col of this.cells) for (const n of col) n.classList.remove('celebrate');
    this.clearMarks();
  }

  /** Variant D multiplier spots: shows x2, x4... badges on cells. */
  showSpots(spots: number[][] | undefined): void {
    this.spotLayer.replaceChildren();
    if (!spots) return;
    spots.forEach((col, r) => col.forEach((v, row) => {
      if (v > 1) {
        const b = el('div.spot', { text: `x${v}` });
        b.style.left = `${r * (CELL_W + REEL_GAP) + CELL_W - 46}px`;
        b.style.top = `${row * CELL_H + 6}px`;
        this.spotLayer.append(b);
      }
    }));
  }

  // ---- drop style: old cards fall out, new cards fall in reel by reel, bottom card first ----
  private async spinDrop(grid: Grid, pace: Pace): Promise<void> {
    const t = pace.t;
    const out = this.cells.flat().map((n, i) => n.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${this.rows * CELL_H + 60}px)` }],
      { duration: t.clear, delay: (i % this.rows) * 0 + Math.floor(i / this.rows) * 15, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' }));
    this.running = out;
    await Promise.all(out.map(a => a.finished.catch(() => {})));

    this.setGrid(grid);
    let scattersSoFar = 0;
    let cursor = 0;
    let anticipating = false;
    const landings: Promise<void>[] = [];
    for (let r = 0; r < this.reelCount; r++) {
      const antic = t.anticipation > 0 && scattersSoFar >= 2;
      let start: number;
      let fall = t.cardFall;
      let stagger = t.cardStagger;
      if (antic) {
        // Near miss: the scatters already on the board glow, then this reel's cards
        // drop alone in a spotlight, slowly, one card at a time (Josh, 2026-11-09).
        start = cursor + t.anticipation * (anticipating ? 0.45 : 0.9);
        // Josh: each card falls fast, with a clear pause before the next one starts.
        fall = t.cardFall * 0.7;
        stagger = fall + t.anticipation * 0.5;
        const beamAt = cursor;
        this.later(() => {
          if (!anticipating) { anticipating = true; this.root.classList.add('antic-on'); this.onAnticipate(); }
          this.cols.forEach((c, i) => c.classList.toggle('beam', i === r));
        }, beamAt);
      } else {
        start = r * t.reelStagger;
      }
      const reelAnims: Animation[] = [];
      for (let row = this.rows - 1; row >= 0; row--) {
        const k = this.rows - 1 - row;
        const a = this.cells[r][row].animate([
          { transform: `translateY(${-(row + 1) * CELL_H - 30}px)` },
          { transform: 'translateY(8px)', offset: 0.82 },
          { transform: 'translateY(0)' },
        ], { duration: this.slammed ? 0 : fall, delay: this.slammed ? 0 : start + k * stagger, easing: 'cubic-bezier(.45,0,.75,1)', fill: 'backwards' });
        reelAnims.push(a);
        this.running.push(a);
      }
      const end = start + (this.rows - 1) * stagger + fall;
      cursor = Math.max(cursor, end);
      const here = grid[r].filter(c => c.s === this.scatterId).length;
      scattersSoFar += here;
      const soFar = scattersSoFar;
      landings.push(Promise.all(reelAnims.map(a => a.finished.catch(() => {}))).then(() => {
        this.cols[r].classList.add('land');
        setTimeout(() => this.cols[r].classList.remove('land'), 180);
        this.onReelStop(r, soFar, here);
      }));
    }
    await Promise.all(landings);
  }

  // ---- scroll style: classic strips that stop left to right ----
  private async spinScroll(grid: Grid, pace: Pace): Promise<void> {
    const t = pace.t;
    let scattersSoFar = 0;
    let extra = 0;
    const anims: Promise<void>[] = [];
    for (let r = 0; r < this.reelCount; r++) {
      const anticipate = t.anticipation > 0 && scattersSoFar >= 2;
      if (anticipate) extra += t.anticipation;
      const duration = t.firstStop + r * t.stopGap + extra;
      const here = grid[r].filter(c => c.s === this.scatterId).length;
      scattersSoFar += here;
      const soFar = scattersSoFar;
      anims.push(this.scrollReel(r, grid[r], duration, anticipate).then(() => this.onReelStop(r, soFar, here)));
    }
    await Promise.all(anims);
  }

  private scrollReel(r: number, target: Grid[number], duration: number, anticipate: boolean): Promise<void> {
    const col = this.cols[r];
    const fillers = Math.max(4, Math.round(duration / 45));
    const strip = el('div.strip');
    target.forEach((cell, row) => strip.append(this.place(this.theme.symbol(cell), row)));
    for (let k = 0; k < fillers; k++) {
      strip.append(this.place(this.theme.blurSymbol(this.blurPool[(Math.random() * this.blurPool.length) | 0]), this.rows + k));
    }
    this.cells[r].forEach((n, row) => { n.classList.remove('win', 'dim'); strip.append(this.place(n, this.rows + fillers + row)); });
    col.replaceChildren(strip);
    const start = -(this.rows + fillers) * CELL_H;
    const anim = strip.animate([
      { transform: `translateY(${start}px)` },
      { transform: `translateY(${start - 18}px)`, offset: 0.06 },
      { transform: 'translateY(14px)', offset: 0.93 },
      { transform: 'translateY(0)' },
    ], { duration: this.slammed ? 0 : duration, easing: 'cubic-bezier(.3,.0,.4,1)', fill: 'forwards' });
    this.running.push(anim);
    if (anticipate) this.later(() => { col.classList.add('beam'); this.root.classList.add('antic-on'); this.onAnticipate(); }, duration - 900);
    return anim.finished.catch(() => {}).then(() => { col.classList.remove('beam'); col.classList.add('land'); setTimeout(() => col.classList.remove('land'), 180); });
  }

  private later(fn: () => void, ms: number): void {
    if (this.slammed) return;
    this.timers.push(window.setTimeout(() => { if (!this.slammed) fn(); }, ms));
  }

  private endSpin(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    this.root.classList.remove('antic-on');
    for (const c of this.cols) c.classList.remove('beam');
  }

  private place(node: HTMLElement, row: number): HTMLElement {
    node.style.top = `${row * CELL_H}px`;
    return node;
  }

  private randomGrid(): Grid {
    return Array.from({ length: this.reelCount }, () => Array.from({ length: this.rows },
      () => ({ s: this.blurPool[(Math.random() * this.blurPool.length) | 0], g: false })));
  }
}
