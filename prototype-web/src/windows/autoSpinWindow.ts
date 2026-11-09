import type { LocalGame } from '@slots/game-logic';
import { el } from '../core/dom';
import { money, STRINGS } from '../strings';
import { Modal } from './modal';

/** Spin counts offered. Infinity = until the player stops it. */
export const AUTO_COUNTS = [10, 20, 50, 100, Infinity];
/** Stop-limit options, as multiples of the current bet. 0 = off. */
const LIMIT_X = [0, 10, 50, 100, 500];

/**
 * Auto Spin window (feature 6): pick a count and stop conditions, then Start.
 * The spin button shows the spins left and becomes the stop button while it runs.
 */
export function openAutoSpinWindow(host: HTMLElement, game: LocalGame, onStart: (count: number) => void): void {
  const bet = game.models.bet.bet;
  const prev = game.models.autoSpin.conditions;
  let count = 50;
  let onFeature = prev.onFeature;
  let winX = LIMIT_X.find(x => x * bet === prev.singleWinAtLeast) ?? 0;
  let dropX = LIMIT_X.find(x => x * bet === prev.balanceDropBy) ?? 0;

  const modal = new Modal(host, STRINGS.autoTitle).open();
  const counts = el('div.auto-counts');
  const feature = el('button.toggle');
  const winRow = el('div.chips');
  const dropRow = el('div.chips');
  const label = (x: number) => (x === 0 ? STRINGS.off : money(x * bet));

  const render = () => {
    counts.replaceChildren(...AUTO_COUNTS.map(n =>
      el(`button.auto-opt${n === count ? '.on' : ''}`, { text: n === Infinity ? '∞' : String(n), onclick: () => { count = n; render(); } })));
    feature.classList.toggle('on', onFeature);
    feature.setAttribute('aria-pressed', String(onFeature));
    winRow.replaceChildren(...LIMIT_X.map(x => el(`button.chip${x === winX ? '.on' : ''}`, { text: label(x), onclick: () => { winX = x; render(); } })));
    dropRow.replaceChildren(...LIMIT_X.map(x => el(`button.chip${x === dropX ? '.on' : ''}`, { text: label(x), onclick: () => { dropX = x; render(); } })));
  };
  feature.addEventListener('click', () => { onFeature = !onFeature; render(); });
  feature.append(el('span.knob'));

  modal.body.append(
    el('div.auto-label', { text: STRINGS.autoCount }), counts,
    el('div.auto-label', { text: STRINGS.autoStops }),
    el('div.stop-row', {}, [el('span', { text: STRINGS.stopOnFeature }), feature]),
    el('div.stop-label', { text: STRINGS.stopOnWin }), winRow,
    el('div.stop-label', { text: STRINGS.stopOnDrop }), dropRow,
    el('button.primary', {
      text: STRINGS.startAuto, onclick: () => {
        game.models.autoSpin.conditions = { onFeature, singleWinAtLeast: winX * bet, balanceDropBy: dropX * bet };
        modal.close();
        onStart(count);
      },
    }),
  );
  render();
}
