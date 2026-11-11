import type { IRoundPresenter, SpeedMode, SpinResponse } from '../../shared/game-logic/index';
import type { SpinOutcome } from '../../shared/math-core/index';
import type { BoardView } from './boardView';
import { finalGrid, planSpin, spinsOf } from './playbackPlan';

/** What the presenter updates besides the board. The game implements it with its own labels. */
export interface IRoundHud {
  setWin(amount: number): void;
  setMultiplier(multiplier: number): void;
  /** Short status line, for example "FREE SPINS 2/8". Empty text clears it. */
  setStatus(text: string): void;
}

/** Plays sounds by name. The game passes its AudioManager.play. */
export type PlaySfx = (name: string, level?: number) => void;

/**
 * Plays a RoundResult on the Cocos board: each spin lands, then cascades (win, pop, drop) until nothing wins.
 * Module 6 plays base and free spins one after another; intros, big-win banners and speed modes come later.
 */
export class CocosRoundPresenter implements IRoundPresenter {
  private board: BoardView | undefined;
  private hud: IRoundHud | undefined;
  private sfx: PlaySfx = () => undefined;
  private snapRequested = false;

  attach(board: BoardView, hud: IRoundHud, sfx?: PlaySfx): void {
    this.board = board;
    this.hud = hud;
    if (sfx) this.sfx = sfx;
  }

  async present(response: SpinResponse, _speed: SpeedMode): Promise<void> {
    const { board, hud } = this;
    if (!board || !hud) return;
    const result = response.result;
    const spins = spinsOf(result);
    const freeFrom = result.base ? 1 : 0;
    hud.setWin(0);
    let shown = 0;
    for (let i = 0; i < spins.length; i++) {
      const isFree = i >= freeFrom;
      hud.setStatus(isFree ? `FREE SPINS ${i - freeFrom + 1}/${spins.length - freeFrom}` : '');
      shown = await this.playSpin(spins[i]!, shown);
    }
    hud.setStatus('');
    hud.setWin(result.totalWin);
  }

  skip(): void {
    this.snapRequested = true;
    this.board?.finish();
  }

  private async playSpin(spin: SpinOutcome, shownBefore: number): Promise<number> {
    const { board, hud } = this;
    if (!board || !hud) return shownBefore;
    this.snapRequested = false;
    let shown = shownBefore;
    for (const op of planSpin(spin)) {
      if (this.snapRequested) break;
      switch (op.op) {
        case 'land':
          hud.setMultiplier(op.multiplier);
          this.sfx('spin');
          await board.land(op.grid);
          this.sfx('reelStop');
          break;
        case 'win':
          hud.setMultiplier(op.multiplier);
          shown += op.stepWin;
          hud.setWin(shown);
          this.sfx('win', Math.min(op.index, 6));
          await board.highlight(op.positions);
          break;
        case 'pop':
          this.sfx('pop');
          await board.pop(op.removed);
          break;
        case 'drop':
          await board.drop(op.grid, op.removed);
          break;
      }
    }
    // Skipped or finished: the board always ends on the engine's final grid and the exact spin win.
    const grid = finalGrid(spin);
    if (grid) board.setGrid(grid);
    this.snapRequested = false;
    return shownBefore + spin.spinWin;
  }
}
