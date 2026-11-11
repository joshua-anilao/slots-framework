/** One atlas the game needs: where it is, which frames it must contain, and which files make it up on disk. */
export interface AtlasSpec {
  /** Path the backend loads, relative to the resources folder, no extension (for example "atlas/fishball"). */
  path: string;
  /** Frames that must exist in the atlas. A missing one is reported by name when the atlas loads. */
  frames: readonly string[];
  /** Files under client-cocos/assets/resources, used by the size report. */
  files: readonly string[];
}

/** Named groups: "boot" loads before the first screen, the rest load when first needed. */
export type AssetGroups = Record<string, readonly AtlasSpec[]>;

/** A loaded atlas. F is the engine's frame type (a SpriteFrame in Cocos). */
export interface IAtlas<F> { frame(name: string): F | undefined }

/** The engine side. The Cocos backend wraps resources.load; tests use a fake. */
export interface IAssetBackend<F> { loadAtlas(path: string): Promise<IAtlas<F>> }

export class AssetError extends Error {
  constructor(message: string) { super(message); this.name = 'AssetError'; }
}

/**
 * Loads atlases by group and hands out frames by name. Every failure names what is missing, so a wrong
 * path or a frame that was renamed in the art shows up as one clear line instead of a blank card.
 */
export class AssetLoader<F> {
  private readonly atlases = new Map<string, IAtlas<F>>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor(private readonly backend: IAssetBackend<F>, private readonly groups: AssetGroups) {}

  isLoaded(group: string): boolean {
    return (this.groups[group] ?? []).every(a => this.atlases.has(a.path));
  }

  /** Loads every atlas of a group. Calling it again returns the same load; a failed load can be retried. */
  loadGroup(group: string, onProgress?: (done: number, total: number) => void): Promise<void> {
    const specs = this.groups[group];
    if (!specs) return Promise.reject(new AssetError(`Unknown asset group "${group}"`));
    const existing = this.pending.get(group);
    if (existing) return existing;
    let done = 0;
    const run = Promise.all(specs.map(async spec => {
      await this.loadAtlas(spec);
      onProgress?.(++done, specs.length);
    })).then(() => undefined);
    this.pending.set(group, run);
    run.catch(() => this.pending.delete(group));
    return run;
  }

  /** The frame by name, from any loaded atlas. Throws with the frame name if it is not there. */
  frame(name: string): F {
    for (const atlas of Array.from(this.atlases.values())) {
      const f = atlas.frame(name);
      if (f !== undefined) return f;
    }
    const loaded = Array.from(this.atlases.keys()).join(', ') || 'none';
    throw new AssetError(`Missing frame "${name}" (loaded atlases: ${loaded}). Is its group loaded?`);
  }

  private async loadAtlas(spec: AtlasSpec): Promise<void> {
    if (this.atlases.has(spec.path)) return;
    let atlas: IAtlas<F>;
    try {
      atlas = await this.backend.loadAtlas(spec.path);
    } catch (e) {
      throw new AssetError(`Could not load atlas "${spec.path}": ${e instanceof Error ? e.message : String(e)}`);
    }
    const missing = spec.frames.filter(f => atlas.frame(f) === undefined);
    if (missing.length) throw new AssetError(`Atlas "${spec.path}" is missing frame(s): ${missing.join(', ')}`);
    this.atlases.set(spec.path, atlas);
  }
}
