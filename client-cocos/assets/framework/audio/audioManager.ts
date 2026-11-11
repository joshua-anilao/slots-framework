import { Observable } from '../../shared/game-logic/index';
import type { ReadOnlyObservable } from '../../shared/game-logic/index';

/** One sound name. Some sounds change with a level (scatter number, multiplier step, win size): maxLevel is the top level. */
export interface SfxSpec { name: string; maxLevel?: number }

/** The engine side. The Cocos backend plays AudioClips; tests use a fake. */
export interface IAudioBackend {
  /** Called once on the first tap, because browsers refuse sound before that. */
  unlock(): void;
  play(clipKey: string): void;
}

/** Small key-value store for the mute setting (localStorage in the browser). */
export interface IKeyValueStore { get(key: string): string | null; set(key: string, value: string): void }

/** Same key as the browser prototype, so the setting follows the player between the two. */
export const MUTE_KEY = 'sfxMuted';

/** The file a sound plays: "win" with levels becomes "win_2". Levels outside the range are clamped. */
export function clipKey(spec: SfxSpec, level = 0): string {
  if (spec.maxLevel === undefined) return spec.name;
  const l = Math.max(0, Math.min(spec.maxLevel, Math.round(level)));
  return `${spec.name}_${l}`;
}

/**
 * Plays sounds by name. Silent until the first tap (unlock) and while muted; the mute choice is saved.
 * Views and presenters call play(); they never touch the engine's audio directly.
 */
export class AudioManager {
  private readonly specs: Map<string, SfxSpec>;
  private readonly mutedState: Observable<boolean>;
  private unlocked = false;

  constructor(private readonly backend: IAudioBackend, private readonly store: IKeyValueStore, specs: readonly SfxSpec[]) {
    this.specs = new Map(specs.map(s => [s.name, s]));
    this.mutedState = new Observable(store.get(MUTE_KEY) === '1');
  }

  get muted(): ReadOnlyObservable<boolean> { return this.mutedState; }

  setMuted(muted: boolean): void {
    this.mutedState.set(muted);
    this.store.set(MUTE_KEY, muted ? '1' : '0');
  }

  /** Call on the first pointer down. Safe to call again. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.backend.unlock();
  }

  /** Returns true if a sound was started. Throws for a name that is not in the sound list (a typo). */
  play(name: string, level = 0): boolean {
    const spec = this.specs.get(name);
    if (!spec) throw new Error(`Unknown sound "${name}"`);
    if (!this.unlocked || this.mutedState.value) return false;
    this.backend.play(clipKey(spec, level));
    return true;
  }
}
