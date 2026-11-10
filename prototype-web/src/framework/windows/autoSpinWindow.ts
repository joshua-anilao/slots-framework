import type { LocalGame } from '@slots/game-logic';
import { el } from '../core/dom';
import { money, STRINGS } from '../strings';
import { Modal } from './modal';

/** Quick picks under Total Spins. */
export const AUTO_PRESETS = [50, 100, 200, 500, 999];
const MAX_SPINS = 999;
/** Steps for "single win exceeds" (times the bet). */
const WIN_X = [5, 10, 20, 50, 100, 200, 500, 1000];

/** One option row: tick on the left, label, and an optional − value + stepper on the right. */
class OptionRow {
  readonly root: HTMLElement;
  private tick = el('button.radio', { 'aria-pressed': 'false' });
  private value = el('div.step-val');
  constructor(label: string, public on: boolean, step?: { show: () => string; dec: () => void; inc: () => void }) {
    this.tick.addEventListener('click', () => this.set(!this.on));
    const right = step
      ? [el('div.stepper', {}, [
        el('button.step-btn', { text: '−', 'aria-label': 'less', onclick: () => { step.dec(); this.set(true); this.render(step.show()); } }),
        this.value,
        el('button.step-btn', { text: '+', 'aria-label': 'more', onclick: () => { step.inc(); this.set(true); this.render(step.show()); } }),
      ])]
      : [];
    this.root = el('div.opt-row', {}, [this.tick, el('span.opt-label', { text: label, onclick: () => this.set(!this.on) }), ...right]);
    if (step) this.render(step.show());
    this.set(on);
  }
  set(v: boolean): void {
    this.on = v;
    this.tick.classList.toggle('on', v);
    this.tick.setAttribute('aria-pressed', String(v));
    this.root.classList.toggle('off', !v);
  }
  render(text: string): void {
    this.value.textContent = text;
  }
}

/**
 * Auto Spin Setting window (feature 6), opened by holding AUTO.
 * Layout follows Josh's reference: Total Spins with stepper and quick picks, then the stop conditions, Cancel / Start.
 * A row with its tick off is ignored (Total Spins off = until stopped).
 */
export function openAutoSpinWindow(host: HTMLElement, game: LocalGame, onStart: (count: number) => void): void {
  const bet = game.models.bet.bet;
  const balance = game.models.wallet.balance.value;
  const prev = game.models.autoSpin.conditions;
  const step = Math.max(1, bet * 10); // balance limits move 10 bets at a time
  const round = (v: number) => Math.round(v * 100) / 100;

  let spins = 100;
  let winX = WIN_X.find(x => round(x * bet) === prev.singleWinAtLeast) ?? 100;
  let below = prev.balanceBelow || round(Math.max(0, balance - bet * 50));
  let above = prev.balanceAbove || round(balance + bet * 100);

  const modal = new Modal(host, STRINGS.autoTitle, undefined, true).open();
  modal.root.classList.add('auto-win');

  const total = new OptionRow(STRINGS.totalSpins, true, {
    show: () => String(spins),
    dec: () => { spins = spins <= 10 ? MAX_SPINS : spins - 10; }, // loops from the lowest to the highest
    inc: () => { spins = spins >= MAX_SPINS ? 10 : Math.min(MAX_SPINS, spins + 10); }, // loops from the highest to the lowest
  });
  const presets = el('div.presets');
  const renderPresets = () => presets.replaceChildren(...AUTO_PRESETS.map(n =>
    el(`button.preset${n === spins && total.on ? '.on' : ''}`, { text: String(n), onclick: () => { spins = n; total.set(true); total.render(String(n)); renderPresets(); } })));
  total.root.addEventListener('click', () => renderPresets());
  renderPresets();

  const win = new OptionRow(STRINGS.stopOnWinX, prev.singleWinAtLeast > 0, {
    show: () => `${winX}X`,
    dec: () => { winX = WIN_X[(WIN_X.indexOf(winX) + WIN_X.length - 1) % WIN_X.length]; },
    inc: () => { winX = WIN_X[(WIN_X.indexOf(winX) + 1) % WIN_X.length]; },
  });
  const low = new OptionRow(STRINGS.stopBelow, prev.balanceBelow > 0, {
    show: () => money(below),
    dec: () => { below = round(Math.max(0, below - step)); },
    inc: () => { below = round(below + step); },
  });
  const high = new OptionRow(STRINGS.stopAbove, prev.balanceAbove > 0, {
    show: () => money(above),
    dec: () => { above = round(Math.max(step, above - step)); },
    inc: () => { above = round(above + step); },
  });
  const feature = new OptionRow(STRINGS.stopOnFeature, prev.onFeature);

  modal.body.append(
    el('div.auto-box', {}, [total.root, presets]),
    win.root, low.root, high.root, feature.root,
    el('div.confirm-row.auto-actions', {}, [
      el('button.btn-cancel', { text: STRINGS.cancel, onclick: () => modal.close() }),
      el('button.btn-start', {
        text: STRINGS.start, onclick: () => {
          game.models.autoSpin.conditions = {
            onFeature: feature.on,
            singleWinAtLeast: win.on ? round(winX * bet) : 0,
            balanceDropBy: 0,
            balanceBelow: low.on ? below : 0,
            balanceAbove: high.on ? above : 0,
          };
          modal.close();
          onStart(total.on ? spins : Infinity);
        },
      }),
    ]),
    el('div.auto-hint', { text: STRINGS.autoHint }),
  );
}
