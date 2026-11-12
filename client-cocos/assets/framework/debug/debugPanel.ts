import { BlockInputEvents, Color, Graphics, Node } from 'cc';
import { DEBUG_FIELDS } from '../../shared/game-logic/index';
import type { DebugController } from '../../shared/game-logic/index';
import { drawRoundRect, makeButton, makeLabel, uiNode } from '../ui/uiKit';

const PANEL_W = 680, PANEL_H = 1180;
const BTN_FILL = '#f2b705', BTN_TEXT = '#3a1f12';

/**
 * Debug panel (feature 19) for Cocos. All the logic is in the shared DebugController; this only draws it.
 * Session only: nothing here is saved, and nothing writes game.json. Create it only in debug builds.
 */
export class DebugPanel {
  private readonly panel: Node;

  /** parent: the canvas node. The DBG button and the "overrides active" banner sit on it; the panel opens over the game. */
  constructor(parent: Node, private readonly dbg: DebugController) {
    makeButton(parent, { w: 90, h: 50, x: -300, y: 600, text: 'DBG', fill: '#3b82f6', textColor: '#ffffff', fontSize: 26, radius: 12 }, () => this.toggle());
    const banner = makeLabel(parent, 'DEBUG OVERRIDES ACTIVE', 24, '#ff6b6b', 40, 600, 420);
    dbg.config.subscribe(() => { banner.node.active = dbg.overridesActive; });

    this.panel = uiNode('DebugPanel', PANEL_W, PANEL_H);
    this.panel.addComponent(BlockInputEvents);
    drawRoundRect(this.panel.addComponent(Graphics), PANEL_W, PANEL_H, { fill: '#1b0f0a', stroke: '#3b82f6', radius: 24 });
    this.panel.active = false;
    parent.addChild(this.panel);
    this.build();
  }

  toggle(): void { this.panel.active = !this.panel.active; }

  private build(): void {
    const p = this.panel, dbg = this.dbg;
    makeLabel(p, 'Debug (this session only)', 34, '#ffffff', -40, 540, 520, { align: 'left' });
    makeButton(p, { w: 70, h: 56, x: 290, y: 540, text: 'X', fill: '#e11d48', textColor: '#ffffff', fontSize: 30, radius: 12 }, () => this.toggle());

    // Multiplier variant: tap to cycle, with a plain-language description under it.
    makeLabel(p, 'Multiplier variant', 28, '#ffe9b0', -150, 470, 380, { align: 'left' });
    const variant = makeButton(p, { w: 120, h: 56, x: 240, y: 470, text: '', fill: BTN_FILL, textColor: BTN_TEXT, fontSize: 30, radius: 12 }, () => { dbg.cycleVariant(); });
    const note = makeLabel(p, '', 21, '#cfc2b0', 0, 430, 620, { align: 'left', wrap: true, bold: false });

    // Number rows: label, value, and - / + buttons.
    const values = new Map<string, ReturnType<typeof makeLabel>>();
    DEBUG_FIELDS.forEach((f, i) => {
      const y = 215 - i * 64;
      makeLabel(p, f.label, 26, '#ffe9b0', -170, y, 340, { align: 'left' });
      values.set(f.field, makeLabel(p, '', 28, '#ffffff', 110, y, 140));
      makeButton(p, { w: 64, h: 50, x: 215, y, text: '-', fill: BTN_FILL, textColor: BTN_TEXT, fontSize: 30, radius: 10 }, () => { dbg.nudge(f.field, -1); });
      makeButton(p, { w: 64, h: 50, x: 290, y, text: '+', fill: BTN_FILL, textColor: BTN_TEXT, fontSize: 30, radius: 10 }, () => { dbg.nudge(f.field, 1); });
    });

    const btn = (text: string, x: number, y: number, w: number, onTap: () => void): void => {
      makeButton(p, { w, h: 56, x, y, text, fill: BTN_FILL, textColor: BTN_TEXT, fontSize: 24, radius: 12 }, onTap);
    };
    makeLabel(p, 'Force next round', 24, '#7dd3fc', 0, -125, 640);
    btn('Trigger free spins', -165, -180, 310, () => dbg.forceFreeSpins());
    btn('Buy bonus now', 165, -180, 310, () => { this.toggle(); void dbg.buyBonusNow(); });
    btn('Reset overrides', -165, -250, 310, () => dbg.clearOverrides());
    btn('Reset stats', 165, -250, 310, () => dbg.resetStats());

    makeLabel(p, 'Set balance', 24, '#7dd3fc', 0, -320, 640);
    [1_000, 10_000, 100_000].forEach((amount, i) => btn(amount.toLocaleString('en-US'), -210 + i * 210, -375, 190, () => { dbg.setBalance(amount); }));

    const stats = makeLabel(p, '', 24, '#ffffff', 0, -490, 620, { align: 'left', wrap: true, bold: false });
    const message = makeLabel(p, '', 22, '#9be28b', 0, -590, 640);

    dbg.config.subscribe(c => {
      variant.label.string = c.multiplier.variant;
      note.string = dbg.describeVariant(c);
      for (const f of DEBUG_FIELDS) values.get(f.field)!.string = String(Number(dbg.get(f.field).toFixed(2)));
    });
    dbg.stats.subscribe(s => {
      const rtp = dbg.sessionRtp();
      stats.string = `Rounds ${s.rounds}   Paid ${s.cost.toFixed(2)}   Won ${s.win.toFixed(2)}\nSession RTP ${rtp === undefined ? '-' : (rtp * 100).toFixed(2) + '%'}   Free-spin rounds ${s.freeSpinRounds}   Biggest ${s.biggestX.toFixed(1)}x`;
    });
    dbg.message.subscribe(m => { message.string = m.text; message.color = m.bad ? hexRed : hexGreen; });
  }
}

const hexRed = new Color(255, 107, 107, 255), hexGreen = new Color(155, 226, 139, 255);
