import { el } from '../core/dom';
import type { CharacterRig, CharacterState } from './characterRig';

/** The joints of the cut-out puppet. Each bone is one piece of art that turns around its pivot. */
export type BoneName = 'hips' | 'torso' | 'head' | 'armL' | 'foreL' | 'armR' | 'foreR';

/** Who hangs on whom: a child moves with its parent. The hips are the root. */
const BONE_PARENT: Record<BoneName, BoneName | null> = {
  hips: null, torso: 'hips', head: 'torso', armL: 'torso', foreL: 'armL', armR: 'torso', foreR: 'armR',
};
/** Parents come first so a child can be added to a parent that already exists. */
const BONE_ORDER: BoneName[] = ['hips', 'torso', 'armL', 'foreL', 'armR', 'foreR', 'head'];

/** One piece of the puppet: SVG art, its box (px, relative to its parent bone's top-left) and its pivot inside that box. */
export interface PuppetPart {
  svg: string;
  x: number; y: number; w: number; h: number;
  pivotX: number; pivotY: number;
}

export interface PuppetParts {
  /** Size of the whole figure in design px. */
  width: number;
  height: number;
  bones: Record<BoneName, PuppetPart>;
}

/** Transforms per bone, evenly spaced over the clip. A loop starts and ends on the same pose. */
export type PuppetClip = Partial<Record<BoneName, string[]>>;

/** Time to ease from the current pose into a loop's first pose, so nothing snaps. */
const BLEND_MS = 180;
const REST = 'none';

const r = (deg: number) => `rotate(${deg}deg)`;
const hop = (px: number) => `translateY(${-px}px)`;

/** Default clips for the puppet (the game's art only supplies the pieces). Angles in degrees, positive = clockwise. */
export const PUPPET_CLIPS: Record<CharacterState, PuppetClip> = {
  idle: {
    hips: [hop(0), hop(3), hop(0), hop(3), hop(0)],
    torso: [r(0), r(1.6), r(0), r(-1.6), r(0)],
    head: [r(0), r(-2.5), r(0), r(2.5), r(0)],
    armL: [r(4), r(7), r(4), r(2), r(4)],
    armR: [r(-4), r(-2), r(-4), r(-7), r(-4)],
  },
  smallWin: {
    hips: [hop(0), hop(14), hop(0), hop(14), hop(0)],
    torso: [r(0), r(-3), r(0), r(3), r(0)],
    head: [r(0), r(-6), r(0), r(6), r(0)],
    armL: [r(4), r(135), r(110), r(135), r(4)],
    armR: [r(-4), r(-135), r(-110), r(-135), r(-4)],
    foreL: [r(0), r(-15), r(10), r(-15), r(0)],
    foreR: [r(0), r(15), r(-10), r(15), r(0)],
  },
  bigWin: {
    hips: [hop(0), hop(26), hop(0), hop(26), hop(0), hop(26), hop(0)],
    torso: [r(0), r(-6), r(0), r(6), r(0), r(-6), r(0)],
    head: [r(0), r(-12), r(0), r(12), r(0), r(-12), r(0)],
    armL: [r(4), r(165), r(140), r(165), r(140), r(165), r(4)],
    armR: [r(-4), r(-165), r(-140), r(-165), r(-140), r(-165), r(-4)],
    foreL: [r(0), r(-25), r(15), r(-25), r(15), r(-25), r(0)],
    foreR: [r(0), r(25), r(-15), r(25), r(-15), r(25), r(0)],
  },
  lose: {
    hips: [hop(0), `translateY(8px)`, `translateY(8px)`, hop(0)],
    torso: [r(0), r(7), r(7), r(0)],
    head: [r(0), r(16), r(16), r(0)],
    armL: [r(4), r(-6), r(-6), r(4)],
    armR: [r(-4), r(6), r(6), r(-4)],
  },
  nearMiss: {
    hips: [hop(0), hop(4), hop(0), hop(0)],
    torso: [r(0), r(-3), r(3), r(0)],
    head: [r(0), r(-14), r(14), r(-10), r(10), r(0)],
    armL: [r(4), r(150), r(150), r(150), r(4)],
    armR: [r(-4), r(-150), r(-150), r(-150), r(-4)],
    foreL: [r(0), r(-110), r(-110), r(-110), r(0)],
    foreR: [r(0), r(110), r(110), r(110), r(0)],
  },
  bonus: {
    hips: [hop(0), hop(12), hop(0), hop(12), hop(0)],
    torso: [r(-3), r(3), r(-3), r(3), r(-3)],
    head: [r(-5), r(5), r(-5), r(5), r(-5)],
    armL: [r(130), r(60), r(130), r(60), r(130)],
    armR: [r(-60), r(-130), r(-60), r(-130), r(-60)],
  },
};

/** Cut-out puppet: bones are plain divs; the pose is the CSS transform, driven by element.animate. */
class PuppetRig implements CharacterRig {
  readonly root: HTMLElement;
  private readonly bones = new Map<BoneName, HTMLElement>();
  private running: Animation[] = [];
  /** Bumped on every play(), so a blend or clip that was replaced stops quietly. */
  private token = 0;

  constructor(parts: PuppetParts) {
    this.root = el('div.character-puppet');
    this.root.style.width = `${parts.width}px`;
    this.root.style.height = `${parts.height}px`;
    for (const name of BONE_ORDER) {
      const part = parts.bones[name];
      const bone = el(`div.bone.bone-${name}`);
      bone.style.cssText = `position:absolute;left:${part.x}px;top:${part.y}px;width:${part.w}px;height:${part.h}px;`
        + `transform-origin:${part.pivotX}px ${part.pivotY}px;`;
      bone.innerHTML = part.svg; // the game's own static SVG strings
      const parent = BONE_PARENT[name];
      (parent ? this.bones.get(parent)! : this.root).append(bone);
      this.bones.set(name, bone);
    }
  }

  async enter(ms: number): Promise<void> {
    const rise = this.root.animate(
      [{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'none' }],
      { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    await rise.finished.catch(() => undefined);
  }

  async play(state: CharacterState, loop: boolean, ms: number): Promise<void> {
    const token = ++this.token;
    const from = this.snapshot();
    this.stop();
    const clip = PUPPET_CLIPS[state];
    if (loop) {
      // Ease into the first pose, then loop from there.
      const blend = this.animateAll(name => [from.get(name)!, clip[name]?.[0] ?? REST], BLEND_MS, false);
      await this.whenDone(blend);
      if (token !== this.token) return;
      this.stop();
      this.animateAll(name => clip[name] ?? [REST, REST], ms, true);
      return; // loops until the next play()
    }
    const run = this.animateAll(name => [from.get(name)!, ...(clip[name] ?? [REST])], ms, false);
    await this.whenDone(run);
  }

  /** The pose each bone is in right now, so a new clip can start from it. */
  private snapshot(): Map<BoneName, string> {
    const now = new Map<BoneName, string>();
    for (const [name, bone] of this.bones) now.set(name, getComputedStyle(bone).transform || REST);
    return now;
  }

  private stop(): void {
    for (const a of this.running) a.cancel();
    this.running = [];
  }

  private animateAll(poses: (bone: BoneName) => string[], ms: number, loop: boolean): Animation[] {
    const made: Animation[] = [];
    for (const [name, bone] of this.bones) {
      // Easing belongs on each keyframe: on the timing it would stretch across the whole clip.
      const frames = poses(name).map(transform => ({ transform, easing: 'ease-in-out' }));
      made.push(bone.animate(frames, { duration: ms, iterations: loop ? Infinity : 1, fill: 'forwards' }));
    }
    this.running.push(...made);
    return made;
  }

  /** Resolves when every animation has finished or was replaced. */
  private async whenDone(list: Animation[]): Promise<void> {
    await Promise.all(list.map(a => a.finished.then(() => undefined, () => undefined)));
  }
}

/** A stage with no character (the game gave none): same interface, does nothing. */
class EmptyRig implements CharacterRig {
  readonly root = el('div.character-puppet.empty');
  async play(): Promise<void> { /* nothing to animate */ }
  async enter(): Promise<void> { /* nothing to show */ }
}

export function createPuppetRig(parts: PuppetParts): CharacterRig { return new PuppetRig(parts); }
export function createEmptyRig(): CharacterRig { return new EmptyRig(); }
