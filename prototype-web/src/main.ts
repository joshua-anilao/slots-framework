import { createLocalGame } from '@slots/game-logic';
import { audio } from './core/audio';
import type { GameConfig } from '@slots/math-core';
import gameJson from '../../games/game-001/game.json';
import { el } from './core/dom';
import { DebugPanel } from './debug/debugPanel';
import { STRINGS } from './strings';
import { PlaceholderTheme } from './theme/placeholderTheme';
import { FxLayer } from './views/fx';
import { HtmlRoundPresenter } from './views/htmlRoundPresenter';
import { HudView } from './views/hudView';
import { Overlays } from './views/overlays';
import { ReelsView } from './views/reelsView';
import { WinnerNotice } from './views/winnerNotice';
import { openAutoSpinWindow } from './windows/autoSpinWindow';
import { openBetWindow } from './windows/betWindow';
import { openBuyBonusWindow } from './windows/buyBonusWindow';
import { LoadingScreen } from './windows/loadingScreen';
import { Modal } from './windows/modal';
import './styles.css';

const config = gameJson as unknown as GameConfig;
const params = new URLSearchParams(location.search);
const debug = params.has('debug') || (window as unknown as { __PROTO_DEBUG?: boolean }).__PROTO_DEBUG === true;
const seedParam = params.get('seed');

// --- Stage: 720x1280 design, scaled to fit (portrait first; desktop shows it centred) ---
const stage = document.getElementById('stage')!;
const screen = el('div.screen');
stage.append(screen);
function fit(): void {
  const k = Math.min(window.innerWidth / 720, window.innerHeight / 1280);
  screen.style.transform = `translate(-50%, -50%) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

// --- Views (V) wired to shared Models + Controllers (M + C) ---
const theme = new PlaceholderTheme();
const normalIds = config.symbols.filter(s => s.kind === 'normal').map(s => s.id);
const reels = new ReelsView(theme, config.grid.reels, config.grid.rows, normalIds, config.freeSpins.scatterSymbol);
const overlays = new Overlays();
let presenter!: HtmlRoundPresenter;
const game = createLocalGame({
  config,
  balance: 10_000,
  debug,
  seed: seedParam ? Number(seedParam) : undefined,
  presenter: { present: (r, s) => presenter.present(r, s), skip: () => presenter.skip() },
});
const { controllers, models, bus } = game;

let versionTaps = 0;
let debugPanel: DebugPanel | null = null;
const hud = new HudView(game, {
  onSpin: () => spinOrSkip(),
  onBet: () => openBetWindow(screen, game),
  onAuto: () => {
    if (models.spin.isBusy || models.autoSpin.active.value) return;
    openAutoSpinWindow(screen, game, n => { void controllers.autoSpin.start(n); });
  },
  onTurbo: () => overlays.toast(STRINGS.speedToast[controllers.speed.cycle()]),
  onSettings: () => overlays.toast(STRINGS.comingSoon('Settings and game rules')),
  onBuy: () => {
    if (models.spin.isBusy || models.autoSpin.active.value) { overlays.toast(STRINGS.buyBusy); return; }
    openBuyBonusWindow(screen, game, () => { void controllers.buyBonus.buy(1); });
  },
  onVersionTap: () => { if (++versionTaps >= 5 && !debugPanel) location.search = '?debug=1'; },
  onSound: () => { audio.setMuted(!audio.muted); hud.showSound(audio.muted); },
}, config.version);
hud.showSound(audio.muted);
const fx = new FxLayer(screen);
presenter = new HtmlRoundPresenter(reels, hud, overlays, fx, () => game.services.config.config.value);

const reelFrame = el('div.reel-frame', {}, [reels.root]);
const winner = new WinnerNotice(game.services.winFeed,
  () => !document.body.classList.contains('fs') && models.spin.phase.value !== 'presenting' && !document.querySelector('.overlays .banner, .overlays .bigwin'), debug);
const multWrap = el('div.mult-wrap', {}, [hud.mult.root, winner.root]);
screen.append(hud.top, hud.header, multWrap, reelFrame, hud.win.root, hud.controls, hud.footer, fx.root, overlays.root);

function spinOrSkip(): void {
  if (Modal.isOpen) return;
  if (models.autoSpin.active.value) { controllers.autoSpin.stop(); return; } // spin button is STOP during auto
  if (models.spin.isBusy) return; // locked while the round animates
  void controllers.spin.spinOnce();
}

bus.on('insufficientFunds', () => { hud.shakeBet(); overlays.toast(STRINGS.insufficient); });
bus.on('autoSpinStopped', e => { if (e.reason !== 'finished') overlays.toast(STRINGS.autoStopped[e.reason]); });
game.services.config.config.subscribe(c => { hud.buyBtn.hidden = !c.buyBonus.enabled; });
bus.on('spinFailed', e => overlays.toast(e.message, 3000));
game.services.config.config.subscribe(() => hud.mult.mode(document.body.classList.contains('fs')));

// Sound needs a first tap (browser rule); every button press clicks within 50 ms (design guide).
const touchLayer = el('div.touch-layer');
screen.append(touchLayer);
window.addEventListener('pointerdown', e => {
  audio.unlock();
  fx.touch(e.clientX, e.clientY, touchLayer);
  if ((e.target as Element).closest('button')) audio.play('click');
}, true);

// Tap the reels or press Space to spin / stop.
// Tap the board to spin. Taps while a round is animating are ignored (Josh, 2026-11-09).
reelFrame.addEventListener('pointerdown', () => {
  if (Modal.isOpen || models.spin.isBusy || models.autoSpin.active.value || loading) return;
  void controllers.spin.spinOnce();
});
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !loading) { e.preventDefault(); audio.unlock(); spinOrSkip(); }
});

if (debug) {
  debugPanel = new DebugPanel(screen, game, reels);
  debugPanel.mount();
  (window as unknown as { __game: unknown }).__game = game;
}

// Boot budget (< 5 s): __bootMs = first frame of the loading screen.
// ?nointro skips the loading screen (automated tests); otherwise the game opens after Continue.
let loading = !params.has('nointro');
requestAnimationFrame(() => {
  const ms = Math.round(performance.now()); // since navigation start
  (window as unknown as { __bootMs: number }).__bootMs = ms;
  if (debug) console.info(`[boot] first frame in ${ms} ms`);
  const ready = () => { loading = false; document.body.dataset.ready = '1'; };
  if (!loading) { ready(); return; }
  const title = config.name.replace(/\s*\(.*\)\s*/, '').toUpperCase();
  const vol = (config as unknown as { volatilityRating?: number }).volatilityRating ?? 3;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  void new LoadingScreen(title, vol).run(screen, [
    { label: 'fonts', run: () => document.fonts?.ready },
    { label: 'symbols', run: frame },
    { label: 'sounds', run: frame },
    { label: 'config', run: () => game.services.config.config.value },
  ]).then(ready);
});
