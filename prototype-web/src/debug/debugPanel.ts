import type { LocalGame } from '@slots/game-logic';
import type { ConfigOverrides, GameConfig } from '@slots/math-core';
import { el } from '../core/dom';
import { money, STRINGS } from '../strings';

/**
 * Debug panel (feature 19). Session-only: overrides live in memory and vanish on reload.
 * Opens with ?debug=1 or 5 taps on the version label. Not included in release builds.
 */
export class DebugPanel {
  readonly button: HTMLElement;
  readonly banner: HTMLElement;
  private panel: HTMLElement;
  private stats = { rounds: 0, cost: 0, win: 0, fs: 0, biggest: 0 };
  private statsEl = el('pre.dbg-stats');
  private msg = el('div.dbg-msg');

  constructor(private host: HTMLElement, private game: LocalGame, private readonly view: { spinStyle: 'drop' | 'scroll' }) {
    this.banner = el('div.debug-banner', { text: STRINGS.debugActive });
    this.button = el('button.dbg-btn', { text: 'DBG', onclick: () => this.toggle() });
    this.panel = el('div.dbg-panel');
    this.build();
    game.bus.on('debugOverridesChanged', e => { this.banner.classList.toggle('show', e.active); });
    game.bus.on('spinResolved', e => {
      const s = this.stats;
      s.rounds++; s.cost += e.result.cost; s.win += e.result.totalWin;
      if (e.result.freeSpins) s.fs++;
      s.biggest = Math.max(s.biggest, e.result.winX);
      this.renderStats();
    });
    this.renderStats();
  }

  mount(): void {
    this.host.append(this.button, this.panel, this.banner);
  }

  toggle(): void { this.panel.classList.toggle('open'); }

  private build(): void {
    const cfgSvc = this.game.services.config;
    const base = cfgSvc.base;
    const cur = (): GameConfig => cfgSvc.config.value;
    const num = (label: string, get: () => number, set: (v: number) => ConfigOverrides, step = 'any') => {
      const input = el('input', { type: 'number', step }) as HTMLInputElement;
      input.value = String(get());
      cfgSvc.config.subscribe(() => { input.value = String(get()); });
      input.addEventListener('change', () => this.apply(set(Number(input.value))));
      return el('label.dbg-row', {}, [el('span', { text: label }), input]);
    };
    const variant = el('select', {}, ['A', 'B', 'C', 'D'].map(v => el('option', { value: v, text: `${v}${v === base.multiplier.variant ? ' (game)' : ''}` }))) as HTMLSelectElement;
    variant.value = cur().multiplier.variant;
    variant.addEventListener('change', () => this.apply({ multiplier: { variant: variant.value as 'A' } }));
    cfgSvc.config.subscribe(c => { variant.value = c.multiplier.variant; });

    const spinStyle = el('select', {}, [el('option', { value: 'drop', text: 'Card drop (game)' }), el('option', { value: 'scroll', text: 'Scrolling reels' })]) as HTMLSelectElement;
    spinStyle.value = this.view.spinStyle;
    spinStyle.addEventListener('change', () => { this.view.spinStyle = spinStyle.value as 'drop'; this.say(`Spin style: ${spinStyle.value}`); });

    const balance = el('input', { type: 'number', step: '1', value: '10000' }) as HTMLInputElement;
    const spinSvc = this.game.services.spin;
    const latency = el('input', { type: 'range', min: '0', max: '1500', step: '50', value: String(spinSvc.latency) }) as HTMLInputElement;
    const latencyVal = el('span.dbg-val', { text: `${spinSvc.latency} ms` });
    latency.addEventListener('input', () => { spinSvc.setLatency(Number(latency.value)); latencyVal.textContent = `${latency.value} ms`; });
    const offline = el('input', { type: 'checkbox' }) as HTMLInputElement;
    offline.addEventListener('change', () => { spinSvc.setOffline(offline.checked); this.say(offline.checked ? 'Next spins fail: offline' : 'Back online'); });

    this.panel.append(
      el('div.dbg-head', {}, [el('b', { text: 'Debug (this session only)' }), el('button', { text: '✕', onclick: () => this.toggle() })]),
      el('div.dbg-sec', { text: 'Math overrides' }),
      el('label.dbg-row', {}, [el('span', { text: 'Multiplier variant' }), variant]),
      num('Golden chance (base)', () => cur().golden.chanceBase, v => ({ golden: { chanceBase: v } })),
      num('Golden chance (free)', () => cur().golden.chanceFree, v => ({ golden: { chanceFree: v } })),
      num('Free spins awarded', () => cur().freeSpins.spins, v => ({ freeSpins: { spins: v } }), '1'),
      num('Buy price (x bet)', () => cur().buyBonus.priceX, v => ({ buyBonus: { priceX: v } })),
      num('Max win (x bet)', () => cur().maxWinX, v => ({ maxWinX: v }), '1'),
      el('div.dbg-btns', {}, [
        el('button', { text: 'Reset to game.json', onclick: () => { cfgSvc.clearOverrides(); this.say('Overrides cleared'); } }),
        el('button', { text: 'Copy overrides JSON', onclick: () => this.copy(cfgSvc.exportOverrides()) }),
      ]),
      el('div.dbg-sec', { text: 'Presentation' }),
      el('label.dbg-row', {}, [el('span', { text: 'Spin style' }), spinStyle]),
      el('div.dbg-sec', { text: 'Force next round' }),
      el('div.dbg-btns', {}, [
        el('button', { text: 'Trigger free spins', onclick: () => { this.game.controllers.spin.forceNext({ triggerFreeSpins: true }); this.say('Next spin triggers free spins'); } }),
        el('button', { text: 'Buy bonus now', onclick: () => { this.toggle(); void this.game.controllers.buyBonus.buy(1); } }),
      ]),
      el('div.dbg-sec', { text: 'Wallet' }),
      el('label.dbg-row', {}, [el('span', { text: 'Set balance' }), balance,
        el('button', { text: 'Set', onclick: () => this.setBalance(Number(balance.value)) })]),
      el('div.dbg-sec', { text: 'Network (simulated)' }),
      el('label.dbg-row', {}, [el('span', { text: 'Server delay' }), latency, latencyVal]),
      el('label.dbg-row', {}, [el('span', { text: 'Offline' }), offline]),
      el('div.dbg-btns', {}, [
        el('button', { text: 'Interrupt round (reload mid-spin)', onclick: () => { this.toggle(); void this.game.controllers.spin.spinOnce(); setTimeout(() => location.reload(), 900); } }),
      ]),
      el('div.dbg-sec', { text: 'Session stats' }),
      this.statsEl,
      el('button', { text: 'Reset stats', onclick: () => { this.stats = { rounds: 0, cost: 0, win: 0, fs: 0, biggest: 0 }; this.renderStats(); } }),
      this.msg,
    );
  }

  private apply(o: ConfigOverrides): void {
    const svc = this.game.services.config;
    try {
      svc.setOverrides(mergeDeep(structuredClone(svc.overrides), o));
      this.say(`Changed: ${svc.changed.join(', ') || 'nothing'}`);
    } catch (e) {
      this.say(e instanceof Error ? e.message : String(e), true);
    }
  }

  private setBalance(v: number): void {
    if (!(v >= 0) || this.game.models.spin.isBusy) return;
    const w = this.game.services.wallet;
    w.apply(v - w.peek());
    this.game.models.wallet.balance.set(w.peek());
    this.say(`Balance set to ${money(v)}`);
  }

  private renderStats(): void {
    const s = this.stats;
    const rtp = s.cost ? (s.win / s.cost * 100).toFixed(2) + '%' : '-';
    this.statsEl.textContent = `Rounds      ${s.rounds}\nPaid        ${money(s.cost)}\nWon         ${money(s.win)}\nSession RTP ${rtp}\nFree spins  ${s.fs}\nBiggest     ${s.biggest.toFixed(1)}x`;
  }

  private copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.say('Copied'), () => this.say(text));
  }

  private say(text: string, bad = false): void {
    this.msg.textContent = text;
    this.msg.classList.toggle('bad', bad);
  }
}

function mergeDeep<T>(a: T, b: unknown): T {
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return b as T;
  const out = (typeof a === 'object' && a !== null ? a : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(b)) out[k] = mergeDeep(out[k], v);
  return out as T;
}
