import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../client-cocos/assets/framework/assets/assetLoader';
import type { AssetGroups, IAssetBackend, IAtlas } from '../client-cocos/assets/framework/assets/assetLoader';
import { ASSET_GROUPS, SYMBOL_FRAMES } from '../client-cocos/assets/game/assetManifest';

const atlasOf = (frames: string[]): IAtlas<string> => ({ frame: n => (frames.includes(n) ? `frame:${n}` : undefined) });
const backend = (atlases: Record<string, string[]>, calls: string[] = []): IAssetBackend<string> => ({
  loadAtlas: async path => {
    calls.push(path);
    if (!atlases[path]) throw new Error('not found');
    return atlasOf(atlases[path]!);
  },
});
const groups: AssetGroups = {
  boot: [{ path: 'a', frames: ['x', 'y'], files: [] }],
  lazy: [{ path: 'b', frames: ['z'], files: [] }],
};

describe('AssetLoader', () => {
  it('loads a group and returns frames by name', async () => {
    const l = new AssetLoader(backend({ a: ['x', 'y'], b: ['z'] }), groups);
    const seen: Array<[number, number]> = [];
    await l.loadGroup('boot', (d, t) => seen.push([d, t]));
    expect(l.frame('x')).toBe('frame:x');
    expect(seen).toEqual([[1, 1]]);
    expect(l.isLoaded('boot')).toBe(true);
    expect(l.isLoaded('lazy')).toBe(false);
  });

  it('does not load a lazy group until asked, and loads each group once', async () => {
    const calls: string[] = [];
    const l = new AssetLoader(backend({ a: ['x', 'y'], b: ['z'] }, calls), groups);
    await Promise.all([l.loadGroup('boot'), l.loadGroup('boot')]);
    expect(calls).toEqual(['a']);
    await l.loadGroup('lazy');
    expect(calls).toEqual(['a', 'b']);
  });

  it('reports a missing frame by name, also before its group is loaded', async () => {
    const l = new AssetLoader(backend({ a: ['x', 'y'], b: ['z'] }), groups);
    expect(() => l.frame('z')).toThrow(/Missing frame "z".*Is its group loaded/);
    await l.loadGroup('boot');
    expect(() => l.frame('nope')).toThrow(/Missing frame "nope".*loaded atlases: a/);
  });

  it('fails with the frame names an atlas is missing', async () => {
    const l = new AssetLoader(backend({ a: ['x'] }), groups);
    await expect(l.loadGroup('boot')).rejects.toThrow('Atlas "a" is missing frame(s): y');
  });

  it('names the path when an atlas cannot be loaded, and allows a retry', async () => {
    const atlases: Record<string, string[]> = {};
    const l = new AssetLoader(backend(atlases), groups);
    await expect(l.loadGroup('boot')).rejects.toThrow('Could not load atlas "a": not found');
    atlases.a = ['x', 'y'];
    await l.loadGroup('boot');
    expect(l.isLoaded('boot')).toBe(true);
  });

  it('rejects an unknown group', async () => {
    await expect(new AssetLoader(backend({}), groups).loadGroup('nope')).rejects.toThrow('Unknown asset group "nope"');
  });
});

describe('Fishball Fiesta asset manifest', () => {
  it('every declared file exists and the atlas plist has every symbol frame', () => {
    const dir = 'client-cocos/assets/resources/';
    for (const spec of Object.values(ASSET_GROUPS).flat()) for (const f of spec.files) expect(() => readFileSync(dir + f)).not.toThrow();
    const plist = readFileSync(dir + 'atlas/fishball.plist', 'utf8');
    for (const name of SYMBOL_FRAMES) expect(plist).toContain(`<key>${name}</key>`);
  });
});
