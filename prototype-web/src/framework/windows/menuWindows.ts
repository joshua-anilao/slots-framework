import type { HistoryEntry, LocalGame, SpeedMode } from '@slots/game-logic';
import type { Cell, GameConfig, RoundResult, SpinOutcome } from '@slots/math-core';
import { audio } from '../core/audio';
import { el } from '../core/dom';
import { loadSettings, saveSettings } from '../core/settings';
import { money, STRINGS } from '../strings';
import type { Theme } from '../theme/theme';
import { readSkip, writeSkip } from './loadingScreen';
import { Modal } from './modal';

export interface MenuDeps {
  host: HTMLElement;
  game: LocalGame;
  theme: Theme;
  /** Called after the sound toggle so the footer icon follows. */
  onSound: () => void;
}

/** Menu (feature 18 + 16): Settings, Game Rules, Bet History. */
export function openMenu(d: MenuDeps): void {
  const modal = new Modal(d.host, STRINGS.menu).open();
  const item = (icon: string, label: string, open: () => void) =>
    el('button.menu-item', { onclick: open }, [el('span.mi-ic', { text: icon }), el('span', { text: label }), el('span.mi-go', { text: '›' })]);
  modal.body.append(
    item('⚙', STRINGS.settings, () => openSettings(d)),
    item('📖', STRINGS.rules, () => openRules(d)),
    item('🕘', STRINGS.history, () => openHistory(d)),
  );
}

// ---------------------------------------------------------------- Settings

function toggle(on: boolean, set: (v: boolean) => void): HTMLElement {
  const t = el(`button.toggle${on ? '.on' : ''}`, { 'aria-pressed': String(on) }, [el('span.knob')]);
  t.addEventListener('click', () => {
    const v = !t.classList.contains('on');
    t.classList.toggle('on', v);
    t.setAttribute('aria-pressed', String(v));
    set(v);
  });
  return t;
}

export function openSettings(d: MenuDeps): void {
  const modal = new Modal(d.host, STRINGS.settings).open();
  const s = loadSettings();
  const row = (label: string, control: HTMLElement, note?: string) =>
    el('div.set-row', {}, [el('div', {}, [el('div.set-label', { text: label }), ...(note ? [el('div.set-note', { text: note })] : [])]), control]);
  const speeds = el('div.seg');
  const renderSpeeds = () => speeds.replaceChildren(...(['normal', 'turbo', 'super'] as SpeedMode[]).map(m =>
    el(`button.seg-opt${s.speed === m ? '.on' : ''}`, {
      text: STRINGS.speedName[m], onclick: () => { s.speed = m; saveSettings(s); d.game.controllers.speed.set(m); renderSpeeds(); },
    })));
  renderSpeeds();
  modal.body.append(
    row(STRINGS.setSound, toggle(!audio.muted, v => { audio.setMuted(!v); d.onSound(); })),
    row(STRINGS.setHaptics, toggle(s.haptics, v => { s.haptics = v; saveSettings(s); if (v) navigator.vibrate?.(20); }), STRINGS.setHapticsNote),
    row(STRINGS.setIntro, toggle(!readSkip(), v => writeSkip(!v))),
    el('div.set-label.set-block', { text: STRINGS.setSpeed }), speeds,
  );
}

// ---------------------------------------------------------------- Game rules

/** Everything here is generated from the game config, so a new game's rules write themselves. */
export function openRules(d: MenuDeps): void {
  const cfg: GameConfig = d.game.services.config.config.value;
  const bet = d.game.models.bet.bet;
  const modal = new Modal(d.host, STRINGS.rules).open();
  modal.root.classList.add('tall');
  const pays = el('div.pay-grid');
  for (const sym of cfg.symbols.filter(x => x.kind === 'normal')) {
    const p = sym.pays ?? {};
    pays.append(el('div.pay-card', {}, [
      mini({ s: sym.id, g: false }, d.theme),
      el('div.pay-lines', {}, Object.keys(p).sort((a, b) => Number(b) - Number(a)).map(k =>
        el('div', {}, [el('b', { text: `${k}× ` }), el('span', { text: money(Math.round(p[k] * bet * 100) / 100) })]))),
    ]));
  }
  // Multiplier text follows whichever variant is live (debug can switch it).
  const m = cfg.multiplier;
  const ladder = (k: 'base' | 'free'): string => {
    if (m.variant === 'A' || m.variant === 'C') return m[m.variant][k].map(x => 'x' + x).join(' → ');
    if (m.variant === 'B') return STRINGS.multEndless(m.B[k].start, m.B[k].step);
    return STRINGS.multDouble(m.D.cap);
  };
  const fs = cfg.freeSpins;
  const goldReels = cfg.golden.reels.map(r => r + 1).join(', ');
  const section = (title: string, ...lines: (string | Node)[]) =>
    el('div.rule', {}, [el('div.rule-head', { text: title }), ...lines.map(l => (typeof l === 'string' ? el('p', { text: l }) : l))]);
  modal.body.append(
    section(STRINGS.rulesPays(money(bet)), pays),
    section(STRINGS.rulesWaysTitle, STRINGS.rulesWays(cfg.grid.reels, cfg.grid.rows, Math.pow(cfg.grid.rows, cfg.grid.reels))),
    section(STRINGS.rulesSymbolsTitle, mini({ s: 'WILD', g: false }, d.theme, 'inline'), STRINGS.rulesWild,
      mini({ s: 'SC', g: false }, d.theme, 'inline'), STRINGS.rulesScatter(fs.minScatters, fs.spins, fs.extraPerScatter)),
    section(STRINGS.rulesGoldTitle, STRINGS.rulesGold(goldReels)),
    section(STRINGS.rulesMultTitle, STRINGS.rulesMult(ladder('base'), ladder('free'))),
    section(STRINGS.freeSpins, STRINGS.rulesFs(fs.retrigger, fs.maxTotalSpins)),
    ...(cfg.buyBonus.enabled ? [section(STRINGS.buyTitle, STRINGS.rulesBuy(cfg.buyBonus.priceX))] : []),
    section(STRINGS.rulesMoreTitle,
      STRINGS.rulesRtp((cfg.targets.rtp * 100).toFixed(2)),
      STRINGS.rulesMaxWin(cfg.maxWinX.toLocaleString('en-PH')),
      STRINGS.rulesMalfunction),
    el('div.rule-ver', { text: `${cfg.id} v${cfg.version}` }),
  );
}

function mini(cell: Cell, theme: Theme, cls = ''): HTMLElement {
  return el(`div.mini-cell${cls ? '.' + cls : ''}`, {}, [theme.symbol(cell)]);
}

// ---------------------------------------------------------------- Bet history

const FILTERS: { label: string; ms?: number }[] = [
  { label: '15 min', ms: 15 * 60_000 }, { label: '30 min', ms: 30 * 60_000 }, { label: '1 hour', ms: 60 * 60_000 }, { label: STRINGS.all },
];

export function openHistory(d: MenuDeps): void {
  const modal = new Modal(d.host, STRINGS.history).open();
  modal.root.classList.add('tall');
  let filter = 3;
  let search = '';
  const chips = el('div.chips.hist-chips');
  const list = el('div.hist-list');
  const summary = el('div.hist-sum');
  const input = el('input.hist-search', { type: 'search', placeholder: STRINGS.searchRound, inputmode: 'numeric' }) as HTMLInputElement;
  input.addEventListener('input', () => { search = input.value.trim(); void render(); });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = (ms: number) => new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const render = async () => {
    chips.replaceChildren(...FILTERS.map((f, i) => el(`button.chip${i === filter ? '.on' : ''}`, { text: f.label, onclick: () => { filter = i; void render(); } })));
    const rows = await d.game.services.history.query({ withinMs: FILTERS[filter].ms, roundId: search || undefined, limit: 200 });
    const net = rows.reduce((a, r) => a + r.net, 0);
    summary.replaceChildren(
      el('span', { text: STRINGS.histCount(rows.length) }),
      el(`span.${net >= 0 ? 'pos' : 'neg'}`, { text: `${STRINGS.net} ${net >= 0 ? '+' : ''}${money(Math.round(net * 100) / 100)}` }));
    list.replaceChildren(...(rows.length ? rows.map(r => row(r)) : [el('div.hist-empty', { text: STRINGS.histEmpty })]));
  };
  const row = (r: HistoryEntry) => el('button.hist-row', { onclick: () => void openRound(d, r) }, [
    el('div.hr-top', {}, [
      el('span.hr-time', { text: time(r.timestamp) }),
      el(`span.hr-net.${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : 'zero'}`, { text: `${r.net > 0 ? '+' : ''}${money(r.net)}` }),
    ]),
    el('div.hr-bot', {}, [
      el('span', { text: `${STRINGS.bet} ${money(r.bet)} · ${STRINGS.win} ${money(r.win)}` }),
      ...(r.buyBonus ? [el('span.tag', { text: 'BUY' })] : []),
      ...(r.freeSpins ? [el('span.tag.fs', { text: `FS ×${r.freeSpins}` })] : []),
    ]),
    el('div.hr-id', { text: `#${r.roundId}` }),
  ]);
  modal.body.append(chips, input, summary, list, el('div.hist-tz', { text: STRINGS.timezone(tz) }));
  void render();
}

/** Round detail: the landing grid of every spin in the round, with its cascades and win. */
async function openRound(d: MenuDeps, r: HistoryEntry): Promise<void> {
  const res = (await d.game.services.history.detail(r.roundId)) as RoundResult | null;
  const modal = new Modal(d.host, STRINGS.roundDetail).open();
  modal.root.classList.add('tall');
  modal.body.append(
    el('div.rd-head', {}, [
      el('div', { text: `#${r.roundId}` }),
      el('div', { text: new Date(r.timestamp).toLocaleString('en-PH') }),
      el('div', {}, [el('span', { text: `${STRINGS.bet} ${money(r.bet)}  ·  ${STRINGS.cost} ${money(r.cost)}  ·  ` }), el('b', { text: `${STRINGS.win} ${money(r.win)}` })]),
    ]),
  );
  if (!res) { modal.body.append(el('div.hist-empty', { text: STRINGS.noDetail })); return; }
  const spins: [string, SpinOutcome][] = [];
  if (res.base) spins.push([STRINGS.baseSpin, res.base]);
  res.freeSpins?.spins.forEach((s, i) => spins.push([STRINGS.fsSpin(i + 1, res.freeSpins!.spins.length), s]));
  for (const [label, s] of spins) {
    const grid = s.steps[0]?.grid;
    const g = el('div.rd-grid');
    if (grid) for (let row = 0; row < grid[0].length; row++) for (const col of grid) g.append(mini(col[row], d.theme));
    const wins = s.steps.filter(st => st.stepWin > 0);
    modal.body.append(el('div.rd-spin', {}, [
      el('div.rd-label', {}, [el('span', { text: label }), el(`b.${s.spinWin > 0 ? 'pos' : 'zero'}`, { text: money(s.spinWin) })]),
      g,
      el('div.rd-steps', {}, wins.length
        ? wins.map((st, k) => el('div', { text: STRINGS.stepLine(k + 1, st.wins.length, st.multiplier, money(st.stepWin)) }))
        : [el('div', { text: s.scatterCount >= 3 ? STRINGS.scattersLanded(s.scatterCount)
          : s === res.base && res.freeSpins ? STRINGS.fsForced : STRINGS.noWin })]),
    ]));
  }
}
