/** One row in Bet History. */
export interface HistoryEntry {
  roundId: string;
  timestamp: number;
  bet: number;
  cost: number;
  win: number;
  /** win - cost */
  net: number;
  buyBonus: boolean;
  freeSpins: number;
  balanceAfter: number;
}

export interface HistoryQuery {
  /** Only rounds in the last N ms (e.g. 15 min = 900000). */
  withinMs?: number;
  /** Only rounds on this calendar day (local time), "YYYY-MM-DD". */
  date?: string;
  /** Round id contains this text. */
  roundId?: string;
  limit?: number;
}

/** Bet / transaction history. Session memory now, server API later. */
export interface IHistoryService {
  record(entry: HistoryEntry): void;
  query(q?: HistoryQuery): Promise<HistoryEntry[]>;
  /** Full stored result for round replay, when available. */
  detail(roundId: string): Promise<unknown | null>;
}

/** Keeps the last N rounds in memory (newest first). */
export class LocalHistoryService implements IHistoryService {
  private entries: HistoryEntry[] = [];
  private details = new Map<string, unknown>();
  constructor(private readonly maxEntries = 500, private readonly now: () => number = Date.now) {}

  record(entry: HistoryEntry, detail?: unknown): void {
    this.entries.unshift(entry);
    if (detail !== undefined) this.details.set(entry.roundId, detail);
    while (this.entries.length > this.maxEntries) {
      const old = this.entries.pop()!;
      this.details.delete(old.roundId);
    }
  }

  async query(q: HistoryQuery = {}): Promise<HistoryEntry[]> {
    const now = this.now();
    let list = this.entries;
    if (q.withinMs !== undefined) list = list.filter(e => now - e.timestamp <= q.withinMs!);
    if (q.date) list = list.filter(e => localDate(e.timestamp) === q.date);
    if (q.roundId) list = list.filter(e => e.roundId.includes(q.roundId!));
    return list.slice(0, q.limit ?? list.length);
  }

  async detail(roundId: string): Promise<unknown | null> {
    return this.details.get(roundId) ?? null;
  }
}

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
