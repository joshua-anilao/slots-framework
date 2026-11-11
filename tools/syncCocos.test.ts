import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkSync, writeSync } from './syncCocos';
import type { SyncTarget } from './syncCocos';

const targets: SyncTarget[] = [
  { name: '@slots/core', from: 'packages/core/src', to: 'client/assets/shared/core' },
  { name: '@slots/logic', from: 'packages/logic/src', to: 'client/assets/shared/logic' },
];
let root = '';
const put = (rel: string, text: string) => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), text); };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sync-'));
  put('packages/core/src/index.ts', "export const a = 1;\n");
  put('packages/logic/src/index.ts', "export * from './sub/b';\n");
  put('packages/logic/src/sub/b.ts', "import { a } from '@slots/core';\nimport type { T } from '@slots/core';\nexport const b = a + 1;\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('sync:cocos', () => {
  it('is missing at first, then up to date after a sync', () => {
    expect(checkSync(root, targets).some(p => p.startsWith('missing:'))).toBe(true);
    writeSync(root, targets);
    expect(checkSync(root, targets)).toEqual([]);
  });

  it('turns workspace imports into relative paths and adds a header', () => {
    writeSync(root, targets);
    const text = readFileSync(join(root, 'client/assets/shared/logic/sub/b.ts'), 'utf8');
    expect(text).toContain("from '../../core/index'");
    expect(text).not.toContain('@slots/');
    expect(text.startsWith('// GENERATED')).toBe(true);
  });

  it('notices a stale copy, a hand edit and a stray file', () => {
    writeSync(root, targets);
    put('packages/core/src/index.ts', 'export const a = 2;\n');
    expect(checkSync(root, targets)).toContain('stale: client/assets/shared/core/index.ts');
    writeSync(root, targets);
    put('client/assets/shared/core/hand.ts', 'export const x = 1;\n');
    expect(checkSync(root, targets)).toContain('stray: client/assets/shared/core/hand.ts');
    writeSync(root, targets);
    expect(checkSync(root, targets)).toEqual([]);
  });

  it('ignores .meta files that Cocos Creator adds', () => {
    writeSync(root, targets);
    put('client/assets/shared/core/index.ts.meta', '{}');
    expect(checkSync(root, targets)).toEqual([]);
  });

  it('refuses an import of a package that is not synced', () => {
    put('packages/logic/src/bad.ts', "import { z } from '@slots/other';\n");
    expect(() => writeSync(root, targets)).toThrow(/not a synced package/);
  });
});
