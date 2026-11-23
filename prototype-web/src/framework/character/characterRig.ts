import { createPuppetRig, createEmptyRig } from './puppetRig';
import type { PuppetParts } from './puppetRig';

/** The six things the character can be doing. A game's art only has to supply these. */
export type CharacterState = 'idle' | 'smallWin' | 'bigWin' | 'lose' | 'nearMiss' | 'bonus';

export const CHARACTER_STATES: readonly CharacterState[] = ['idle', 'smallWin', 'bigWin', 'lose', 'nearMiss', 'bonus'];

/**
 * Anything that can show the character: today the cut-out puppet, later a Spine rig.
 * The reaction controller only talks to this interface.
 */
export interface CharacterRig {
  readonly root: HTMLElement;
  /** Loops until the next play(); a one-shot resolves when it ends. Starts from the bones' current pose (no snap). */
  play(state: CharacterState, loop: boolean, ms: number): Promise<void>;
  /** The character rises into the scene (intro). */
  enter(ms: number): Promise<void>;
}

export type CharacterSpec =
  | { kind: 'puppet'; parts: PuppetParts; sceneBg?: string }
  | {
    /** Seam for a Spine export (spine-player). Not wired yet: falls back to `fallback`, or an empty stage. */
    kind: 'spine'; skeletonUrl: string; atlasUrl: string;
    animations: Record<CharacterState, string>; sceneBg?: string; fallback?: PuppetParts;
  };

/** Builds the rig for a game's character spec. */
export function createCharacterRig(spec: CharacterSpec): CharacterRig {
  if (spec.kind === 'puppet') return createPuppetRig(spec.parts);
  console.warn('[character] Spine rig is not available yet; using the fallback puppet.');
  return spec.fallback ? createPuppetRig(spec.fallback) : createEmptyRig();
}
