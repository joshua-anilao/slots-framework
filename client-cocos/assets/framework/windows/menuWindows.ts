import { Graphics, Node } from 'cc';
import type { SpriteFrame } from 'cc';
import { STRINGS, money } from '../../shared/game-logic/index';
import type { HistoryEntry, LocalGame, SpeedMode } from '../../shared/game-logic/index';
import { buyPriceX, payScale } from '../../shared/math-core/index';
import type { Cell, GameConfig, RoundResult, SpinOutcome } from '../../shared/math-core/index';
import type { AudioManager, IKeyValueStore } from '../audio/audioManager';
import { SymbolView } from '../board/symbolView';
import type { ICardStyle } from '../board/symbolView';
import { loadSettings, saveSettings } from '../settings/playerSettings';
import { ScrollPanel } from '../ui/scrollPanel';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';
import { Modal } from './modal';

export interface MenuDeps {
  host: Node;
  game: LocalGame;
  audio: AudioManager;
  store: IKeyValueStore;
  frames: (name: string) => SpriteFrame;
  style: ICardStyle;
}

const PANEL_W = 680;
const TALL = 1100;

/** Rough height of wrapped text: Cocos only knows a label's real height a frame later. */
function textHeight(text: string, size: number, width: number): number {
  const perLine = Math.max(8, Math.floor(width / (size * 0.5)));
  const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
  return lines * Math.round(size * 1.3) + 8;
}

/** A tappable row (button-like) drawn as a rounded box. */
function rowBox(parent: Node, w: number, h: number, x: number, y: number, fill = '#352449', stroke = '#4a3a5c'): Node {
  const n = uiNode('Row', w, h);
  n.setPosition(x, y, 0);
  drawRoundRect(n.addComponent(Graphics), w, h, { fill, stroke, strokeWidth: 3, radius: 18 });
  parent.addChild(n);
  return n;
}

/** Menu: Settings, Game Rules, Bet History. */
export function openMenu(d: MenuDeps): void {
  const modal = new Modal(d.host, STRINGS.menu, { height: 520 }).open();
  const items: Array<[string, string, () => void]> = [
    ['⚙', STRINGS.settings, () => openSettings(d)],
    ['📖', STRINGS.rules, () => openRules(d)],
    ['🕘', STRINGS.history, () => openHistory(d)],
  ];
  items.forEach(([icon, label, open], i) => {
    const r = rowBox(modal.body, 600, 110, 0, modal.top - 30 - i * 134);
    makeLabel(r, icon, 40, '#f6efff', -240, 0, 70);
    makeLabel(r, label, 36, '#ffffff', -20, 0, 380, { align: 'left' });
    makeLabel(r, '›', 52, '#f5c542', 260, 0, 60);
    r.on(Node.EventType.TOUCH_END, open);
  });
}

// ---------------------------------------------------------------- Settings

function toggle(parent: Node, x: number, y: number, on: boolean, set: (v: boolean) => void): void {
  const n = uiNode('Toggle', 110, 56);
  n.setPosition(x, y, 0);
  const g = n.addComponent(Graphics);
  const knob = uiNode('Knob', 44, 44);
  const kg = knob.addComponent(Graphics);
  kg.fillColor = hex('#ffffff'); kg.circle(0, 0, 22); kg.fill();
  n.addChild(knob);
  const paint = (): void => {
    drawRoundRect(g, 110, 56, { fill: on ? '#34a853' : '#4a3f55', radius: 28 });
    knob.setPosition(on ? 28 : -28, 0, 0);
  };
  n.on(Node.EventType.TOUCH_END, () => { on = !on; paint(); set(on); });
  parent.addChild(n);
  paint();
}

export function openSettings(d: MenuDeps): void {
  const modal = new Modal(d.host, STRINGS.settings, { height: 760 }).open();
  const s = loadSettings(d.store);
  let y = modal.top - 30;
  const row = (label: string, on: boolean, set: (v: boolean) => void): void => {
    makeLabel(modal.body, label, 30, '#ffffff', -90, y, 400, { align: 'left' });
    toggle(modal.body, 240, y, on, set);
    y -= 110;
  };
  row(STRINGS.setSound, !d.audio.muted.value, v => d.audio.setMuted(!v));
  row(STRINGS.setIntro, !s.skipIntro, v => { s.skipIntro = !v; saveSettings(d.store, s); });
  makeLabel(modal.body, STRINGS.setSpeed, 26, '#f6efff', 0, y - 10, 600);
  const modes: SpeedMode[] = ['normal', 'turbo', 'super'];
  const cells: Array<{ g: Graphics; m: SpeedMode }> = [];
  modes.forEach((m, i) => {
    const c = uiNode('Seg', 190, 80);
    c.setPosition((i - 1) * 204, y - 90, 0);
    const g = c.addComponent(Graphics);
    makeLabel(c, STRINGS.speedName[m], 26, '#ffffff', 0, 0, 180);
    c.on(Node.EventType.TOUCH_END, () => { s.speed = m; saveSettings(d.store, s); d.game.controllers.speed.set(m); render(); });
    modal.body.addChild(c);
    cells.push({ g, m });
  });
  const render = (): void => cells.forEach(c => drawRoundRect(c.g, 190, 80, { fill: c.m === s.speed ? '#b8860b' : '#352449', stroke: c.m === s.speed ? '#f5c542' : '#4a3a5c', strokeWidth: 4, radius: 18 }));
  render();
}

// ---------------------------------------------------------------- Game rules

/** One mini card (a symbol on its card), used in the rules and the round detail. */
function miniCard(d: MenuDeps, parent: Node, cell: Cell, w: number, h: number, x: number, y: number): void {
  const v = new SymbolView(d.frames, d.style, w, h, cell);
  v.node.setPosition(x, y, 0);
  parent.addChild(v.node);
}

/** Everything here is generated from the game config, so a new game's rules write themselves. */
export function openRules(d: MenuDeps): void {
  const cfg: GameConfig = d.game.services.config.config.value;
  const bet = d.game.models.bet.bet;
  const scale = payScale(cfg);
  const modal = new Modal(d.host, STRINGS.rules, { height: TALL }).open();
  const sp = new ScrollPanel(modal.body, PANEL_W - 40, TALL - 140, 0, -50);
  const c = sp.content;
  const W = PANEL_W - 80;
  let y = -10;
  const head = (t: string): void => { y -= 14; makeLabel(c, t, 28, '#f5c542', 0, y - 18, W); y -= 50; };
  const para = (t: string): void => {
    const h = textHeight(t, 24, W);
    const l = makeLabel(c, t, 24, '#f6efff', 0, y, W, { wrap: true, bold: false, align: 'left' });
    l.node.setPosition(0, y, 0);
    y -= h + 8;
  };

  head(STRINGS.rulesPays(money(bet)));
  const symbols = cfg.symbols.filter(x => x.kind === 'normal');
  symbols.forEach((sym, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = col === 0 ? -170 : 170, yy = y - 60 - row * 120;
    miniCard(d, c, { s: sym.id, g: false }, 80, 94, x - 100, yy);
    const p = sym.pays ?? {};
    Object.keys(p).sort((a, b) => Number(b) - Number(a)).forEach((k, j) => {
      makeLabel(c, `${k}×  ${money(Math.round(p[k]! * scale * bet * 100) / 100)}`, 24, '#ffffff', x + 40, yy + 30 - j * 30, 190, { align: 'left' });
    });
  });
  y -= Math.ceil(symbols.length / 2) * 120 + 40;

  head(STRINGS.rulesWaysTitle);
  para(STRINGS.rulesWays(cfg.grid.reels, cfg.grid.rows, Math.pow(cfg.grid.rows, cfg.grid.reels)));
  head(STRINGS.rulesSymbolsTitle);
  miniCard(d, c, { s: 'WILD', g: false }, 70, 82, -W / 2 + 40, y - 40); y -= 90;
  para(STRINGS.rulesWild);
  miniCard(d, c, { s: 'SC', g: false }, 70, 82, -W / 2 + 40, y - 40); y -= 90;
  const fs = cfg.freeSpins;
  para(STRINGS.rulesScatter(fs.minScatters, fs.spins, fs.extraPerScatter));
  head(STRINGS.rulesGoldTitle);
  para(STRINGS.rulesGold(cfg.golden.reels.map(r => r + 1).join(', ')));
  head(STRINGS.rulesMultTitle);
  const m = cfg.multiplier;
  const ladder = (k: 'base' | 'free'): string => {
    if (m.variant === 'A' || m.variant === 'C') return m[m.variant][k].map(x => 'x' + x).join(' → ');
    if (m.variant === 'B') return STRINGS.multEndless(m.B[k].start, m.B[k].step);
    return STRINGS.multDouble(m.D.cap);
  };
  para(STRINGS.rulesMult(ladder('base'), ladder('free')));
  head(STRINGS.freeSpins);
  para(STRINGS.rulesFs(fs.retrigger, fs.maxTotalSpins));
  if (cfg.buyBonus.enabled) { head(STRINGS.buyTitle); para(STRINGS.rulesBuy(buyPriceX(cfg))); }
  head(STRINGS.rulesMoreTitle);
  para(STRINGS.rulesRtp((cfg.targets.rtp * 100).toFixed(2)));
  para(STRINGS.rulesMaxWin(cfg.maxWinX.toLocaleString('en-PH')));
  para(STRINGS.rulesMalfunction);
  makeLabel(c, `${cfg.id} v${cfg.version}`, 20, '#8f80ad', 0, y - 10, W, { bold: false });
  y -= 50;
  sp.setContentHeight(-y);
}

// ---------------------------------------------------------------- Bet history

const FILTERS: Array<{ label: string; ms?: number }> = [
  { label: '15 min', ms: 15 * 60_000 }, { label: '30 min', ms: 30 * 60_000 }, { label: '1 hour', ms: 60 * 60_000 }, { label: STRINGS.all },
];

const stamp = (ms: number): string => new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function openHistory(d: MenuDeps): void {
  const modal = new Modal(d.host, STRINGS.history, { height: TALL }).open();
  let filter = 3;
  const chipG: Graphics[] = [];
  FILTERS.forEach((f, i) => {
    const c = uiNode('Chip', 142, 64);
    c.setPosition((i - 1.5) * 152, modal.top - 20, 0);
    chipG.push(c.addComponent(Graphics));
    makeLabel(c, f.label, 24, '#ffffff', 0, 0, 136);
    c.on(Node.EventType.TOUCH_END, () => { filter = i; void render(); });
    modal.body.addChild(c);
  });
  const sumLeft = makeLabel(modal.body, '', 24, '#b9a8d6', -150, modal.top - 90, 300, { align: 'left' });
  const sumNet = makeLabel(modal.body, '', 26, '#ffffff', 190, modal.top - 90, 260, { align: 'right' });
  const sp = new ScrollPanel(modal.body, PANEL_W - 40, TALL - 330, 0, -50);
  makeLabel(modal.body, STRINGS.timezone(Intl.DateTimeFormat().resolvedOptions().timeZone), 20, '#8f80ad', 0, -TALL / 2 + 36, 600, { bold: false });

  const render = async (): Promise<void> => {
    chipG.forEach((g, i) => drawRoundRect(g, 142, 64, { fill: i === filter ? '#b8860b' : '#352449', stroke: i === filter ? '#f5c542' : '#4a3a5c', strokeWidth: 3, radius: 18 }));
    const rows = await d.game.services.history.query({ withinMs: FILTERS[filter]!.ms, limit: 200 });
    const net = rows.reduce((a, r) => a + r.net, 0);
    sumLeft.string = STRINGS.histCount(rows.length);
    sumNet.string = `${STRINGS.net} ${net >= 0 ? '+' : ''}${money(Math.round(net * 100) / 100)}`;
    sumNet.color = hex(net >= 0 ? '#6ee7a0' : '#ff8a8a');
    sp.content.removeAllChildren();
    sp.toTop();
    if (!rows.length) { makeLabel(sp.content, STRINGS.histEmpty, 28, '#8f80ad', 0, -80, 500, { bold: false }); sp.setContentHeight(0); return; }
    rows.forEach((r, i) => addRow(sp, r, i));
    sp.setContentHeight(rows.length * 126 + 10);
  };

  const addRow = (panel: ScrollPanel, r: HistoryEntry, i: number): void => {
    const row = rowBox(panel.content, PANEL_W - 80, 114, 0, -62 - i * 126);
    makeLabel(row, stamp(r.timestamp), 24, '#b9a8d6', -150, 30, 300, { align: 'left' });
    const net = makeLabel(row, `${r.net > 0 ? '+' : ''}${money(r.net)}`, 30, r.net > 0 ? '#6ee7a0' : r.net < 0 ? '#ff8a8a' : '#b9a8d6', 190, 30, 260, { align: 'right' });
    void net;
    makeLabel(row, `${STRINGS.bet} ${money(r.bet)} · ${STRINGS.win} ${money(r.win)}${r.buyBonus ? '  [BUY]' : ''}${r.freeSpins ? `  [FS ×${r.freeSpins}]` : ''}`, 22, '#ffffff', -20, -4, 560, { align: 'left' });
    makeLabel(row, `#${r.roundId}`, 18, '#8f80ad', -20, -34, 560, { align: 'left', bold: false });
    row.on(Node.EventType.TOUCH_END, () => { if (!panel.dragged) void openRound(d, r); });
  };
  void render();
}

/** Round detail: the landing grid of every spin in the round, with its cascades and win. */
async function openRound(d: MenuDeps, r: HistoryEntry): Promise<void> {
  const res = (await d.game.services.history.detail(r.roundId)) as RoundResult | null;
  const modal = new Modal(d.host, STRINGS.roundDetail, { height: TALL }).open();
  makeLabel(modal.body, `#${r.roundId}   ${stamp(r.timestamp)}`, 22, '#b9a8d6', 0, modal.top - 10, 620);
  makeLabel(modal.body, `${STRINGS.bet} ${money(r.bet)}  ·  ${STRINGS.cost} ${money(r.cost)}  ·  ${STRINGS.win} ${money(r.win)}`, 24, '#ffffff', 0, modal.top - 50, 620);
  if (!res) { makeLabel(modal.body, STRINGS.noDetail, 26, '#8f80ad', 0, 0, 560, { wrap: true, bold: false }); return; }
  const sp = new ScrollPanel(modal.body, PANEL_W - 40, TALL - 260, 0, -90);
  const spins: Array<[string, SpinOutcome]> = [];
  if (res.base) spins.push([STRINGS.baseSpin, res.base]);
  res.freeSpins?.spins.forEach((s, i) => spins.push([STRINGS.fsSpin(i + 1, res.freeSpins!.spins.length), s]));
  const c = sp.content;
  let y = -10;
  const cw = 56, ch = 66;
  for (const [label, s] of spins) {
    makeLabel(c, label, 26, '#f5c542', -150, y - 20, 320, { align: 'left' });
    makeLabel(c, money(s.spinWin), 26, s.spinWin > 0 ? '#6ee7a0' : '#8f80ad', 200, y - 20, 200, { align: 'right' });
    y -= 50;
    const grid = s.steps[0]?.grid;
    if (grid) {
      const gx = -(grid.length * (cw + 4)) / 2 + cw / 2;
      for (let row = 0; row < grid[0]!.length; row++) {
        grid.forEach((col, ci) => miniCard(d, c, col[row]!, cw, ch, gx + ci * (cw + 4), y - ch / 2 - row * (ch + 4)));
      }
      y -= grid[0]!.length * (ch + 4);
    }
    const wins = s.steps.filter(st => st.stepWin > 0);
    const lines = wins.length ? wins.map((st, k) => STRINGS.stepLine(k + 1, st.wins.length, st.multiplier, money(st.stepWin)))
      : [s.scatterCount >= 3 ? STRINGS.scattersLanded(s.scatterCount) : s === res.base && res.freeSpins ? STRINGS.fsForced : STRINGS.noWin];
    for (const line of lines) { makeLabel(c, line, 22, '#b9a8d6', 0, y - 14, 600, { bold: false }); y -= 30; }
    y -= 30;
  }
  sp.setContentHeight(-y);
}
