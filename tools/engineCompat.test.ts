import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cocos transpiles our code in "loose" mode: `[...aSet]` and `for (x of aMap.values())` silently do the wrong thing
 * (they treat the Set or iterator as one element or as an empty array). Shared and Cocos code must use Array.from(...).
 */
const DIRS = ['packages/math-core/src', 'packages/game-logic/src', 'client-cocos/assets/framework', 'client-cocos/assets/game'];
const walk = (d: string): string[] => readdirSync(d).flatMap(n => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith('.ts') ? [join(d, n)] : []));
const BAD: Array<[RegExp, string]> = [
  [/\[\s*\.\.\.[^\]]*\.(keys|values|entries)\(\)/, 'spread of .keys()/.values()/.entries()'],
  [/\bof\s+[\w.]+\.(keys|values|entries)\(\)/, 'for-of over .keys()/.values()/.entries()'],
  [/\[\s*\.\.\.(this\.)?(listeners|handlers|pending|set|map)\b/, 'spread of a Set or Map'],
];

describe('Cocos loose-mode compatibility', () => {
  it('has no spread or for-of over a Set, Map or iterator', () => {
    const found: string[] = [];
    for (const f of DIRS.flatMap(walk)) {
      if (f.includes('/shared/')) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const [re, what] of BAD) if (re.test(line)) found.push(`${f}:${i + 1} ${what}: ${line.trim()}`);
      });
    }
    expect(found).toEqual([]);
  });
});
