import type { SimReport } from './simulate';
import { BUCKETS, WIN_TIERS } from './simulate';

/** Builds a PAR sheet as CSV (opens in Excel / Google Sheets). */
export function buildParSheet(r: SimReport): string {
  const c = r.config;
  const m = r.main;
  const rows: (string | number)[][] = [];
  const add = (...cells: (string | number)[]) => rows.push(cells);

  add('PAR SHEET', c.name, `version ${c.version}`);
  add('Generated', r.createdAt, 'Seed', r.seed, 'Rounds', r.spins, 'Variant', r.variant);
  add();
  add('SUMMARY');
  add('RTP total', m.rtp);
  add('RTP base game', m.baseWin / m.cost);
  add('RTP free spins', m.fsWin / m.cost);
  add('RTP 90% confidence +/-', m.ci90);
  add('Hit frequency', m.hits / m.rounds);
  add('Free spins 1 in', m.fsTriggers ? m.rounds / m.fsTriggers : 0);
  add('Average free spins win (x bet)', m.fsTriggers ? m.fsWin / m.fsTriggers / betOf(r) : 0);
  add('Average cascades per spin', m.cascades / m.spinsPlayed);
  add('Volatility index (std dev, x bet)', m.sd);
  add('Max win seen (x bet)', m.maxWinX);
  add('Max win cap (x bet)', c.maxWinX, 'Cap hits', m.capHits);
  if (r.buy) {
    add('Buy bonus price (x bet)', c.buyBonus.priceX);
    add('Buy bonus RTP', r.buy.rtp);
    add('Buy bonus average win (x bet)', r.buy.win / r.buy.rounds / betOf(r));
  }
  add();
  add('WIN DISTRIBUTION', 'Rounds', 'Probability', 'RTP contribution');
  BUCKETS.forEach((b, i) => add(b.label, m.buckets[i], m.buckets[i] / m.rounds, m.bucketWin[i] / m.cost));
  add();
  add('WIN TIERS', 'Rounds', '1 in');
  WIN_TIERS.forEach((t, i) => add(t.label, m.tiers[i], m.tiers[i] ? m.rounds / m.tiers[i] : 0));
  add();
  add('PAYTABLE (x bet per way)', '3', '4', '5');
  for (const s of c.symbols) if (s.pays) add(`${s.id} ${s.name}`, s.pays['3'] ?? 0, s.pays['4'] ?? 0, s.pays['5'] ?? 0);
  add();
  add('SYMBOL RTP CONTRIBUTION', 'Count', 'Mode', 'Hits', 'Hit rate per round', 'RTP contribution');
  const keys = [...m.symbolPays.keys()].sort();
  for (const k of keys) {
    const [sym, count, mode] = k.split('|');
    const [hits, win] = m.symbolPays.get(k)!;
    add(sym, count, mode, hits, hits / m.rounds, win / m.cost);
  }
  add();
  add('MULTIPLIER', 'Variant', c.multiplier.variant);
  add('Ladder A base', c.multiplier.A.base.join(' / '));
  add('Ladder A free', c.multiplier.A.free.join(' / '));
  add('Golden reels', c.golden.reels.map(r => r + 1).join(' '), 'Chance base', c.golden.chanceBase, 'Chance free', c.golden.chanceFree);
  add();
  add('REEL STRIPS', 'Set', 'Reel', 'Length', ...c.symbols.map(s => s.id));
  for (const set of ['base', 'free'] as const) {
    c.reelSets[set].forEach((strip, i) => add('', set, i + 1, strip.length, ...c.symbols.map(s => strip.filter(x => x === s.id).length)));
  }
  add();
  add('REEL STRIP ORDER');
  for (const set of ['base', 'free'] as const) c.reelSets[set].forEach((strip, i) => add(`${set} reel ${i + 1}`, ...strip));
  if (r.session) {
    const s = r.session;
    add();
    add('SESSION SIMULATION', `${s.sessions} sessions, balance ${s.balance}, bet ${s.bet}, up to ${s.maxSpins} spins`);
    add('Average spins played', s.avgSpins);
    add('Median spins played', s.medianSpins);
    add('Went broke', s.bustRate);
    add('Ended in profit', s.profitRate);
    add('Average end balance', s.avgEndBalance);
    add('Best end balance', s.bestEndBalance);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}

function betOf(r: SimReport): number {
  return r.config.bet.levels[r.config.bet.defaultIndex];
}

function csvCell(v: string | number): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
