import { Observable } from '../core/observable';

/** Where the spin flow is. */
export type SpinPhase = 'idle' | 'requesting' | 'presenting';

/** State of the current / last round, for the UI. */
export class SpinModel {
  readonly phase = new Observable<SpinPhase>('idle');
  readonly lastWin = new Observable<number>(0);
  readonly lastRoundId = new Observable<string>('');
  /** Multiplier shown on the multiplier bar (views update it during playback). */
  readonly multiplier = new Observable<number>(1);
  /** Free spins left during playback (views update it). */
  readonly freeSpinsLeft = new Observable<number>(0);
  get isBusy(): boolean { return this.phase.value !== 'idle'; }
}
