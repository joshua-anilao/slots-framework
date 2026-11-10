import type { LocalGame } from '@slots/game-logic';
import { el } from '../core/dom';
import { money, STRINGS } from '../strings';
import { Modal } from './modal';

/** Change Bet window (feature 1): level list, − / +, confirm. */
export function openBetWindow(host: HTMLElement, game: LocalGame): void {
  const { bet } = game.models;
  let pick = bet.index.value;
  const modal = new Modal(host, STRINGS.changeBet).open();
  const current = el('div.bet-current');
  const grid = el('div.bet-grid');
  const render = () => {
    current.textContent = money(bet.levels[pick]);
    grid.replaceChildren(...bet.levels.map((v, i) =>
      el(`button.bet-opt${i === pick ? '.on' : ''}`, { text: money(v), onclick: () => { pick = i; render(); } })));
  };
  modal.body.append(
    el('div.bet-row', {}, [
      el('button.round-btn', { text: '−', onclick: () => { pick = Math.max(0, pick - 1); render(); } }),
      current,
      el('button.round-btn', { text: '+', onclick: () => { pick = Math.min(bet.levels.length - 1, pick + 1); render(); } }),
    ]),
    grid,
    el('button.primary', { text: STRINGS.confirm, onclick: () => { game.controllers.bet.select(pick); modal.close(); } }),
  );
  render();
}
