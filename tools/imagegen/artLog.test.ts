import { describe, expect, it } from 'vitest';
import { formatEntry, stamp } from './artLog';

describe('art log entry', () => {
  const when = new Date(2026, 10, 15, 17, 5);
  it('formats the date, decision, prompt and image galleries', () => {
    const md = formatEntry({
      when, asset: 'sym_L1', decision: 'Picked candidate 2', why: 'One stick only', cost: '$0.17', by: 'Josh',
      runs: [{ model: 'nano-banana-2', seed: 5, prompt: 'PURPOSE: x', file: 'theme/generated/sym_L1/a.json' }],
      picked: ['images/a-pick1.png'], rejected: ['images/a-reject1.png'],
    });
    expect(stamp(when)).toBe('2026-11-15 17:05');
    expect(md).toContain('## 2026-11-15 17:05 · sym_L1');
    expect(md).toContain('**Decision (Josh):** Picked candidate 2');
    expect(md).toContain('**Why:** One stick only');
    expect(md).toContain('**Model:** nano-banana-2 · **Seed:** 5');
    expect(md).toContain('```text\nPURPOSE: x\n```');
    expect(md).toContain('**Picked:**\n\n![a-pick1.png](images/a-pick1.png)');
    expect(md).toContain('**Rejected:**');
  });

  it('works with only a decision', () => {
    const md = formatEntry({ when, asset: 'style', decision: 'New look', runs: [], picked: [], rejected: [] });
    expect(md).not.toContain('Picked');
    expect(md).toContain('New look');
  });
});
