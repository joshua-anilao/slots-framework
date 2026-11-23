import type { SpeedMode } from '../../shared/game-logic/index';
import type { IKeyValueStore } from '../audio/audioManager';

/** Player settings kept on this device. Sound mute lives in the AudioManager. */
export interface PlayerSettings {
  /** Speed the game starts in. */
  speed: SpeedMode;
  /** Skip the loading tutorial: the game opens by itself when loading ends. */
  skipIntro: boolean;
}

const KEY = 'slots.game001.settings';
const DEFAULTS: PlayerSettings = { speed: 'normal', skipIntro: false };

export function loadSettings(store: IKeyValueStore): PlayerSettings {
  try { return { ...DEFAULTS, ...JSON.parse(store.get(KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; }
}

export function saveSettings(store: IKeyValueStore, s: PlayerSettings): void {
  store.set(KEY, JSON.stringify(s));
}
