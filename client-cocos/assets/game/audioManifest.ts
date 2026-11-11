import type { SfxSpec } from '../framework/audio/audioManager';

/** Fishball Fiesta sounds. Names match the prototype's `Sfx` list. Placeholder files are rendered by tools/exportSounds.ts. */
export const SFX: readonly SfxSpec[] = [
  { name: 'click' }, { name: 'spin' }, { name: 'reelStop' }, { name: 'pop' }, { name: 'toWild' }, { name: 'fly' }, { name: 'coin' },
  { name: 'fsIntro' }, { name: 'anticipation' }, { name: 'retrigger' },
  { name: 'scatter', maxLevel: 4 },
  { name: 'multUp', maxLevel: 6 },
  { name: 'win', maxLevel: 6 },
  { name: 'bigWin', maxLevel: 2 },
];
