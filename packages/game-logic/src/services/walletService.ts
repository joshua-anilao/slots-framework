/** Player balance. Demo balance now, operator wallet later. */
export interface IWalletService {
  getBalance(): Promise<number>;
}

/** In-memory demo wallet. */
export class LocalWallet implements IWalletService {
  constructor(private balance: number) {}
  async getBalance(): Promise<number> { return this.balance; }
  /** Used by the local spin service only. A real server owns the balance. */
  apply(delta: number): number {
    this.balance = Math.round((this.balance + delta) * 100) / 100;
    return this.balance;
  }
  peek(): number { return this.balance; }
}
