import { beforeEach, describe, expect, it } from 'vitest';
import { ScreenManager } from '../client-cocos/assets/framework/screens/screenManager';
import type { IScreenHost } from '../client-cocos/assets/framework/screens/screenManager';

let log: string[] = [];
const host: IScreenHost = {
  showScreen: s => log.push(`screen:${s}`),
  openPopup: id => log.push(`open:${id}`),
  closePopup: id => log.push(`close:${id}`),
};
let m: ScreenManager;
const toGame = () => { m.go('start'); m.go('loaded'); };

beforeEach(() => { log = []; m = new ScreenManager(host); });

describe('ScreenManager screens', () => {
  it('starts on boot and walks boot, loading, game', () => {
    expect(m.screen.value).toBe('boot');
    expect(m.go('start')).toBe(true);
    expect(m.go('loaded')).toBe(true);
    expect(m.screen.value).toBe('game');
    expect(log).toEqual(['screen:loading', 'screen:game']);
  });

  it('refuses impossible moves and shows nothing', () => {
    expect(m.go('loaded')).toBe(false);
    expect(m.go('retry')).toBe(false);
    toGame();
    log = [];
    expect(m.go('start')).toBe(false);
    expect(log).toEqual([]);
  });

  it('a failed load goes to error, and retry loads again', () => {
    m.go('start');
    m.go('failed');
    expect(m.screen.value).toBe('error');
    expect(m.go('retry')).toBe(true);
    expect(m.screen.value).toBe('loading');
  });
});

describe('ScreenManager popups', () => {
  it('only opens on the game screen', () => {
    expect(m.openPopup('menu')).toBe(false);
    m.go('start');
    expect(m.openPopup('menu')).toBe(false);
    expect(log).toEqual(['screen:loading']);
  });

  it('stacks popups, refuses a duplicate, closes the top first', () => {
    toGame();
    expect(m.openPopup('menu')).toBe(true);
    expect(m.openPopup('rules')).toBe(true);
    expect(m.openPopup('menu')).toBe(false);
    expect(m.topPopup).toBe('rules');
    expect(m.closePopup()).toBe(true);
    expect(m.topPopup).toBe('menu');
    expect(m.closePopup('nope')).toBe(false);
    expect(m.popups.value).toEqual(['menu']);
  });

  it('closes every popup when the game screen is left', () => {
    toGame();
    m.openPopup('menu');
    m.openPopup('rules');
    log = [];
    m.go('failed');
    expect(m.popups.value).toEqual([]);
    expect(log).toEqual(['close:rules', 'close:menu', 'screen:error']);
  });
});
