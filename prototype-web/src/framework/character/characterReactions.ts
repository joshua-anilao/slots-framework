import { DEFAULT_WIN_TIERS, StateMachine } from '@slots/game-logic';
import type { EventBus, TransitionTable, WinTierThresholds } from '@slots/game-logic';
import type { GameConfig, RoundResult } from '@slots/math-core';
import type { PresenterCue } from '../cascade/htmlRoundPresenter';
import type { CharacterRig, CharacterState } from './characterRig';

/** Tunables for the character (docs/TUNING.md, "Character (prototype)"). A theme may override any of them. */
export interface CharacterConfig {
  /** A win of at least this many times the bet makes the character cheer. 0 = any win; a bigger value = smaller wins get no reaction. */
  smallWinMinX: number;
  /** The character reacts to a losing spin. */
  reactToLoss: boolean;
  /** How long each clip lasts (ms). Idle and bonus are loop lengths. They do not speed up with turbo. */
  clipMs: Record<CharacterState, number>;
  /** How long the character takes to rise in during the intro (ms). */
  introMs: number;
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  smallWinMinX: 0,
  reactToLoss: true,
  clipMs: { idle: 2400, bonus: 800, smallWin: 1200, bigWin: 2400, lose: 900, nearMiss: 1400 },
  introMs: 600,
};

/** Fills in anything the theme did not override. */
export function characterConfigWith(over: Partial<CharacterConfig> | undefined): CharacterConfig {
  const d = DEFAULT_CHARACTER_CONFIG;
  return { ...d, ...over, clipMs: { ...d.clipMs, ...over?.clipMs } };
}

/**
 * Which reaction a finished round deserves (pure, no DOM). Order: bonus, smallWin, nearMiss, lose.
 * Near miss = one scatter short of free spins on the base grid. `_tiers` is kept for the day a
 * game wants a different reaction per tier; the big-win reaction itself follows the `winTier` event.
 */
export function reactionFor(r: RoundResult, minScatters: number, _tiers: WinTierThresholds, c: CharacterConfig): Exclude<CharacterState, 'idle'> | null {
  if (r.freeSpins) return 'bonus';
  if (r.winX > 0) return r.winX >= c.smallWinMinX ? 'smallWin' : null;
  if (r.base && r.base.scatterCount === minScatters - 1) return 'nearMiss';
  return c.reactToLoss ? 'lose' : null;
}

type Ev = Exclude<CharacterState, 'idle'> | 'done' | 'bonusEnd' | 'reset';

const ANY_REACTION: Partial<Record<Ev, CharacterState>> = { smallWin: 'smallWin', bigWin: 'bigWin', lose: 'lose', nearMiss: 'nearMiss', bonus: 'bonus' };

/** What the character may do next. A missing entry means the event is ignored. */
const TABLE: TransitionTable<CharacterState, Ev> = {
  idle: { ...ANY_REACTION, reset: 'idle' },
  smallWin: { ...ANY_REACTION, done: 'idle', reset: 'idle' },
  lose: { ...ANY_REACTION, done: 'idle', reset: 'idle' },
  nearMiss: { ...ANY_REACTION, done: 'idle', reset: 'idle' },
  bigWin: { bigWin: 'bigWin', bonus: 'bonus', done: 'idle', reset: 'idle' },
  bonus: { bonusEnd: 'idle', reset: 'idle' },
};

/**
 * Turns finished rounds into character reactions. It only reads results that are already decided,
 * and the cues arrive after the grid has landed, so it never spoils a spin.
 */
export class CharacterReactionController {
  private readonly machine = new StateMachine<CharacterState, Ev>('idle', TABLE);
  /** Bumped on every clip; a one-shot that ends late must not end a newer clip. */
  private token = 0;

  constructor(
    private readonly rig: CharacterRig,
    bus: EventBus,
    private readonly cfg: CharacterConfig,
    private readonly getConfig: () => GameConfig,
    private readonly tiers: WinTierThresholds = DEFAULT_WIN_TIERS,
  ) {
    bus.on('winTier', () => this.send('bigWin'));
    bus.on('roundPresented', () => this.send('bonusEnd')); // safety net if playback threw mid free spins
  }

  /** Starts the idle loop. */
  start(): void { this.play('idle'); }

  onCue(cue: PresenterCue): void {
    switch (cue.kind) {
      case 'baseLanded': {
        const reaction = reactionFor(cue.result, this.getConfig().freeSpins.minScatters, this.tiers, this.cfg);
        // A round with free spins reacts when the scatters celebrate (freeSpinsStart), not here.
        if (reaction && reaction !== 'bonus') this.send(reaction);
        break;
      }
      case 'freeSpinsStart': this.send('bonus'); break;
      case 'freeSpinsEnd': this.send('bonusEnd'); break;
    }
  }

  /** Debug: show a state now. "idle" resets from any state, bonus included. */
  force(state: CharacterState): void {
    this.machine.send('reset');
    if (state === 'idle') this.play('idle');
    else this.send(state);
  }

  private send(event: Ev): void {
    // The controller plays whenever the move is accepted, so a reaction can restart itself.
    if (!this.machine.send(event)) return;
    this.play(this.machine.state.value);
  }

  private play(state: CharacterState): void {
    const token = ++this.token;
    const loop = state === 'idle' || state === 'bonus';
    void this.rig.play(state, loop, this.cfg.clipMs[state]).then(() => {
      if (!loop && token === this.token) this.send('done');
    });
  }
}
