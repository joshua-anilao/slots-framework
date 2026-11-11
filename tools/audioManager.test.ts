import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AudioManager, MUTE_KEY, clipKey } from '../client-cocos/assets/framework/audio/audioManager';
import type { IAudioBackend, IKeyValueStore, SfxSpec } from '../client-cocos/assets/framework/audio/audioManager';
import { SFX } from '../client-cocos/assets/game/audioManifest';

let played: string[] = [];
let unlocks = 0;
const backend: IAudioBackend = { unlock: () => { unlocks++; }, play: k => played.push(k) };
const memoryStore = (init: Record<string, string> = {}): IKeyValueStore & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, get: k => data[k] ?? null, set: (k, v) => { data[k] = v; } };
};
const specs: SfxSpec[] = [{ name: 'click' }, { name: 'win', maxLevel: 6 }];

beforeEach(() => { played = []; unlocks = 0; });

describe('AudioManager', () => {
  it('is silent until the first tap, then plays', () => {
    const a = new AudioManager(backend, memoryStore(), specs);
    expect(a.play('click')).toBe(false);
    a.unlock();
    a.unlock();
    expect(unlocks).toBe(1);
    expect(a.play('click')).toBe(true);
    expect(played).toEqual(['click']);
  });

  it('picks the clip for the level and clamps it', () => {
    const a = new AudioManager(backend, memoryStore(), specs);
    a.unlock();
    a.play('win', 2);
    a.play('win', 99);
    a.play('win', -3);
    expect(played).toEqual(['win_2', 'win_6', 'win_0']);
  });

  it('stays silent while muted, and the choice is saved and restored', () => {
    const store = memoryStore();
    const a = new AudioManager(backend, store, specs);
    a.unlock();
    a.setMuted(true);
    expect(a.play('click')).toBe(false);
    expect(store.data[MUTE_KEY]).toBe('1');
    expect(new AudioManager(backend, store, specs).muted.value).toBe(true);
    a.setMuted(false);
    expect(a.play('click')).toBe(true);
    expect(new AudioManager(backend, store, specs).muted.value).toBe(false);
  });

  it('throws for a sound name that does not exist', () => {
    const a = new AudioManager(backend, memoryStore(), specs);
    a.unlock();
    expect(() => a.play('clik')).toThrow('Unknown sound "clik"');
  });
});

describe('Fishball Fiesta sounds', () => {
  const protoNames = /export type Sfx = ([^;]+);/.exec(readFileSync('prototype-web/src/framework/core/audio.ts', 'utf8'))![1]!
    .split('|').map(s => s.trim().replace(/'/g, ''));

  it('has every sound name the prototype has, and no others', () => {
    expect(SFX.map(s => s.name).sort()).toEqual([...protoNames].sort());
  });

  it('plays every sound at every level without a missing file', () => {
    const a = new AudioManager(backend, memoryStore(), SFX);
    a.unlock();
    for (const s of SFX) for (let l = 0; l <= (s.maxLevel ?? 0); l++) {
      expect(a.play(s.name, l)).toBe(true);
      expect(existsSync(`client-cocos/assets/resources/audio/${clipKey(s, l)}.wav`), clipKey(s, l)).toBe(true);
    }
    expect(played.length).toBeGreaterThanOrEqual(protoNames.length);
  });
});
