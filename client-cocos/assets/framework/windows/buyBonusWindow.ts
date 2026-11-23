import type { Node } from 'cc';
import { Graphics } from 'cc';
import { STRINGS, money } from '../../shared/game-logic/index';
import type { LocalGame } from '../../shared/game-logic/index';
import { buyPriceX } from '../../shared/math-core/index';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';
import { Modal } from './modal';
import { actionButton, stepper } from './widgets';

/**
 * Buy Bonus window: choose the bet, see the price, Buy, then confirm.
 * Buying changes the main bet to the one picked here, so free spins play at that bet.
 */
export function openBuyBonusWindow(host: Node, game: LocalGame, onBuy: () => void): void {
  const { bet } = game.models;
  const buy = game.controllers.buyBonus;
  const cfg = game.services.config.config.value;
  let pick = bet.index.value;
  const priceX = buyPriceX(cfg);
  const modal = new Modal(host, STRINGS.buyTitle, { height: 900, centered: true }).open();
  const top = modal.top;

  const step1 = uiNode('Step1');
  const step2 = uiNode('Step2');
  modal.body.addChild(step1);
  modal.body.addChild(step2);
  step2.active = false;

  // Step 1: art badge, bet stepper, price, note, Buy.
  const badge = uiNode('Badge', 200, 200);
  badge.setPosition(0, top - 110, 0);
  drawRoundRect(badge.addComponent(Graphics), 200, 200, { fill: '#be123c', stroke: '#f5c542', strokeWidth: 6, radius: 100 });
  makeLabel(badge, String(cfg.freeSpins.spins), 96, '#ffffff', 0, 20, 200);
  makeLabel(badge, STRINGS.freeSpins, 22, '#f6efff', 0, -52, 200);
  step1.addChild(badge);
  makeLabel(step1, STRINGS.bet, 30, '#f6efff', 0, top - 280, 400);
  const betVal = stepper(step1, 0, top - 340, 520,
    () => { pick = pick <= 0 ? bet.levels.length - 1 : pick - 1; render(); },
    () => { pick = pick >= bet.levels.length - 1 ? 0 : pick + 1; render(); });
  makeLabel(step1, STRINGS.price, 30, '#f6efff', 0, top - 430, 400);
  const price = makeLabel(step1, '', 64, '#f5c542', 0, top - 500, 560);
  const note = makeLabel(step1, '', 26, '#b9a8d6', 0, top - 570, 560, { wrap: true, bold: false });
  const buyBtn = actionButton(step1, STRINGS.buy, 0, -modal.height / 2 + 70, 460, true, () => {
    if (!buy.canAfford(1, bet.levels[pick]!)) return;
    confirmText.string = STRINGS.buyConfirm(money(buy.price(bet.levels[pick]!)));
    step1.active = false; step2.active = true;
  });

  // Step 2: confirm.
  const confirmText = makeLabel(step2, '', 44, '#ffffff', 0, 120, 560, { wrap: true });
  actionButton(step2, STRINGS.back, -150, -modal.height / 2 + 70, 280, false, () => { step2.active = false; step1.active = true; });
  actionButton(step2, STRINGS.confirm, 150, -modal.height / 2 + 70, 280, true, () => {
    game.controllers.bet.select(pick);
    modal.close();
    onBuy();
  });

  const render = (): void => {
    const b = bet.levels[pick]!;
    betVal.string = money(b);
    price.string = money(buy.price(b));
    const ok = buy.canAfford(1, b);
    note.string = ok ? STRINGS.buyNote(priceX) : STRINGS.buyNoFunds;
    note.color = hex(ok ? '#b9a8d6' : '#ff7a7a');
    buyBtn.node.getComponent(Graphics)!.node.setScale(1, 1, 1);
    drawRoundRect(buyBtn.node.getComponent(Graphics)!, 460, 84, { fill: ok ? '#f5c542' : '#4a3f55', stroke: '#3a1f12', radius: 42 });
  };
  render();
}
