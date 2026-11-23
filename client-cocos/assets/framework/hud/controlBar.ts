import { Color, Graphics, Label, Node, Tween, UIOpacity, tween } from 'cc';
import { STRINGS, money } from '../../shared/game-logic/index';
import type { SpeedMode } from '../../shared/game-logic/index';
import { GlowPulse, addGlow, setGlow } from '../ui/glow';
import { GLOW_STYLE } from '../ui/glowStyle';
import type { GlowSpec } from '../ui/glowStyle';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

/** Control button size and corner radius, Buy Bonus size, SPIN disc radius (px). */
const CTL_SIZE = 104;
const CTL_RADIUS = 22;
const BUY_W = 96;
const BUY_H = 86;
const BUY_RADIUS = 16;
const SPIN_RADIUS = 88;

/** A square control button: icon on top, small label below. */
class ControlButton {
  readonly node: Node;
  readonly icon: Label;
  readonly label: Label;
  private readonly g: Graphics;
  private readonly fade: UIOpacity;
  private readonly glow: Node;
  private on = false;
  private accent = '#f5c542';
  enabled = true;

  constructor(parent: Node, x: number, y: number, icon: string, label: string) {
    this.node = uiNode('Ctl', CTL_SIZE, CTL_SIZE);
    this.node.setPosition(x, y, 0);
    this.g = this.node.addComponent(Graphics);
    this.fade = this.node.addComponent(UIOpacity);
    this.glow = addGlow(this.node, 'Glow', CTL_SIZE, CTL_SIZE, CTL_RADIUS, {});
    this.glow.active = false;
    this.icon = makeLabel(this.node, icon, 40, '#ffffff', 0, 16, 100);
    this.label = makeLabel(this.node, label, 20, '#b9a8d6', 0, -28, 100);
    parent.addChild(this.node);
    this.paint();
  }

  /** Soft glow around the button, or none. */
  setGlow(glow: GlowSpec | undefined): void { setGlow(this.glow, CTL_SIZE, CTL_SIZE, CTL_RADIUS, glow); }
  setEnabled(v: boolean): void { this.enabled = v; this.fade.opacity = v ? 255 : 115; }
  setOn(v: boolean, accent = '#f5c542'): void { this.on = v; this.accent = accent; this.paint(); this.icon.color = hex(v ? accent : '#f6efff'); this.label.color = hex(v ? accent : '#b9a8d6'); }
  private paint(): void {
    drawRoundRect(this.g, CTL_SIZE, CTL_SIZE, { fill: '#352449', stroke: this.on ? this.accent : '#4a3a5c', strokeWidth: this.on ? 4 : 3, radius: CTL_RADIUS });
  }
  onTap(fn: () => void): void { this.node.on(Node.EventType.TOUCH_END, () => { if (this.enabled) fn(); }); }
}

export interface ControlHandlers {
  onSpin(): void;
  onBet(): void;
  onAuto(): void;
  onAutoHold(): void;
  onTurbo(): void;
  onMenu(): void;
  onBuy(): void;
  onSound(): void;
  /** The version text was tapped (five taps turn on the debug panel). */
  onVersionTap(): void;
}

/** How long AUTO must be held to open the options. */
const HOLD_SECONDS = 0.5;
/** One turn of the spin icon: idle, or while a round plays at each speed (seconds). */
const IDLE_TURN = 7.1;
const ACTIVE_TURN: Record<SpeedMode, number> = { normal: 0.81, turbo: 0.49, super: 0.24 };

/**
 * Everything the player taps around the reels: MENU, BET, the big SPIN button, AUTO (tap = start, hold = options,
 * tap while running = stop), TURBO, Buy Bonus in the header, and the footer with balance, sound, connection bars and version.
 * Only draws state and reports taps; the game wires the handlers to the shared controllers.
 */
export class ControlBar {
  readonly node: Node;
  readonly menuBtn: ControlButton;
  readonly betBtn: ControlButton;
  readonly autoBtn: ControlButton;
  readonly turboBtn: ControlButton;
  private readonly spinNode: Node;
  private readonly spinIcon: Node;
  private readonly spinFade: UIOpacity;
  private readonly spinPulse: GlowPulse;
  private readonly spinSteady: Node;
  private readonly spinStop: Label;
  private readonly buyNode: Node;
  private readonly buyFade: UIOpacity;
  private readonly balance: Label;
  private readonly roundId: Label;
  private readonly sound: Label;
  private readonly bars: Graphics;
  private speed: SpeedMode = 'normal';
  private spinning = false;
  private spinEnabled = true;
  private breathing = true;
  private buyEnabled = true;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private held = false;
  private autoRunning = false;

  constructor(parent: Node, private readonly h: ControlHandlers, version: string) {
    this.node = uiNode('Controls', 720, 1280);
    parent.addChild(this.node);
    const cy = -464;

    // Buy Bonus: top right, next to the title.
    this.buyNode = uiNode('BuyBonus', BUY_W, BUY_H);
    this.buyNode.setPosition(290, 523, 0);
    const buyG = this.buyNode.addComponent(Graphics);
    const buy = GLOW_STYLE.buy;
    // Dark bottom edge first, then the face on top of it.
    buyG.fillColor = hex(buy.edge.color);
    buyG.roundRect(-BUY_W / 2, -BUY_H / 2 - buy.edge.width, BUY_W, BUY_H, BUY_RADIUS);
    buyG.fill();
    buyG.fillColor = hex('#f5c542');
    buyG.strokeColor = hex('#8a5a00');
    buyG.lineWidth = 4;
    buyG.roundRect(-BUY_W / 2, -BUY_H / 2, BUY_W, BUY_H, BUY_RADIUS);
    buyG.fill();
    buyG.stroke();
    addGlow(this.buyNode, 'Glow', BUY_W, BUY_H, BUY_RADIUS, { glow: buy.glow });
    this.buyFade = this.buyNode.addComponent(UIOpacity);
    makeLabel(this.buyNode, STRINGS.buyBonus, 22, '#3a1f12', 0, 0, BUY_W - 4, { wrap: false });
    this.buyNode.on(Node.EventType.TOUCH_END, () => { if (this.buyEnabled) h.onBuy(); });
    this.node.addChild(this.buyNode);

    this.menuBtn = new ControlButton(this.node, -280, cy, '☰', STRINGS.menu);
    this.betBtn = new ControlButton(this.node, -160, cy, '', STRINGS.bet);
    this.betBtn.label.node.setPosition(0, 22, 0);
    this.betBtn.icon.node.setPosition(0, -12, 0);
    this.betBtn.icon.fontSize = 26;
    this.autoBtn = new ControlButton(this.node, 160, cy, '↻', STRINGS.auto);
    this.turboBtn = new ControlButton(this.node, 280, cy, '▷', 'NORMAL');
    this.menuBtn.onTap(() => h.onMenu());
    this.betBtn.onTap(() => h.onBet());
    this.turboBtn.onTap(() => h.onTurbo());
    this.holdable(this.autoBtn);

    // Big SPIN button: gold disc with a ring and two chasing arrows.
    this.spinNode = uiNode('Spin', 184, 184);
    this.spinNode.setPosition(0, cy, 0);
    const sg = this.spinNode.addComponent(Graphics);
    sg.fillColor = hex('#6b4300'); sg.circle(0, -6, SPIN_RADIUS); sg.fill();
    sg.fillColor = hex('#f5c542'); sg.circle(0, 0, SPIN_RADIUS); sg.fill();
    sg.fillColor = hex('#ffd96b'); sg.circle(0, 6, 74); sg.fill();
    sg.strokeColor = hex('#3b2300'); sg.lineWidth = 5; sg.circle(0, 0, SPIN_RADIUS); sg.stroke();
    this.spinFade = this.spinNode.addComponent(UIOpacity);
    // Breathing glow (rest <-> peak) while SPIN can be tapped, a steady one while it is locked.
    const spinGlow = GLOW_STYLE.spin;
    const spinSize = SPIN_RADIUS * 2;
    this.spinPulse = new GlowPulse(this.spinNode, 'SpinGlow', spinSize, spinSize, SPIN_RADIUS, { glow: spinGlow.rest }, { glow: spinGlow.peak });
    this.spinSteady = addGlow(this.spinNode, 'SpinGlowLocked', spinSize, spinSize, SPIN_RADIUS, { glow: spinGlow.disabled });
    this.spinSteady.active = false;
    this.spinPulse.start(spinGlow.periodSec, 'sineInOut');
    this.spinIcon = uiNode('Arrows', 104, 104);
    const ag = this.spinIcon.addComponent(Graphics);
    ag.strokeColor = hex('#3b2300'); ag.fillColor = hex('#3b2300'); ag.lineWidth = 12; ag.lineCap = Graphics.LineCap.ROUND;
    for (const turn of [0, Math.PI]) {
      const a0 = turn + 0.35, a1 = turn + 2.55, r = 36;
      ag.arc(0, 0, r, a0, a1, true);
      ag.stroke();
      // Arrowhead at the end of the arc.
      const ex = Math.cos(a1) * r, ey = Math.sin(a1) * r;
      const tx = Math.sin(a1), ty = -Math.cos(a1); // tangent (clockwise)
      ag.moveTo(ex + tx * 22, ey + ty * 22);
      ag.lineTo(ex - ty * 18 - tx * 4, ey + tx * 18 - ty * 4);
      ag.lineTo(ex + ty * 18 - tx * 4, ey - tx * 18 - ty * 4);
      ag.close(); ag.fill();
    }
    this.spinNode.addChild(this.spinIcon);
    this.spinStop = makeLabel(this.spinNode, '', 40, '#3b2300', 0, 0, 160);
    this.spinStop.node.active = false;
    this.spinNode.on(Node.EventType.TOUCH_END, () => { if (this.spinEnabled) h.onSpin(); });
    this.node.addChild(this.spinNode);
    this.startIcon();

    // Footer.
    const foot = uiNode('Footer', 720, 76);
    foot.setPosition(0, -602, 0);
    const fg = foot.addComponent(Graphics);
    fg.fillColor = new Color(0, 0, 0, 140); fg.rect(-360, -38, 720, 76); fg.fill();
    makeLabel(foot, STRINGS.balance, 22, '#b9a8d6', -300, 0, 180, { align: 'left' }).node.setPosition(-250, 0, 0);
    this.balance = makeLabel(foot, '', 36, '#f6efff', -60, 0, 300, { align: 'left' });
    this.balance.node.setPosition(-50, 0, 0);
    this.sound = makeLabel(foot, '🔊', 34, '#ffffff', 80, 0, 60);
    this.sound.node.on(Node.EventType.TOUCH_END, () => h.onSound());
    this.bars = uiNode('Bars', 60, 40).addComponent(Graphics);
    this.bars.node.setPosition(160, 0, 0);
    foot.addChild(this.bars.node);
    this.roundId = makeLabel(foot, '', 18, '#8f80ad', 225, 0, 100, { bold: false });
    const ver = makeLabel(foot, `v${version}`, 20, '#8f80ad', 312, 0, 80, { bold: false });
    ver.node.on(Node.EventType.TOUCH_END, () => h.onVersionTap());
    this.node.addChild(foot);
    this.setBars(3);
    this.showSpeed('normal');
    this.setBet(0);
  }

  buyBonusVisible(v: boolean): void { this.buyNode.active = v; }
  setBalance(v: number): void { this.balance.string = money(v); }
  setBet(v: number): void { this.betBtn.icon.string = money(v); }
  setRoundId(id: string | undefined): void { this.roundId.string = id ? `#${id.slice(-6)}` : ''; }
  showSound(muted: boolean): void { this.sound.string = muted ? '🔇' : '🔊'; }

  /** 0 to 3 lit bars. */
  setBars(n: 0 | 1 | 2 | 3): void {
    const g = this.bars;
    g.clear();
    for (let i = 0; i < 3; i++) {
      g.fillColor = i < n ? hex('#34d399') : hex('#4a3f55');
      g.rect(-20 + i * 16, -14, 10, 10 + i * 8);
      g.fill();
    }
  }

  /** Locks and unlocks the controls from the game's phase. */
  setState(busy: boolean, autoRunning: boolean): void {
    this.autoRunning = autoRunning;
    const active = busy || autoRunning;
    // Spin is locked while a round animates, except during auto spin where it is the STOP button.
    this.spinEnabled = !(busy && !autoRunning);
    this.spinFade.opacity = this.spinEnabled ? 255 : 140;
    this.setSpinBreathing(this.spinEnabled);
    this.betBtn.setEnabled(!active);
    this.menuBtn.setEnabled(!active);
    this.autoBtn.setEnabled(!(busy && !autoRunning));
    this.autoBtn.setOn(autoRunning);
    this.autoBtn.label.string = autoRunning ? STRINGS.stop : STRINGS.auto;
    this.autoBtn.icon.string = autoRunning ? '❚❚' : '↻';
    this.buyEnabled = !active;
    this.buyFade.opacity = this.buyEnabled ? 255 : 115;
    this.spinStop.node.active = autoRunning;
    this.spinStop.string = STRINGS.stop;
    this.spinIcon.active = !autoRunning;
    if (this.spinning !== active) { this.spinning = active; this.startIcon(); }
  }

  /** ▷ normal, ▶ turbo, ▶▶ super turbo: the current speed is always visible on the button. */
  showSpeed(m: SpeedMode): void {
    this.speed = m;
    this.turboBtn.icon.string = { normal: '▷', turbo: '▶', super: '▶▶' }[m];
    this.turboBtn.label.string = { normal: 'NORMAL', turbo: 'TURBO', super: 'SUPER' }[m];
    this.turboBtn.setOn(m !== 'normal', m === 'super' ? '#ff4f8b' : '#f5c542');
    this.turboBtn.setGlow(m === 'normal' ? undefined : GLOW_STYLE.turbo[m]);
    this.startIcon();
  }

  /** Breathing glow while SPIN works (also while it is the STOP button); a steady glow while it is locked. */
  private setSpinBreathing(on: boolean): void {
    if (on === this.breathing) return;
    this.breathing = on;
    this.spinSteady.active = !on;
    this.spinPulse.node.active = on;
    if (on) this.spinPulse.start(GLOW_STYLE.spin.periodSec, 'sineInOut');
    else this.spinPulse.stop();
  }

  shakeBet(): void {
    Tween.stopAllByTarget(this.betBtn.node);
    const x = this.betBtn.node.position.x, y = this.betBtn.node.position.y;
    const t = tween(this.betBtn.node);
    for (let i = 0; i < 2; i++) t.to(0.07, { position: this.betBtn.node.position.clone().set(x - 8, y, 0) }).to(0.07, { position: this.betBtn.node.position.clone().set(x + 8, y, 0) });
    t.to(0.05, { position: this.betBtn.node.position.clone().set(x, y, 0) }).start();
  }

  /** The icon never stops turning: slowly when idle, at the turbo pace while a round plays. */
  private startIcon(): void {
    Tween.stopAllByTarget(this.spinIcon);
    const turn = this.spinning ? ACTIVE_TURN[this.speed] : IDLE_TURN;
    this.spinIcon.angle = this.spinIcon.angle % 360;
    tween(this.spinIcon).by(turn, { angle: -360 }).union().repeatForever().start();
  }

  /** Tap runs onAuto; holding for HOLD_SECONDS runs onAutoHold instead. */
  private holdable(btn: ControlButton): void {
    btn.node.on(Node.EventType.TOUCH_START, () => {
      if (!btn.enabled) return;
      this.held = false;
      clearTimeout(this.holdTimer);
      if (this.autoRunning) return; // running: a tap stops, no hold menu
      this.holdTimer = setTimeout(() => { this.held = true; this.h.onAutoHold(); }, HOLD_SECONDS * 1000);
    });
    const cancel = (): void => { clearTimeout(this.holdTimer); };
    btn.node.on(Node.EventType.TOUCH_CANCEL, cancel);
    btn.node.on(Node.EventType.TOUCH_END, () => {
      cancel();
      if (!btn.enabled) return;
      if (this.held) { this.held = false; return; }
      this.h.onAuto();
    });
  }
}
