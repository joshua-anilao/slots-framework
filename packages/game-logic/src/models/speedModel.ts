import { Observable } from '../core/observable';

export type SpeedMode = 'normal' | 'turbo' | 'super';

/** Spin speed: normal, turbo, super turbo. Timings live in the presentation config. */
export class SpeedModel {
  readonly mode = new Observable<SpeedMode>('normal');
}
