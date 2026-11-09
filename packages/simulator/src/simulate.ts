import { applyOverrides, SeededRng, SlotEngine } from '@slots/math-core';
import type { GameConfig, MultiplierVariant, RoundResult, SpinOutcome } from '@slots/math-core';

export interface SimOptions {
  spins: number;
  seed: number;
  variant?: MultiplierVariant;
  /** Buy bonus rounds to simulate (0 = skip). */
  buys: number;
  /** Player sessions to simulate (0 = skip). */
  sessions: number;
  sessionBalance: number;
  sessionBet: number;
  sessionMaxSpins: number;
  onProgress?: (done: number, total: number) => void;
}

export const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0x', min: 0, max: 0 },
  { label: '>0x - <1x', min: 1e-9, max: 1 },
  { label: '1x - <5x', min: 1, max: 5 },
  { label: '5x - <20x', min: 5, max: 20 },
  { label: '20x - <100x', min: 20, max: 100 },
  { label: '100x - <1,000x', min: 100, max: 1000 },
  { label: '1,000x+', min: 1000, max: Infinity },
];

export const WIN_TIERS = [
  { label: 'Big Win (10x+)', min: 10 },
  { label: 'Super Win (25x+)', min: 25 },
  { label: 'Ultra Win (50x+)', min: 50 },
];

/** Running totals for a set of rounds. */
export class Accumulator {
  rounds = 0;
  cost = 0;
  win = 0;
  baseWin = 0;
  fsWin = 0;
  hits = 0;
  fsTriggers = 0;
  fsSpins = 0;
  retriggers = 0;
  cascades = 0;
  spinsPlayed = 0;
  capHits = 0;
  maxWinX = 0;
  sumX = 0;
  sumX2 = 0;
  buckets = new Array<number>(BUCKETS.length).fill(0);
  bucketWin = new Array<number>(BUCKETS.length).fill(0);
  tiers = new Array<number>(WIN_TIERS.length).fill(0);
  /** key "symbol|count|mode" -> [hits, win] */
  symbolPays = new Map<string, [number, number]>();

  add(r: RoundResult): void {
    this.rounds++;
    this.cost += r.cost;
    this.win += r.totalWin;
    this.baseWin += r.baseWin;
    this.fsWin += r.freeSpinsWin;
    if (r.totalWin > 0) this.hits++;
    if (r.maxWinReached) this.capHits++;
    const x = r.totalWin / r.cost;
    this.sumX += x;
    this.sumX2 += x * x;
    const wx = r.winX;
    if (wx > this.maxWinX) this.maxWinX = wx;
    const b = BUCKETS.findIndex(k => (k.min === 0 && k.max === 0 ? wx === 0 : wx >= k.min && wx < k.max));
    this.buckets[b]++;
    this.bucketWin[b] += r.totalWin;
    WIN_TIERS.forEach((t, i) => { if (wx >= t.min) this.tiers[i]++; });
    if (r.base) this.addSpin(r.base, 'base');
    if (r.freeSpins) {
      if (!r.buyBonus) this.fsTriggers++;
      this.fsSpins += r.freeSpins.spins.length;
      this.retriggers += r.freeSpins.retriggers;
      for (const s of r.freeSpins.spins) this.addSpin(s, 'free');
    }
  }

  private addSpin(s: SpinOutcome, mode: 'base' | 'free'): void {
    this.spinsPlayed++;
    this.cascades += s.cascades;
    for (const step of s.steps) {
      for (const w of step.wins) {
        const key = `${w.symbol}|${w.count}|${mode}`;
        const e = this.symbolPays.get(key) ?? [0, 0];
        e[0]++;
        e[1] += w.baseWin * step.multiplier;
        this.symbolPays.set(key, e);
      }
    }
  }

  get rtp(): number { return this.cost ? this.win / this.cost : 0; }
  /** Standard deviation of win per unit cost: the volatility index. */
  get sd(): number {
    const n = this.rounds || 1;
    const mean = this.sumX / n;
    return Math.sqrt(Math.max(0, this.sumX2 / n - mean * mean));
  }
  /** 90% confidence half-width of the RTP estimate. */
  get ci90(): number { return 1.645 * this.sd / Math.sqrt(this.rounds || 1); }
}

export interface SessionStats {
  sessions: number;
  balance: number;
  bet: number;
  maxSpins: number;
  avgSpins: number;
  medianSpins: number;
  bustRate: number;
  profitRate: number;
  avgEndBalance: number;
  bestEndBalance: number;
}

export interface SimReport {
  game: { id: string; name: string; version: string };
  variant: string;
  seed: number;
  spins: number;
  durationMs: number;
  createdAt: string;
  config: GameConfig;
  main: Accumulator;
  buy: Accumulator | null;
  session: SessionStats | null;
}

/** Runs the whole simulation and returns the raw numbers. */
export function simulate(baseConfig: GameConfig, opts: SimOptions): SimReport {
  const config = opts.variant ? applyOverrides(baseConfig, { multiplier: { variant: opts.variant } }).config : baseConfig;
  const t0 = Date.now();
  const engine = new SlotEngine(config, new SeededRng(opts.seed));
  const bet = config.bet.levels[config.bet.defaultIndex];

  const main = new Accumulator();
  const step = Math.max(1, Math.floor(opts.spins / 20));
  for (let i = 0; i < opts.spins; i++) {
    main.add(engine.playRound({ bet, detail: 'summary' }));
    if (opts.onProgress && (i + 1) % step === 0) opts.onProgress(i + 1, opts.spins);
  }

  let buy: Accumulator | null = null;
  if (opts.buys > 0 && config.buyBonus.enabled) {
    buy = new Accumulator();
    const buyEngine = new SlotEngine(config, new SeededRng(opts.seed ^ 0x5bd1e995));
    for (let i = 0; i < opts.buys; i++) buy.add(buyEngine.playRound({ bet, buyBonus: true, detail: 'summary' }));
  }

  let session: SessionStats | null = null;
  if (opts.sessions > 0) session = simulateSessions(config, opts);

  return {
    game: { id: config.id, name: config.name, version: config.version },
    variant: config.multiplier.variant,
    seed: opts.seed,
    spins: opts.spins,
    durationMs: Date.now() - t0,
    createdAt: new Date().toISOString(),
    config,
    main,
    buy,
    session,
  };
}

/** Plays many short sessions to show how a player's balance behaves. */
function simulateSessions(config: GameConfig, opts: SimOptions): SessionStats {
  const engine = new SlotEngine(config, new SeededRng(opts.seed ^ 0x27d4eb2d));
  const lengths: number[] = [];
  let bust = 0;
  let profit = 0;
  let endSum = 0;
  let best = 0;
  for (let s = 0; s < opts.sessions; s++) {
    let balance = opts.sessionBalance;
    let n = 0;
    while (n < opts.sessionMaxSpins && balance >= opts.sessionBet) {
      const r = engine.playRound({ bet: opts.sessionBet, detail: 'summary' });
      balance += r.totalWin - r.cost;
      n++;
    }
    lengths.push(n);
    if (balance < opts.sessionBet) bust++;
    if (balance > opts.sessionBalance) profit++;
    endSum += balance;
    if (balance > best) best = balance;
  }
  lengths.sort((a, b) => a - b);
  return {
    sessions: opts.sessions,
    balance: opts.sessionBalance,
    bet: opts.sessionBet,
    maxSpins: opts.sessionMaxSpins,
    avgSpins: lengths.reduce((a, b) => a + b, 0) / lengths.length,
    medianSpins: lengths[Math.floor(lengths.length / 2)],
    bustRate: bust / opts.sessions,
    profitRate: profit / opts.sessions,
    avgEndBalance: endSum / opts.sessions,
    bestEndBalance: best,
  };
}
