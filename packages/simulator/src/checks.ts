import type { SimReport } from './simulate';

export interface TargetCheck {
  name: string;
  value: string;
  target: string;
  pass: boolean;
}

/** Compares simulated numbers with the game's targets. */
export function checkTargets(r: SimReport): TargetCheck[] {
  const t = r.config.targets;
  const m = r.main;
  const out: TargetCheck[] = [];
  const tol = Math.max(t.rtpTolerance, m.ci90);
  out.push({
    name: 'RTP',
    value: pct(m.rtp),
    target: `${pct(t.rtp)} ± ${pct(tol)}`,
    pass: Math.abs(m.rtp - t.rtp) <= tol,
  });
  if (t.hitFrequency) {
    const hit = m.hits / m.rounds;
    out.push({ name: 'Hit frequency', value: pct(hit), target: `${pct(t.hitFrequency[0])} - ${pct(t.hitFrequency[1])}`, pass: hit >= t.hitFrequency[0] && hit <= t.hitFrequency[1] });
  }
  if (t.freeSpinsOneIn && m.fsTriggers > 0) {
    const oneIn = m.rounds / m.fsTriggers;
    out.push({ name: 'Free spins frequency', value: `1 in ${Math.round(oneIn)}`, target: `1 in ${t.freeSpinsOneIn[0]} - ${t.freeSpinsOneIn[1]}`, pass: oneIn >= t.freeSpinsOneIn[0] && oneIn <= t.freeSpinsOneIn[1] });
  }
  if (r.buy) {
    out.push({ name: 'Buy bonus RTP', value: pct(r.buy.rtp), target: `${pct(t.rtp)} ± 2.00%`, pass: Math.abs(r.buy.rtp - t.rtp) <= 0.02 + r.buy.ci90 });
  }
  return out;
}

export function pct(v: number): string {
  return (v * 100).toFixed(2) + '%';
}
