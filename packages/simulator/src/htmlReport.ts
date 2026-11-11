import { buyPriceX, payScale } from '@slots/math-core';
import type { SimReport } from './simulate';
import { BUCKETS, WIN_TIERS } from './simulate';
import { checkTargets, pct } from './checks';

/** Builds a self-contained HTML report a PM can open in any browser. */
export function buildHtmlReport(r: SimReport): string {
  const c = r.config;
  const m = r.main;
  const bet = c.bet.levels[c.bet.defaultIndex];
  const checks = checkTargets(r);
  const allPass = checks.every(x => x.pass);
  const fsOneIn = m.fsTriggers ? Math.round(m.rounds / m.fsTriggers) : 0;
  const n = (v: number, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const tiles = [
    ['RTP', pct(m.rtp), `± ${pct(m.ci90)} (90% confidence)`],
    ['Hit frequency', pct(m.hits / m.rounds), 'rounds that win anything'],
    ['Free spins', fsOneIn ? `1 in ${n(fsOneIn)}` : 'none', `avg win ${n(m.fsTriggers ? m.fsWin / m.fsTriggers / bet : 0, 1)}x bet`],
    ['Volatility index', n(m.sd, 2), volLabel(m.sd)],
    ['Max win seen', `${n(m.maxWinX)}x`, `cap ${n(c.maxWinX)}x · hit ${m.capHits} times`],
  ];

  const maxProb = Math.max(...m.buckets.map(b => b / m.rounds));
  const dist = BUCKETS.map((b, i) => {
    const p = m.buckets[i] / m.rounds;
    const w = maxProb ? Math.max(0.5, (p / maxProb) * 100) : 0;
    return `<tr><td>${b.label}</td><td class="num">${pct(p)}</td><td class="bar"><span style="width:${w.toFixed(1)}%"></span></td><td class="num">${pct(m.bucketWin[i] / m.cost)}</td></tr>`;
  }).join('');

  const tiers = WIN_TIERS.map((t, i) => `<tr><td>${t.label}</td><td class="num">${m.tiers[i] ? '1 in ' + n(m.rounds / m.tiers[i]) : 'never'}</td></tr>`).join('');
  const checkRows = checks.map(x => `<tr><td>${x.name}</td><td class="num">${x.value}</td><td class="num">${x.target}</td><td><span class="chip ${x.pass ? 'ok' : 'bad'}">${x.pass ? 'Pass' : 'Off target'}</span></td></tr>`).join('');

  const pays = c.symbols.filter(s => s.pays).map(s => `<tr><td>${s.id}</td><td>${esc(s.name)}</td>${['3', '4', '5'].map(k => `<td class="num">${((s.pays![k] ?? 0) * payScale(c)).toFixed(3)}</td>`).join('')}</tr>`).join('');

  const contrib = new Map<string, { base: number; free: number }>();
  for (const [k, [, win]] of m.symbolPays) {
    const [sym, , mode] = k.split('|');
    const e = contrib.get(sym) ?? { base: 0, free: 0 };
    e[mode as 'base' | 'free'] += win / m.cost;
    contrib.set(sym, e);
  }
  const contribRows = [...contrib.entries()].sort((a, b) => (b[1].base + b[1].free) - (a[1].base + a[1].free))
    .map(([s, e]) => `<tr><td>${s}</td><td class="num">${pct(e.base)}</td><td class="num">${pct(e.free)}</td><td class="num">${pct(e.base + e.free)}</td></tr>`).join('');

  const buy = r.buy ? `<section><h2>Buy bonus</h2><table><tbody>
    <tr><td>Price</td><td class="num">${n(buyPriceX(c))}x bet</td></tr>
    <tr><td>RTP</td><td class="num">${pct(r.buy.rtp)} ± ${pct(r.buy.ci90)}</td></tr>
    <tr><td>Average win</td><td class="num">${n(r.buy.win / r.buy.rounds / bet, 1)}x bet</td></tr>
    <tr><td>Best win</td><td class="num">${n(r.buy.maxWinX)}x bet</td></tr>
    <tr><td>Rounds simulated</td><td class="num">${n(r.buy.rounds)}</td></tr></tbody></table></section>` : '';

  const s = r.session;
  const session = s ? `<section><h2>Player sessions</h2><p class="note">${n(s.sessions)} players each start with ₱${n(s.balance)} and bet ₱${n(s.bet)} until broke or ${n(s.maxSpins)} spins.</p><table><tbody>
    <tr><td>Average spins played</td><td class="num">${n(s.avgSpins)}</td></tr>
    <tr><td>Median spins played</td><td class="num">${n(s.medianSpins)}</td></tr>
    <tr><td>Went broke</td><td class="num">${pct(s.bustRate)}</td></tr>
    <tr><td>Ended in profit</td><td class="num">${pct(s.profitRate)}</td></tr>
    <tr><td>Average end balance</td><td class="num">₱${n(s.avgEndBalance, 2)}</td></tr>
    <tr><td>Best end balance</td><td class="num">₱${n(s.bestEndBalance, 2)}</td></tr></tbody></table></section>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.name)} sim report (${r.variant})</title>
<style>
:root{--bg:#f5f3ef;--surface:#fff;--fg:#1e1b17;--muted:#6b645b;--line:#e3ddd3;--accent:#a8740a;--ok:#1f8a4c;--ok-soft:#e1f3e8;--bad:#b42318;--bad-soft:#fde7e4;--bar:#c9973a}
@media (prefers-color-scheme:dark){:root{--bg:#141210;--surface:#1d1a16;--fg:#ece6dc;--muted:#a1988b;--line:#322c24;--accent:#e0b44a;--ok:#4cc27f;--ok-soft:#173225;--bad:#f2867b;--bad-soft:#3a1814;--bar:#c9973a;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:28px 16px 48px;display:grid;gap:20px}
h1{margin:0;font-size:24px}h2{margin:0 0 10px;font-size:16px}
.meta,.note{color:var(--muted);font-size:13px}
.verdict{font-weight:600}.verdict.ok{color:var(--ok)}.verdict.bad{color:var(--bad)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:2px}
.tile small{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}.tile b{font-size:22px;font-variant-numeric:tabular-nums}.tile span{color:var(--muted);font-size:12px}
section{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}th{font-size:12px;color:var(--muted);font-weight:500}
.num{text-align:right}.bar{width:40%}.bar span{display:block;height:10px;background:var(--bar);border-radius:4px}
.chip{font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px}.chip.ok{background:var(--ok-soft);color:var(--ok)}.chip.bad{background:var(--bad-soft);color:var(--bad)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
</style></head><body><div class="wrap">
<header><div class="meta">Simulation report · variant ${r.variant} · ${n(r.spins)} rounds · seed ${r.seed} · ${new Date(r.createdAt).toLocaleString('en-PH')} · ${(r.durationMs / 1000).toFixed(1)} s</div>
<h1>${esc(c.name)} <span class="meta">v${esc(c.version)}</span></h1>
<p class="verdict ${allPass ? 'ok' : 'bad'}">${allPass ? 'All targets met.' : 'Some targets are off. See Target check.'}</p></header>
<div class="tiles">${tiles.map(([a, b, d]) => `<div class="tile"><small>${a}</small><b>${b}</b><span>${d}</span></div>`).join('')}</div>
<section><h2>Target check</h2><table><thead><tr><th>Measure</th><th class="num">Simulated</th><th class="num">Target</th><th></th></tr></thead><tbody>${checkRows}</tbody></table>
<p class="note">RTP tolerance is the larger of the game's tolerance and the simulation's own 90% confidence range. Narrowing it needs more rounds.</p></section>
<div class="grid2">
<section><h2>Where the RTP comes from</h2><table><tbody>
<tr><td>Base game</td><td class="num">${pct(m.baseWin / m.cost)}</td></tr>
<tr><td>Free spins</td><td class="num">${pct(m.fsWin / m.cost)}</td></tr>
<tr><td><b>Total</b></td><td class="num"><b>${pct(m.rtp)}</b></td></tr>
<tr><td>Average cascades per spin</td><td class="num">${n(m.cascades / m.spinsPlayed, 2)}</td></tr>
<tr><td>Free spins retriggers</td><td class="num">${n(m.retriggers)}</td></tr></tbody></table></section>
<section><h2>Win celebrations</h2><table><tbody>${tiers}</tbody></table></section>
</div>
<section><h2>Win distribution</h2><table><thead><tr><th>Round win</th><th class="num">Chance</th><th></th><th class="num">RTP share</th></tr></thead><tbody>${dist}</tbody></table></section>
<div class="grid2">${buy}${session}</div>
<div class="grid2">
<section><h2>Paytable (x bet per way)</h2><table><thead><tr><th>Id</th><th>Name</th><th class="num">3</th><th class="num">4</th><th class="num">5</th></tr></thead><tbody>${pays}</tbody></table></section>
<section><h2>RTP by symbol</h2><table><thead><tr><th>Symbol</th><th class="num">Base</th><th class="num">Free</th><th class="num">Total</th></tr></thead><tbody>${contribRows}</tbody></table></section>
</div>
<section><h2>Settings used</h2><table><tbody>
<tr><td>Grid</td><td>${c.grid.reels} x ${c.grid.rows}, ways (min ${c.minWaysCount})</td></tr>
<tr><td>Multiplier</td><td>Variant ${c.multiplier.variant}${c.multiplier.variant === 'A' || c.multiplier.variant === 'C' ? `: base ${c.multiplier[c.multiplier.variant].base.join(' / ')}, free ${c.multiplier[c.multiplier.variant].free.join(' / ')}` : ''}</td></tr>
<tr><td>Golden symbols</td><td>reels ${c.golden.reels.map(x => x + 1).join(', ')} · base ${pct(c.golden.chanceBase)} · free ${pct(c.golden.chanceFree)}</td></tr>
<tr><td>Free spins</td><td>${c.freeSpins.minScatters}+ scatters = ${c.freeSpins.spins} spins, +${c.freeSpins.extraPerScatter} per extra · retrigger ${c.freeSpins.retrigger ? 'on' : 'off'}</td></tr>
<tr><td>Bet used</td><td>₱${n(bet)}</td></tr></tbody></table>
<p class="note">Full numbers, reel strips and symbol hit rates are in par-sheet.csv next to this file.</p></section>
</div></body></html>`;
}

function volLabel(sd: number): string {
  if (sd < 3) return 'low';
  if (sd < 6) return 'medium';
  if (sd < 12) return 'medium-high';
  if (sd < 25) return 'high';
  return 'very high';
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
}
