import type { LocalGame } from '@slots/game-logic';
import { buyPriceX } from '@slots/math-core';
import { el } from '../core/dom';
import { money, STRINGS } from '../strings';
import { Modal } from './modal';

/**
 * Buy Bonus window (feature 7): choose the bet, see the price, Buy, then confirm.
 * Buying changes the main bet to the one picked here, so free spins play at that bet.
 */
export function openBuyBonusWindow(host: HTMLElement, game: LocalGame, onBuy: () => void): void {
  const { bet } = game.models;
  const buy = game.controllers.buyBonus;
  let pick = bet.index.value;
  const modal = new Modal(host, STRINGS.buyTitle).open();
  const betVal = el('div.bet-current');
  const price = el('div.buy-price');
  const note = el('div.buy-note');
  const buyBtn = el('button.primary', { text: STRINGS.buy }) as HTMLButtonElement;
  const step1 = el('div.buy-step');
  const step2 = el('div.buy-step.confirm');
  const confirmText = el('div.confirm-text');
  const priceX = buyPriceX(game.services.config.config.value);

  const render = () => {
    const b = bet.levels[pick];
    betVal.textContent = money(b);
    price.textContent = money(buy.price(b));
    const ok = buy.canAfford(1, b);
    buyBtn.disabled = !ok;
    note.textContent = ok ? STRINGS.buyNote(priceX) : STRINGS.buyNoFunds;
    note.classList.toggle('bad', !ok);
  };
  const showStep = (confirm: boolean) => {
    const [show, hide] = confirm ? [step2, step1] : [step1, step2];
    hide.hidden = true;
    show.hidden = false;
    show.animate([{ opacity: 0, transform: 'translateX(' + (confirm ? 40 : -40) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
  };
  buyBtn.addEventListener('click', () => {
    confirmText.textContent = STRINGS.buyConfirm(money(buy.price(bet.levels[pick])));
    showStep(true);
  });

  step1.append(
    el('div.buy-art', {}, [el('span.buy-badge', { text: String(game.services.config.config.value.freeSpins.spins) }), el('span', { text: STRINGS.freeSpins })]),
    el('div.auto-label', { text: STRINGS.bet }),
    el('div.bet-row', {}, [
      el('button.round-btn', { text: '−', onclick: () => { pick = pick <= 0 ? bet.levels.length - 1 : pick - 1; render(); } }),
      betVal,
      el('button.round-btn', { text: '+', onclick: () => { pick = pick >= bet.levels.length - 1 ? 0 : pick + 1; render(); } }),
    ]),
    el('div.auto-label', { text: STRINGS.price }), price, note, buyBtn,
  );
  step2.hidden = true;
  step2.append(
    confirmText,
    el('div.confirm-row', {}, [
      el('button.secondary', { text: STRINGS.back, onclick: () => showStep(false) }),
      el('button.primary', {
        text: STRINGS.confirm, onclick: () => {
          game.controllers.bet.select(pick);
          modal.close();
          onBuy();
        },
      }),
    ]),
  );
  modal.body.append(step1, step2);
  render();
}
