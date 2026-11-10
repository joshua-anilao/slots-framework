import type { SpeedMode } from '@slots/game-logic';

/** Player settings kept on this device (Settings window). Sound mute lives in audio.ts. */
export interface PlayerSettings {
  /** Speed the game starts in. */
  speed: SpeedMode;
  /** Short vibrations on free spins, big wins and long-press (phones that support it). */
  haptics: boolean;
}

const KEY = 'slots.game001.settings';
const DEFAULTS: PlayerSettings = { speed: 'normal', haptics: true };

export function loadSettings(): PlayerSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; }
}

export function saveSettings(s: PlayerSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

/** Vibrate if the player allows it and the phone supports it. */
export function buzz(pattern: number | number[]): void {
  if (loadSettings().haptics) navigator.vibrate?.(pattern);
}
