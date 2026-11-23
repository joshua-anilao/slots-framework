import { Graphics, Label, Node } from 'cc';

import { STRINGS, money } from '../../shared/game-logic/index';
import type { LocalGame } from '../../shared/game-logic/index';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';
import { Modal } from './modal';
import { TickBox, actionButton, roundButton } from './widgets';

/** Quick picks under Total Spins. */
export const AUTO_PRESETS = [50, 100, 200, 500, 999];
const MAX_SPINS = 999;
/** Steps for "single win exceeds" (times the bet). */
const WIN_X = [5, 10, 20, 50, 100, 200, 500, 1000];

/**
 * Auto Spin Setting window, opened by holding AUTO: Total Spins with stepper and quick picks, then the stop conditions,
 * Cancel / Start. A row with its tick off is ignored (Total Spins off = until stopped).
 */
export function openAutoSpinWindow(host: Node, game: LocalGame, onStart: (count: number) => void): void {
  const bet = game.models.bet.bet;
  const balance = game.models.wallet.balance.value;
  const prev = game.models.autoSpin.conditions;
  const step = Math.max(1, bet * 10); // balance limits move 10 bets at a time
  const round = (v: number): number => Math.round(v * 100) / 100;

  let spins = 100;
  let winX = WIN_X.find(x => round(x * bet) === prev.singleWinAtLeast) ?? 100;
  let below = prev.balanceBelow || round(Math.max(0, balance - bet * 50));
  let above = prev.balanceAbove || round(balance + bet * 100);

  const modal = new Modal(host, STRINGS.autoTitle, { height: 960, centered: true, width: 660 }).open();
  const root = modal.body;
  let y = modal.top - 20;

  interface Row { tick: TickBox; value: Label | null }
  const row = (label: string, on: boolean, step?: { show: () => string; dec: () => void; inc: () => void }): Row => {
    const tick = new TickBox(root, -275, y, on, () => undefined);
    const text = makeLabel(root, label, step ? 24 : 26, '#ffffff', step ? -120 : 35, y, step ? 230 : 540, { align: 'left' });
    text.overflow = Label.Overflow.SHRINK;
    let value: Label | null = null;
    if (step) {
      value = makeLabel(root, step.show(), 30, '#f5c542', 165, y, 140);
      value.overflow = Label.Overflow.SHRINK;
      roundButton(root, '−', 55, y, () => { step.dec(); tick.set(true); value!.string = step.show(); }, 56);
      roundButton(root, '+', 275, y, () => { step.inc(); tick.set(true); value!.string = step.show(); }, 56);
    }
    y -= 100;
    return { tick, value };
  };

  // Total spins with quick picks.
  const total = row(STRINGS.totalSpins, true, {
    show: () => String(spins),
    dec: () => { spins = spins <= 10 ? MAX_SPINS : spins - 10; renderPresets(); },
    inc: () => { spins = spins >= MAX_SPINS ? 10 : Math.min(MAX_SPINS, spins + 10); renderPresets(); },
  });
  const presetCells: Array<{ g: Graphics; n: number }> = [];
  AUTO_PRESETS.forEach((n, i) => {
    const c = uiNode('Preset', 104, 64);
    c.setPosition((i - 2) * 116, y + 8, 0);
    const g = c.addComponent(Graphics);
    makeLabel(c, String(n), 28, '#ffffff', 0, 0, 104);
    c.on(Node.EventType.TOUCH_END, () => { spins = n; total.tick.set(true); total.value!.string = String(n); renderPresets(); });
    root.addChild(c);
    presetCells.push({ g, n });
  });
  const renderPresets = (): void => {
    presetCells.forEach(p => drawRoundRect(p.g, 104, 64, { fill: p.n === spins && total.tick.value ? '#b8860b' : '#352449', stroke: '#4a3a5c', strokeWidth: 3, radius: 16 }));
    if (total.value) total.value.string = String(spins);
  };
  y -= 100;
  renderPresets();

  const win = row(STRINGS.stopOnWinX, prev.singleWinAtLeast > 0, {
    show: () => `${winX}X`,
    dec: () => { winX = WIN_X[(WIN_X.indexOf(winX) + WIN_X.length - 1) % WIN_X.length]!; },
    inc: () => { winX = WIN_X[(WIN_X.indexOf(winX) + 1) % WIN_X.length]!; },
  });
  const low = row(STRINGS.stopBelow, prev.balanceBelow > 0, {
    show: () => money(below),
    dec: () => { below = round(Math.max(0, below - step)); },
    inc: () => { below = round(below + step); },
  });
  const high = row(STRINGS.stopAbove, prev.balanceAbove > 0, {
    show: () => money(above),
    dec: () => { above = round(Math.max(step, above - step)); },
    inc: () => { above = round(above + step); },
  });
  const feature = row(STRINGS.stopOnFeature, prev.onFeature);

  makeLabel(root, STRINGS.autoHint, 22, '#b9a8d6', 0, y + 20, 580, { wrap: true, bold: false });
  actionButton(root, STRINGS.cancel, -150, -modal.height / 2 + 66, 270, false, () => modal.close());
  actionButton(root, STRINGS.start, 150, -modal.height / 2 + 66, 270, true, () => {
    game.models.autoSpin.conditions = {
      onFeature: feature.tick.value,
      singleWinAtLeast: win.tick.value ? round(winX * bet) : 0,
      balanceDropBy: 0,
      balanceBelow: low.tick.value ? below : 0,
      balanceAbove: high.tick.value ? above : 0,
    };
    modal.close();
    onStart(total.tick.value ? spins : Infinity);
  });
  void hex;
}
