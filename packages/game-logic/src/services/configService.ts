import { applyOverrides } from '@slots/math-core';
import type { ConfigOverrides, GameConfig } from '@slots/math-core';
import { Observable } from '../core/observable';
import type { ReadOnlyObservable } from '../core/observable';

/** Game config plus session-only debug overrides. */
export interface IConfigService {
  /** The config in use right now (base + overrides). */
  readonly config: ReadOnlyObservable<GameConfig>;
  /** The untouched config from game.json. */
  readonly base: GameConfig;
  readonly overrides: ConfigOverrides;
  /** Paths changed by overrides; empty when none are active. */
  readonly changed: string[];
  setOverrides(overrides: ConfigOverrides): void;
  clearOverrides(): void;
  /** JSON of the active overrides, for the debug panel's Export button. */
  exportOverrides(): string;
}

/**
 * Holds overrides in memory only. Nothing is ever written back to game.json;
 * reloading the page returns to the real values.
 */
export class LocalConfigService implements IConfigService {
  readonly config: Observable<GameConfig>;
  private current: ConfigOverrides = {};
  private changedPaths: string[] = [];

  constructor(readonly base: GameConfig) {
    this.config = new Observable(structuredClone(base));
  }

  get overrides(): ConfigOverrides { return this.current; }
  get changed(): string[] { return this.changedPaths; }

  setOverrides(overrides: ConfigOverrides): void {
    const { config, changed } = applyOverrides(this.base, overrides); // throws if invalid
    this.current = structuredClone(overrides);
    this.changedPaths = changed;
    this.config.set(config);
  }

  clearOverrides(): void {
    this.current = {};
    this.changedPaths = [];
    this.config.set(structuredClone(this.base));
  }

  exportOverrides(): string {
    return JSON.stringify(this.current, null, 2);
  }
}
