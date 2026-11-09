import { Observable } from '../core/observable';

/** Balance shown on screen. */
export class WalletModel {
  readonly balance: Observable<number>;
  constructor(initial: number) { this.balance = new Observable(initial); }
}
