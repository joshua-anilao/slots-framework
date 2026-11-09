import { Observable } from '../core/observable';

/** When auto spin should stop by itself. */
export interface AutoSpinStopConditions {
  /** Stop when free spins are triggered. */
  onFeature: boolean;
  /** Stop when one round wins at least this much (currency). 0 = off. */
  singleWinAtLeast: number;
  /** Stop when the balance has dropped by this much since auto spin started. 0 = off. */
  balanceDropBy: number;
}

export const DEFAULT_AUTO_STOP: AutoSpinStopConditions = { onFeature: true, singleWinAtLeast: 0, balanceDropBy: 0 };

/** Auto spin state. remaining = Infinity means until stopped. */
export class AutoSpinModel {
  readonly active = new Observable<boolean>(false);
  readonly remaining = new Observable<number>(0);
  conditions: AutoSpinStopConditions = { ...DEFAULT_AUTO_STOP };
  startBalance = 0;
}
