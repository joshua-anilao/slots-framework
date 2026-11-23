import { Graphics, Node } from 'cc';
import { STRINGS, money } from '../../shared/game-logic/index';
import type { LocalGame } from '../../shared/game-logic/index';
import { drawRoundRect, makeLabel, uiNode } from '../ui/uiKit';
import { Modal } from './modal';
import { actionButton, stepper } from './widgets';

/** Change Bet window: level list, − / + (loop around), confirm. */
export function openBetWindow(host: Node, game: LocalGame): void {
  const { bet } = game.models;
  let pick = bet.index.value;
  const cols = 3;
  const rows = Math.ceil(bet.levels.length / cols);
  const modal = new Modal(host, STRINGS.changeBet, { height: 420 + rows * 92 }).open();
  const root = modal.body;
  const current = stepper(root, 0, modal.top - 20, 520,
    () => { pick = pick <= 0 ? bet.levels.length - 1 : pick - 1; render(); },
    () => { pick = pick >= bet.levels.length - 1 ? 0 : pick + 1; render(); });
  current.fontSize = 56;
  const grid = uiNode('Grid');
  root.addChild(grid);
  const cells: Array<{ g: Graphics; v: number }> = [];
  bet.levels.forEach((v, i) => {
    const w = 200, h = 76;
    const c = uiNode('Opt', w, h);
    c.setPosition((i % cols - 1) * 216, modal.top - 130 - Math.floor(i / cols) * 92, 0);
    const g = c.addComponent(Graphics);
    makeLabel(c, money(v), 30, '#ffffff', 0, 0, w);
    c.on(Node.EventType.TOUCH_END, () => { pick = i; render(); });
    grid.addChild(c);
    cells.push({ g, v });
  });
  const render = (): void => {
    current.string = money(bet.levels[pick]!);
    cells.forEach((c, i) => drawRoundRect(c.g, 200, 76, { fill: i === pick ? '#b8860b' : '#352449', stroke: i === pick ? '#f5c542' : '#4a3a5c', strokeWidth: 4, radius: 18 }));
  };
  actionButton(root, STRINGS.confirm, 0, -modal.height / 2 + 70, 460, true, () => { game.controllers.bet.select(pick); modal.close(); });
  render();
}
