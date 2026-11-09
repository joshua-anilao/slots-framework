import type { SpeedMode } from '@slots/game-logic';

/**
 * Timings (ms) per speed. Normal speed is matched frame by frame to the reference
 * gameplay video (2026-11-09, see docs/SCREENS_AND_FEATURES.md 4b). Config, not code.
 */
export interface Timing {
  // Spin: "drop" style (cards fall out, new cards fall in)
  clear: number;        // old cards fall out of the grid
  cardFall: number;     // one card falling into place
  cardStagger: number;  // between cards in a reel (bottom card first)
  reelStagger: number;  // between reels, left to right
  // Spin: "scroll" style (classic reel strip)
  firstStop: number;
  stopGap: number;
  // Anticipation (2+ scatters landed): remaining reels drop one at a time under a spotlight
  anticipation: number; // per remaining reel; 0 = off
  // Cascade step
  highlight: number;    // winning cards glow, win amount shown
  pop: number;          // winning cards burst
  drop: number;         // cards above fall, new cards fall in
  wildReveal: number;   // gold card flips from card back to WILD
  stepPause: number;    // breath before the next step
  // Features
  scatterCelebrate: number; // scatters pulse before free spins
  banner: number;       // free spins intro / outro auto-continue
  countUp: number;      // big win / free spins total count-up
}

export const TIMINGS: Record<SpeedMode, Timing> = {
  normal: { clear: 200, cardFall: 300, cardStagger: 40, reelStagger: 90, firstStop: 600, stopGap: 150, anticipation: 600,
    highlight: 1000, pop: 400, drop: 300, wildReveal: 300, stepPause: 200, scatterCelebrate: 2000, banner: 2200, countUp: 4000 },
  turbo: { clear: 120, cardFall: 180, cardStagger: 20, reelStagger: 45, firstStop: 300, stopGap: 75, anticipation: 0,
    highlight: 550, pop: 250, drop: 200, wildReveal: 180, stepPause: 80, scatterCelebrate: 1200, banner: 1500, countUp: 2500 },
  super: { clear: 80, cardFall: 120, cardStagger: 10, reelStagger: 20, firstStop: 150, stopGap: 38, anticipation: 0,
    highlight: 300, pop: 150, drop: 120, wildReveal: 100, stepPause: 30, scatterCelebrate: 700, banner: 1000, countUp: 1500 },
};

/** How the reels spin. "drop" = card cascade games; "scroll" = classic spinning strips. */
export type SpinStyle = 'drop' | 'scroll';

/**
 * Waits that the player can cut short. skip() resolves every pending wait now
 * and makes the rest of the round use super turbo timings.
 */
export class Pace {
  private pending = new Set<() => void>();
  hurry = false;
  constructor(public speed: SpeedMode = 'normal') {}

  get t(): Timing { return TIMINGS[this.hurry ? 'super' : this.speed]; }

  wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => { clearTimeout(id); this.pending.delete(done); resolve(); };
      const id = setTimeout(done, ms);
      this.pending.add(done);
    });
  }

  skip(): void {
    this.hurry = true;
    for (const fn of [...this.pending]) fn();
  }

  reset(speed: SpeedMode): void {
    this.speed = speed;
    this.hurry = false;
  }
}
