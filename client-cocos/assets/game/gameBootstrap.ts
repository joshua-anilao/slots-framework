import { PREVIEW } from 'cc/env';
import { Camera, Canvas, Color, Component, Director, Graphics, Layers, Node, ResolutionPolicy, UITransform, _decorator, director, view } from 'cc';
import { AssetLoader } from '../framework/assets/assetLoader';
import { CocosAssetBackend } from '../framework/assets/cocosAssetBackend';
import { AudioManager } from '../framework/audio/audioManager';
import { CocosAudioBackend, CocosKeyValueStore } from '../framework/audio/cocosAudio';
import { BoardView } from '../framework/board/boardView';
import { computeLayout } from '../framework/board/boardLayout';
import { CocosRoundPresenter } from '../framework/board/cocosRoundPresenter';
import { FxLayer } from '../framework/fx/fxLayer';
import { MultiplierBar } from '../framework/hud/multiplierBar';
import { TitleBar } from '../framework/hud/titleBar';
import { WinBox } from '../framework/hud/winBox';
import { Overlays } from '../framework/overlays/overlays';
import { ControlBar } from '../framework/hud/controlBar';
import { Modal } from '../framework/windows/modal';
import { openAutoSpinWindow } from '../framework/windows/autoSpinWindow';
import { LoadingScreen } from '../framework/screens/loadingScreen';
import { Marquee } from '../framework/hud/marquee';
import { WinnerNotice } from '../framework/hud/winnerNotice';
import { drawRoundRect } from '../framework/ui/uiKit';
import { openMenu } from '../framework/windows/menuWindows';
import { loadSettings } from '../framework/settings/playerSettings';
import { openBetWindow } from '../framework/windows/betWindow';
import { openBuyBonusWindow } from '../framework/windows/buyBonusWindow';
import { SymbolView } from '../framework/board/symbolView';
import { DebugPanel } from '../framework/debug/debugPanel';
import { createCocosGame } from '../framework/bootstrap/createCocosGame';
import { DebugController, STRINGS } from '../shared/game-logic/index';
import { ScreenManager } from '../framework/screens/screenManager';
import type { IScreenHost } from '../framework/screens/screenManager';
import { hex, makeButton, makeLabel, uiNode } from '../framework/ui/uiKit';
import { ASSET_GROUPS } from './assetManifest';
import { SFX } from './audioManifest';
import { FISHBALL_CARD_STYLE } from './boardStyle';
import { gameConfig } from './generated/gameConfig';

const { ccclass } = _decorator;
const DESIGN_W = 720, DESIGN_H = 1280;
/** Demo balance and an unfinished round survive a reload on this device (a server does this later). */
const BAL_KEY = 'slots.game001.balance';
const PENDING_KEY = 'slots.game001.pendingRound';
const money = (v: number): string => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Starts the game: builds the UI camera and canvas, loads the boot assets, creates the shared game with a
 * Cocos presenter, and shows the board with a spin button. The scene can stay empty: this component adds itself.
 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  /** One game per page: a second bootstrap (scene reload, hot reload) must not start a second game on top. */
  private static started = false;
  private paintBackground: (free: boolean) => void = () => undefined;

  async start(): Promise<void> {
    if (GameBootstrap.started) return;
    GameBootstrap.started = true;
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    // Debug panel: ?debug in the address, always inside the Creator editor preview, or five taps on the version text.
    const debug = params.has('debug') || PREVIEW;
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.SHOW_ALL);
    const root = this.buildCanvas();

    const background = uiNode('Background', DESIGN_W, DESIGN_H);
    const bg = background.addComponent(Graphics);
    // Radial glow like the prototype: dark edges (bg0), lighter middle (bg2). Free spins use the teal set.
    const paintBackground = (free: boolean): void => {
      const [edge, mid, core] = free ? ['#061a20', '#0f3b46', '#1b6070'] : ['#120a1f', '#241337', '#341c4f'];
      bg.clear();
      bg.fillColor = hex(edge); bg.rect(-DESIGN_W / 2, -DESIGN_H / 2, DESIGN_W, DESIGN_H); bg.fill();
      bg.fillColor = hex(mid); bg.ellipse(0, 130, 520, 760); bg.fill();
      bg.fillColor = hex(core); bg.ellipse(0, 200, 380, 520); bg.fill();
    };
    paintBackground(false);
    this.paintBackground = paintBackground;
    root.addChild(background);

    const status = makeLabel(root, 'Loading...', 40, '#f5c542', 0, 0);
    const gameLayer = uiNode('Game');
    gameLayer.active = false;
    root.addChild(gameLayer);
    const host: IScreenHost = {
      showScreen: s => { status.node.active = s !== 'game'; gameLayer.active = s === 'game'; if (s === 'error') status.string = 'Could not load. Reload the page.'; },
      openPopup: () => undefined,
      closePopup: () => undefined,
    };
    const screens = new ScreenManager(host);
    screens.go('start');

    const loader = new AssetLoader(new CocosAssetBackend(), ASSET_GROUPS);
    try {
      await loader.loadGroup('boot');
    } catch (e) {
      console.error(e);
      screens.go('failed');
      return;
    }

    // Audio: silent until the first tap; clips load after the first frame is up.
    const audioBackend = new CocosAudioBackend(root);
    const store = new CocosKeyValueStore();
    const audio = new AudioManager(audioBackend, store, SFX);
    const audioLoad = audioBackend.load().catch(e => console.warn('Sounds did not load', e));
    root.on(Node.EventType.TOUCH_START, () => audio.unlock());

    // Shared game (models, controllers, local services) with the Cocos presenter.
    const presenter = new CocosRoundPresenter();
    const savedBal = Number(store.get(BAL_KEY));
    const game = createCocosGame({ config: gameConfig, presenter, balance: Number.isFinite(savedBal) && savedBal > 0 ? savedBal : undefined, debug, seed: params.has('seed') ? Number(params.get('seed')) : undefined });

    // Board and HUD, laid out like the prototype (design space 720 x 1280, y up).
    const { reels, rows } = gameConfig.grid;
    const layout = computeLayout(reels, rows, 128, 150, 6);
    const title = new TitleBar(gameLayer, 'FISHBALL FIESTA', 0, 545);
    title.onModeChange = free => this.paintBackground(free);
    const mult = new MultiplierBar(gameLayer, () => gameConfig, 640);
    mult.node.setPosition(0, 419, 0);
    const board = new BoardView(gameLayer, reels, rows, layout, cell => new SymbolView(n => loader.frame(n), FISHBALL_CARD_STYLE, layout.cardW, layout.cardH, cell), gameConfig.freeSpins.scatterSymbol);
    board.node.setPosition(0, 62, 0);
    // A ready grid so the board is never empty before the first spin.
    const pool = gameConfig.symbols.filter(sym => sym.id !== gameConfig.wildSymbol && sym.id !== gameConfig.freeSpins.scatterSymbol).map(sym => sym.id);
    const initialGrid = Array.from({ length: reels }, () => Array.from({ length: rows }, () => ({ s: pool[Math.floor(Math.random() * pool.length)]!, g: false })));
    board.setGrid(initialGrid);
    const win = new WinBox(gameLayer, 0, -304);
    const fx = new FxLayer(gameLayer, DESIGN_W, DESIGN_H);
    const overlays = new Overlays(gameLayer);
    presenter.attach({ board, mult, win, title, overlays, fx }, () => gameConfig, (name, level) => { audio.play(name, level); });
    const { models, controllers, bus } = game;
    let versionTaps = 0;
    controllers.speed.set(loadSettings(store).speed);
    const modalHost = uiNode('Windows', DESIGN_W, DESIGN_H);
    const bar = new ControlBar(gameLayer, {
      onSpin: () => {
        if (Modal.isOpen) return;
        audio.play('click');
        if (models.autoSpin.active.value) { controllers.autoSpin.stop(); return; } // spin button is STOP during auto
        if (models.spin.isBusy) return;
        void controllers.spin.spinOnce();
      },
      onBet: () => openBetWindow(modalHost, game),
      // Tap AUTO = auto spin until stopped (stop conditions from the last options used); hold = options window.
      onAuto: () => {
        if (models.autoSpin.active.value) { controllers.autoSpin.stop(); return; }
        if (models.spin.isBusy || Modal.isOpen) return;
        void controllers.autoSpin.start(Infinity);
      },
      onAutoHold: () => {
        if (models.spin.isBusy || models.autoSpin.active.value) return;
        openAutoSpinWindow(modalHost, game, n => { void controllers.autoSpin.start(n); });
      },
      onTurbo: () => overlays.toast(STRINGS.speedToast[controllers.speed.cycle()]),
      onMenu: () => { if (!models.spin.isBusy && !models.autoSpin.active.value && !Modal.isOpen) openMenu({ host: modalHost, game, audio, store, frames: n => loader.frame(n), style: FISHBALL_CARD_STYLE }); },
      onBuy: () => {
        if (models.spin.isBusy || models.autoSpin.active.value) { overlays.toast(STRINGS.buyBusy); return; }
        openBuyBonusWindow(modalHost, game, () => { void controllers.buyBonus.buy(1); });
      },
      onSound: () => { audio.setMuted(!audio.muted.value); },
      onVersionTap: () => { if (++versionTaps >= 5 && !debug && typeof location !== 'undefined') location.search = '?debug'; },
    }, gameConfig.version);
    audio.muted.subscribe(m => bar.showSound(m));
    models.wallet.balance.subscribe(v => bar.setBalance(v));
    models.bet.index.subscribe(() => bar.setBet(models.bet.bet));
    models.spin.lastRoundId.subscribe(id => bar.setRoundId(id));
    const lock = (): void => bar.setState(models.spin.phase.value !== 'idle', models.autoSpin.active.value);
    models.spin.phase.subscribe(lock);
    models.autoSpin.active.subscribe(lock);
    models.speed.mode.subscribe(m => bar.showSpeed(m));
    game.services.config.config.subscribe(c => { bar.buyBonusVisible(c.buyBonus.enabled); });
    bus.on('insufficientFunds', () => { bar.shakeBet(); overlays.toast(STRINGS.insufficient); });
    bus.on('autoSpinStopped', e => { if (e.reason !== 'finished') overlays.toast(STRINGS.autoStopped[e.reason], 2400, true); });
    // Tap the board: spin when idle (same as the HTML prototype), jump to the result while a round plays.
    board.node.on(Node.EventType.TOUCH_END, () => {
      if (Modal.isOpen) return;
      if (models.spin.isBusy) { controllers.spin.skip(); return; }
      if (models.autoSpin.active.value) return;
      void controllers.spin.spinOnce();
    });

    // Winner notice over the multiplier bar, marquee along the top, connection strength and the offline strip.
    const winnerFeed = new WinnerNotice(gameLayer, game.services.winFeed,
      () => !Modal.isOpen && !presenterBusy() && models.spin.phase.value !== 'presenting' && !overlays.busy, debug, 0, 419);
    new Marquee(gameLayer, STRINGS.marquee, 614);
    void winnerFeed;
    const offline = uiNode('Offline', DESIGN_W, 70);
    offline.setPosition(0, 560, 0);
    drawRoundRect(offline.addComponent(Graphics), DESIGN_W, 70, { fill: '#b91c1c' });
    makeLabel(offline, STRINGS.offline, 24, '#ffffff', 0, 0, 680);
    offline.active = false;
    gameLayer.addChild(offline);
    models.connection.machine.state.subscribe(st => {
      const off = st === 'offline';
      if (off === offline.active) return;
      offline.active = off;
      if (off) bar.setBars(0); else overlays.toast(STRINGS.reconnected);
    });
    let sentAt = 0;
    bus.on('spinStarted', () => { sentAt = Date.now(); });
    bus.on('spinResolved', () => {
      const rtt = Date.now() - sentAt;
      models.connection.machine.send('restored');
      bar.setBars(rtt < 150 ? 3 : rtt < 400 ? 2 : 1);
    });
    bus.on('connectionLost', () => { models.connection.machine.send('lost'); bar.shakeBet(); });
    bus.on('spinFailed', e => overlays.toast(e.message, 3000));
    // Interrupted round: remember a round until it has been shown, so a reload can show it again.
    bus.on('spinResolved', e => {
      const r = e.result;
      const pending = { roundId: e.roundId, result: r, balanceAfter: e.balanceAfter, timestamp: Date.now(),
        balanceBefore: Math.round((e.balanceAfter - r.totalWin + r.cost) * 100) / 100 };
      store.set(PENDING_KEY, JSON.stringify(pending));
      store.set(BAL_KEY, String(e.balanceAfter));
    });
    bus.on('roundPresented', () => { store.set(PENDING_KEY, ''); store.set(BAL_KEY, String(game.services.wallet.peek())); });
    models.wallet.balance.subscribe(() => { if (!models.spin.isBusy) store.set(BAL_KEY, String(game.services.wallet.peek())); });
    gameLayer.addChild(modalHost); // windows sit above everything else on the game screen
    const presenterBusy = (): boolean => models.spin.isBusy || overlays.busy;

    // Loading screen with tutorial over the game; the game opens when it ends, then an unfinished round is shown again.
    screens.go('loaded');
    status.node.active = false;
    gameLayer.active = true;
    const loading = new LoadingScreen(root, gameConfig.name.toUpperCase(), gameConfig.volatilityRating ?? 3, store);
    const frame = (): Promise<void> => new Promise(r => setTimeout(r, 30));
    await loading.run([
      { label: 'symbols', run: frame },
      { label: 'sounds', run: () => audioLoad },
      { label: 'config', run: () => game.services.config.config.value },
    ], params.has('nointro'));
    audio.play('fsIntro');
    await board.reveal(initialGrid, 0.22, 0.045);
    const raw = store.get(PENDING_KEY);
    if (raw) {
      try {
        overlays.toast(STRINGS.resuming, 2500);
        void controllers.spin.resume(JSON.parse(raw));
      } catch { store.set(PENDING_KEY, ''); }
    }

    if (debug) {
      const debugController = new DebugController(game);
      new DebugPanel(root, debugController);
      (globalThis as unknown as { __ff: unknown }).__ff = {
        game, board, screens, audio, debug: debugController,
        snapshot: () => board.snapshot(),
        lastRound: undefined as unknown,
      };
      game.bus.on('spinResolved', e => { ((globalThis as unknown as { __ff: { lastRound: unknown } }).__ff).lastRound = e; });
    }
  }

  /** Creates the Canvas with its UI camera (and turns off any other camera the scene has). */
  private buildCanvas(): Node {
    const scene = director.getScene()!;
    for (const cam of scene.getComponentsInChildren(Camera)) cam.enabled = false;
    const canvasNode = uiNode('GameCanvas', DESIGN_W, DESIGN_H);
    scene.addChild(canvasNode);
    const canvas = canvasNode.addComponent(Canvas);
    const camNode = new Node('UiCamera');
    camNode.layer = Layers.Enum.UI_2D;
    canvasNode.addChild(camNode);
    camNode.setPosition(0, 0, 1000);
    const cam = camNode.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.orthoHeight = DESIGN_H / 2;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = new Color(18, 10, 31, 255);
    cam.visibility = Layers.Enum.UI_2D;
    canvas.cameraComponent = cam;
    canvasNode.getComponent(UITransform)!.setContentSize(DESIGN_W, DESIGN_H);
    return canvasNode;
  }
}

// The scene is empty, so the first launched scene gets a GameBootstrap added to it.
director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
  const scene = director.getScene();
  if (!scene || scene.getComponentInChildren(GameBootstrap)) return;
  const node = new Node('GameBootstrap');
  scene.addChild(node);
  node.addComponent(GameBootstrap);
});

