import { Camera, Canvas, Color, Component, Director, Graphics, Layers, Node, ResolutionPolicy, UITransform, _decorator, director, view } from 'cc';
import { AssetLoader } from '../framework/assets/assetLoader';
import { CocosAssetBackend } from '../framework/assets/cocosAssetBackend';
import { AudioManager } from '../framework/audio/audioManager';
import { CocosAudioBackend, CocosKeyValueStore } from '../framework/audio/cocosAudio';
import { BoardView } from '../framework/board/boardView';
import { computeLayout } from '../framework/board/boardLayout';
import { CocosRoundPresenter } from '../framework/board/cocosRoundPresenter';
import type { IRoundHud } from '../framework/board/cocosRoundPresenter';
import { SymbolView } from '../framework/board/symbolView';
import { DebugPanel } from '../framework/debug/debugPanel';
import { createCocosGame } from '../framework/bootstrap/createCocosGame';
import { DebugController } from '../shared/game-logic/index';
import { ScreenManager } from '../framework/screens/screenManager';
import type { IScreenHost } from '../framework/screens/screenManager';
import { hex, makeButton, makeLabel, uiNode } from '../framework/ui/uiKit';
import { ASSET_GROUPS } from './assetManifest';
import { SFX } from './audioManifest';
import { BOARD_GAP, BOARD_MAX_WIDTH, FISHBALL_CARD_STYLE, NORMAL_TIMING } from './boardStyle';
import { gameConfig } from './generated/gameConfig';

const { ccclass } = _decorator;
const DESIGN_W = 720, DESIGN_H = 1280;
const money = (v: number): string => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Starts the game: builds the UI camera and canvas, loads the boot assets, creates the shared game with a
 * Cocos presenter, and shows the board with a spin button. The scene can stay empty: this component adds itself.
 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  async start(): Promise<void> {
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    const debug = params.has('debug');
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.SHOW_ALL);
    const root = this.buildCanvas();

    const background = uiNode('Background', DESIGN_W, DESIGN_H);
    const bg = background.addComponent(Graphics);
    bg.fillColor = hex('#2a1810');
    bg.rect(-DESIGN_W / 2, -DESIGN_H / 2, DESIGN_W, DESIGN_H);
    bg.fill();
    root.addChild(background);

    const status = makeLabel(root, 'Loading...', 40, '#ffd36b', 0, 0);
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
    const audio = new AudioManager(audioBackend, new CocosKeyValueStore(), SFX);
    void audioBackend.load().catch(e => console.warn('Sounds did not load', e));
    root.on(Node.EventType.TOUCH_START, () => audio.unlock());

    // Shared game (models, controllers, local services) with the Cocos presenter.
    const presenter = new CocosRoundPresenter();
    const game = createCocosGame({ config: gameConfig, presenter, debug, seed: params.has('seed') ? Number(params.get('seed')) : undefined });

    // Board.
    const { reels, rows } = gameConfig.grid;
    const layout = computeLayout(reels, rows, BOARD_MAX_WIDTH, BOARD_GAP);
    const board = new BoardView(gameLayer, reels, rows, layout, cell => new SymbolView(n => loader.frame(n), FISHBALL_CARD_STYLE, layout.card, cell), NORMAL_TIMING);
    board.node.setPosition(0, 130, 0);

    // HUD.
    makeLabel(gameLayer, 'FISHBALL FIESTA', 56, '#ffd36b', 0, 560);
    const multLabel = makeLabel(gameLayer, '', 36, '#ffffff', 0, 450);
    const statusLine = makeLabel(gameLayer, '', 34, '#ffffff', 0, 400);
    const winLabel = makeLabel(gameLayer, 'WIN 0.00', 44, '#ffffff', 0, -200);
    const balanceLabel = makeLabel(gameLayer, '', 36, '#ffe9b0', 0, -270);
    const betLabel = makeLabel(gameLayer, '', 36, '#ffe9b0', 0, -340);
    const hud: IRoundHud = {
      setWin: v => { winLabel.string = `WIN ${money(v)}`; },
      setMultiplier: m => { multLabel.string = m > 1 ? `x${m}` : ''; },
      setStatus: t => { statusLine.string = t; },
    };
    presenter.attach(board, hud, (name, level) => { audio.play(name, level); });
    game.models.wallet.balance.subscribe(v => { balanceLabel.string = `BALANCE ${money(v)}`; });
    game.models.bet.index.subscribe(() => { betLabel.string = `BET ${money(game.models.bet.bet)}`; });

    // Bet buttons loop around: past the highest goes to the lowest, and the other way.
    const last = game.models.bet.levels.length - 1;
    makeButton(gameLayer, { w: 90, h: 70, x: -230, y: -340, text: '-', fill: '#f2b705', textColor: '#3a1f12' }, () => {
      if (!game.controllers.bet.decrease()) game.controllers.bet.select(last);
    });
    makeButton(gameLayer, { w: 90, h: 70, x: 230, y: -340, text: '+', fill: '#f2b705', textColor: '#3a1f12' }, () => {
      if (!game.controllers.bet.increase()) game.controllers.bet.select(0);
    });
    const spin = makeButton(gameLayer, { w: 260, h: 120, x: 0, y: -470, text: 'SPIN', fill: '#e11d48', textColor: '#ffffff', fontSize: 56, radius: 60 }, () => {
      audio.play('click');
      if (game.models.spin.isBusy) game.controllers.spin.skip();
      else void game.controllers.spin.spinOnce();
    });
    void spin;

    // First frame: the board shows a ready grid so the screen is never empty.
    screens.go('loaded');

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
    cam.clearColor = new Color(42, 24, 16, 255);
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

