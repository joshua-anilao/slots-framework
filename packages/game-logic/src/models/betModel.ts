import { Observable } from '../core/observable';

/** Bet levels and the selected bet. */
export class BetModel {
  readonly index: Observable<number>;
  constructor(readonly levels: number[], defaultIndex: number) {
    this.index = new Observable(defaultIndex);
  }
  get bet(): number { return this.levels[this.index.value]; }
  get canIncrease(): boolean { return this.index.value < this.levels.length - 1; }
  get canDecrease(): boolean { return this.index.value > 0; }
}
