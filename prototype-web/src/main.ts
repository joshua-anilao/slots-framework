import { createLocalGame } from '@slots/game-logic';
import { audio } from './core/audio';
import type { GameConfig } from '@slots/math-core';
import gameJson from '../../games/game-001/game.json';
import { el } from './core/dom';
import { DebugPanel } from './debug/debugPanel';
import { STRINGS } from './strings';
import { PlaceholderTheme } from './theme/placeholderTheme';
import type { Theme } from './theme/theme';
import { FxLayer } from './views/fx';
import { HtmlRoundPresenter } from './views/htmlRoundPresenter';
import { HudView } from './views/hudView';
import { Overlays } from './views/overlays';
import { ReelsView } from './views/reelsView';
import { WinnerNotice } from './views/winnerNotice';
import { openAutoSpinWindow } from './windows/autoSpinWindow';
import { openBetWindow } from './windows/betWindow';
import { openBuyBonusWindow } from './windows/buyBonusWindow';
import { openMenu } from './windows/menuWindows';
import { buzz, loadSettings } from './core/settings';
import type { SpinResponse } from '@slots/game-logic';
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
const backdrop = el('div.backdrop');
stage.append(backdrop, screen);
function fit(): void {
  const k = Math.min(window.innerWidth / 720, window.innerHeight / 1280);
  screen.style.transform = `translate(-50%, -50%) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

// --- Views (V) wired to shared Models + Controllers (M + C) ---
const theme: Theme = new PlaceholderTheme();
if (theme.backdrop) { backdrop.style.backgroundImage = `url(${theme.backdrop})`; backdrop.classList.add('has-image'); }
const normalIds = config.symbols.filter(s => s.kind === 'normal').map(s => s.id);
const reels = new ReelsView(theme, config.grid.reels, config.grid.rows, normalIds, config.freeSpins.scatterSymbol);
const overlays = new Overlays();
let presenter!: HtmlRoundPresenter;
// Demo balance and an unfinished round survive a reload on this device (a server does this later).
const BAL_KEY = 'slots.game001.balance';
const PENDING_KEY = 'slots.game001.pendingRound';
const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* blocked */ } },
};
const savedBal = Number(store.get(BAL_KEY));
const game = createLocalGame({
  config,
  balance: Number.isFinite(savedBal) && savedBal > 0 ? savedBal : 10_000,
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
  // Tap AUTO = infinite auto spin straight away (stop conditions from the last options used).
  // Hold AUTO = options window. During auto spin, tapping AUTO stops it (Josh, 2026-11-09).
  onAuto: () => {
    if (models.autoSpin.active.value) { controllers.autoSpin.stop(); return; }
    if (models.spin.isBusy || Modal.isOpen) return;
    void controllers.autoSpin.start(Infinity);
  },
  onAutoHold: () => {
    if (models.spin.isBusy || models.autoSpin.active.value) return;
    openAutoSpinWindow(screen, game, n => { void controllers.autoSpin.start(n); });
  },
  onTurbo: () => overlays.toast(STRINGS.speedToast[controllers.speed.cycle()]),
  onSettings: () => { if (!models.spin.isBusy && !models.autoSpin.active.value) openMenu({ host: screen, game, theme, onSound: () => hud.showSound(audio.muted) }); },
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
bus.on('autoSpinStopped', e => { if (e.reason !== 'finished') overlays.toast(STRINGS.autoStopped[e.reason], 2400, true); });
game.services.config.config.subscribe(c => { hud.buyBtn.hidden = !c.buyBonus.enabled; });
// --- Interrupted round: remember a round until it has been shown, so a reload can show it again ---
bus.on('spinResolved', e => {
  const r = e.result;
  const pending: SpinResponse = {
    roundId: e.roundId, result: r, balanceAfter: e.balanceAfter, timestamp: Date.now(),
    balanceBefore: Math.round((e.balanceAfter - r.totalWin + r.cost) * 100) / 100,
  };
  store.set(PENDING_KEY, JSON.stringify(pending));
  store.set(BAL_KEY, String(e.balanceAfter));
});
models.wallet.balance.subscribe(() => { if (!models.spin.isBusy) store.set(BAL_KEY, String(game.services.wallet.peek())); });
bus.on('roundPresented', () => { store.set(PENDING_KEY, null); store.set(BAL_KEY, String(game.services.wallet.peek())); });

// --- Connection strength: bars from the measured round trip; offline strip when a request fails ---
const wifi = hud.footer.querySelector('.wifi') as HTMLElement;
const offlineBar = el('div.offline-bar', { text: STRINGS.offline });
screen.append(offlineBar);
let sentAt = 0;
const setBars = (n: 0 | 1 | 2 | 3) => { wifi.className = `wifi bars-${n}`; };
const setOffline = (off: boolean) => {
  if (off === offlineBar.classList.contains('show')) return;
  offlineBar.classList.toggle('show', off);
  if (off) setBars(0); else overlays.toast(STRINGS.reconnected);
};
bus.on('spinStarted', () => { sentAt = performance.now(); });
bus.on('spinResolved', () => {
  const rtt = performance.now() - sentAt;
  setOffline(false);
  setBars(rtt < 150 ? 3 : rtt < 400 ? 2 : 1);
});
bus.on('connectionLost', () => { setOffline(true); hud.shakeBet(); });
window.addEventListener('offline', () => setOffline(true));
window.addEventListener('online', () => setOffline(false));
if (navigator.onLine === false) setOffline(true);

// --- Haptics (Settings > Vibration) ---
bus.on('freeSpinsTriggered', () => buzz([40, 60, 40]));
bus.on('winTier', () => buzz(80));
controllers.speed.set(loadSettings().speed);

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

/**
 * Short intro after Continue (Josh, 2026-11-09): the frame fades in, header drops in,
 * controls rise, then the cards flip in one by one, column by column.
 */
async function playIntro(): Promise<void> {
  screen.classList.remove('pre-intro');
  const fade = (n: Element, from: string, delay: number, ms = 360) => n.animate(
    [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
    { duration: ms, delay, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
  fade(hud.top, 'translateY(-30px)', 0);
  fade(hud.header, 'translateY(-50px)', 80);
  fade(multWrap, 'translateY(-20px)', 180);
  fade(reelFrame, 'none', 120, 420);
  fade(hud.win.root, 'translateY(20px)', 260);
  fade(hud.controls, 'translateY(70px)', 320, 420);
  fade(hud.footer, 'translateY(30px)', 380);
  audio.play('fsIntro');
  await reels.reveal(220, 45, 380, () => audio.play('reelStop'));
}

// Boot budget (< 5 s): __bootMs = first frame of the loading screen.
// ?nointro skips the loading screen (automated tests); otherwise the game opens after Continue.
let loading = !params.has('nointro');
requestAnimationFrame(() => {
  const ms = Math.round(performance.now()); // since navigation start
  (window as unknown as { __bootMs: number }).__bootMs = ms;
  if (debug) console.info(`[boot] first frame in ${ms} ms`);
  const ready = async (intro: boolean) => {
    if (intro) await playIntro();
    loading = false;
    document.body.dataset.ready = '1';
    // A round that was cut off last time is shown again before anything else.
    const raw = store.get(PENDING_KEY);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as SpinResponse;
      overlays.toast(STRINGS.resuming, 2500);
      void controllers.spin.resume(pending);
    } catch { store.set(PENDING_KEY, null); }
  };
  if (!loading) { void ready(false); return; }
  screen.classList.add('pre-intro');
  const title = config.name.replace(/\s*\(.*\)\s*/, '').toUpperCase();
  const vol = (config as unknown as { volatilityRating?: number }).volatilityRating ?? 3;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  void new LoadingScreen(title, vol).run(screen, [
    { label: 'fonts', run: () => document.fonts?.ready },
    { label: 'symbols', run: frame },
    { label: 'sounds', run: frame },
    { label: 'config', run: () => game.services.config.config.value },
  ]).then(() => ready(true));
});
