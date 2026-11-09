import type { IRng } from '@slots/math-core';

/** One "JOS**** just won ₱15,000!" message. */
export interface WinFeedItem {
  name: string;
  amount: number;
  /** True for the demo feed. Production must only show real wins. */
  simulated: boolean;
}

/** Source of the top winner ticker. */
export interface IWinFeedService {
  subscribe(fn: (item: WinFeedItem) => void): () => void;
  start(): void;
  stop(): void;
}

/**
 * DEMO ONLY: invents winner messages for prototypes. Every item is marked simulated.
 * Never ship this to real players; use a server feed of real wins instead.
 */
export class SimulatedWinFeedService implements IWinFeedService {
  private listeners = new Set<(item: WinFeedItem) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private static readonly PREFIXES = ['JOS', 'MAR', 'ANA', 'KEN', 'RIC', 'LIZ', 'JUN', 'BEA', 'PAO', 'CHR', 'MIG', 'TIN'];

  constructor(
    private readonly rng: IRng,
    private readonly bets: number[],
    private readonly intervalMs: [number, number] = [6000, 15000],
  ) {}

  subscribe(fn: (item: WinFeedItem) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  start(): void {
    if (this.timer) return;
    const schedule = () => {
      const [a, b] = this.intervalMs;
      this.timer = setTimeout(() => { this.emit(this.next()); schedule(); }, a + this.rng.nextInt(b - a + 1));
    };
    schedule();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Builds one simulated item (exposed for tests). */
  next(): WinFeedItem {
    const p = SimulatedWinFeedService.PREFIXES;
    const name = p[this.rng.nextInt(p.length)] + '****';
    const bet = this.bets[this.rng.nextInt(this.bets.length)];
    const winX = [20, 30, 50, 80, 120, 250, 500][this.rng.nextInt(7)];
    return { name, amount: bet * winX, simulated: true };
  }

  private emit(item: WinFeedItem): void {
    for (const fn of [...this.listeners]) fn(item);
  }
}
