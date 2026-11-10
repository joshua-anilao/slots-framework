import { Observable } from '../core/observable';
import type { ReadOnlyObservable } from '../core/observable';
import { StateMachine } from '../core/stateMachine';

/** When auto spin should stop by itself. */
export interface AutoSpinStopConditions {
  /** Stop when free spins are triggered. */
  onFeature: boolean;
  /** Stop when one round wins at least this much (currency). 0 = off. */
  singleWinAtLeast: number;
  /** Stop when the balance has dropped by this much since auto spin started. 0 = off. */
  balanceDropBy: number;
  /** Stop when the balance falls below this amount. 0 = off. */
  balanceBelow: number;
  /** Stop when the balance rises above this amount. 0 = off. */
  balanceAbove: number;
}

export const DEFAULT_AUTO_STOP: AutoSpinStopConditions = { onFeature: true, singleWinAtLeast: 0, balanceDropBy: 0, balanceBelow: 0, balanceAbove: 0 };

/** idle → running → (stopping →) idle. Stopping = the player pressed stop and the current spin is finishing. */
export type AutoSpinState = 'idle' | 'running' | 'stopping';
export type AutoSpinEvent = 'start' | 'stop' | 'finish';

/** Auto spin state. remaining = Infinity means until stopped. */
export class AutoSpinModel {
  readonly machine = new StateMachine<AutoSpinState, AutoSpinEvent>('idle', {
    idle: { start: 'running' },
    running: { stop: 'stopping', finish: 'idle' },
    stopping: { finish: 'idle' },
  });
  private readonly running = new Observable<boolean>(false);
  /** True only while running (false as soon as the player presses stop). */
  get active(): ReadOnlyObservable<boolean> { return this.running; }
  constructor() { this.machine.state.subscribe(s => this.running.set(s === 'running')); }
  readonly remaining = new Observable<number>(0);
  conditions: AutoSpinStopConditions = { ...DEFAULT_AUTO_STOP };
  startBalance = 0;
}
