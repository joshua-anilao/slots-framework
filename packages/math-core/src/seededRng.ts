import type { IRng } from './rng';

/**
 * Fast seeded RNG (sfc32) for prototypes, simulation and replay.
 * Not a certified RNG: a real-money server must use a certified source.
 */
export class SeededRng implements IRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  /** Creates an RNG from a 32-bit seed. Same seed, same sequence. */
  constructor(public readonly seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 15; i++) this.next32();
  }

  /** Random 32-bit seed from the platform. */
  static randomSeed(): number {
    return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  }

  nextFloat(): number {
    return this.next32() / 0x1_0000_0000;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error(`nextInt needs a positive max, got ${maxExclusive}`);
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  private next32(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }
}
