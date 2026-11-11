import { Observable, StateMachine } from '../../shared/game-logic/index';
import type { ReadOnlyObservable } from '../../shared/game-logic/index';

/** Full screens. Only one is shown at a time. */
export type ScreenState = 'boot' | 'loading' | 'game' | 'error';
export type ScreenEvent = 'start' | 'loaded' | 'failed' | 'retry';

/** What the engine side must do. The Cocos views implement this; tests use a fake. */
export interface IScreenHost {
  showScreen(screen: ScreenState): void;
  openPopup(id: string): void;
  closePopup(id: string): void;
}

/**
 * Owns which screen is up and which popups are open on top of it.
 * Screens are a state machine (boot, loading, game, error); popups are a stack that only exists on the game screen.
 * Views never decide this themselves: they call the manager and it refuses impossible moves.
 */
export class ScreenManager {
  private readonly machine = new StateMachine<ScreenState, ScreenEvent>('boot', {
    boot: { start: 'loading' },
    loading: { loaded: 'game', failed: 'error' },
    game: { failed: 'error' },
    error: { retry: 'loading' },
  });
  private readonly stack = new Observable<readonly string[]>([]);

  constructor(private readonly host: IScreenHost) {}

  get screen(): ReadOnlyObservable<ScreenState> { return this.machine.state; }
  /** Open popups, bottom first. */
  get popups(): ReadOnlyObservable<readonly string[]> { return this.stack; }
  get topPopup(): string | undefined { return this.stack.value[this.stack.value.length - 1]; }

  /** Moves to the next screen. Returns false (and shows nothing) if the move is not allowed. */
  go(event: ScreenEvent): boolean {
    if (!this.machine.send(event)) return false;
    // Leaving the game screen drops every popup, so none is left on the loading or error screen.
    if (!this.machine.is('game')) this.closeAll();
    this.host.showScreen(this.machine.state.value);
    return true;
  }

  /** Opens a popup on the game screen. Refuses on other screens, and refuses one that is already open. */
  openPopup(id: string): boolean {
    if (!this.machine.is('game') || this.stack.value.includes(id)) return false;
    this.stack.set([...this.stack.value, id]);
    this.host.openPopup(id);
    return true;
  }

  /** Closes the named popup, or the top one when no id is given. Returns false if it was not open. */
  closePopup(id: string | undefined = this.topPopup): boolean {
    if (id === undefined || !this.stack.value.includes(id)) return false;
    this.stack.set(this.stack.value.filter(p => p !== id));
    this.host.closePopup(id);
    return true;
  }

  private closeAll(): void {
    for (const id of [...this.stack.value].reverse()) this.closePopup(id);
  }
}
