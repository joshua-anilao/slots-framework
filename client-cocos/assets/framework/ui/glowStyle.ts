/**
 * Every glow of the Cocos client in one place: colours, alphas, sizes and loop timings.
 * The numbers follow `prototype-web/src/styles.css`; the CSS line each block comes from is named in its comment.
 * No 'cc' import here, so the unit tests can load this file. Creator recompiles it on save.
 */

/** A CSS `box-shadow: 0 0 <blur>px <spread>px <colour>` that sits outside a shape. `alpha` is 0 to 1. */
export interface GlowSpec { color: string; alpha: number; blur: number; spread?: number }
/** A CSS `box-shadow: 0 0 0 <width>px <colour>`: a solid ring. */
export interface RingSpec { color: string; width: number }
/** A solid ring with a soft glow around it. */
export interface GlowLook { ring?: RingSpec; glow?: GlowSpec }
/** One colour stop of a gradient: `at` runs from 0 (centre or first edge) to 1 (outer edge). */
export interface RadialStop { at: number; color: string; alpha: number }

export interface SwayStyle { periodSec: number; shiftPx: number; tiltDeg: number }
export interface BeamStyle {
  ring: RingSpec;
  glow: GlowSpec;
  /** Corner radius of the glow around the reel (px). */
  radius: number;
  /** The horizontal light inside the reel. */
  light: RadialStop[];
  /** The light pulses between these opacities (0 to 1); one way takes `halfSec`. */
  pulse: { min: number; max: number; halfSec: number };
}
export interface CelebrateStyle {
  periodSec: number;
  /** Period while the anticipation beam is on. */
  anticipationPeriodSec: number;
  tiltDeg: number;
  rest: GlowLook;
  peak: GlowLook;
}
export interface WinBurstStyle {
  width: number;
  height: number;
  stops: RadialStop[];
  durationMs: number;
  scaleStart: number;
  scaleMid: number;
  scaleEnd: number;
  opacityStart: number;
  opacityMid: number;
  opacityEnd: number;
  /** Share of the duration at which the middle keyframe sits (0 to 1). */
  midAt: number;
  easing: 'quartOut';
}
export interface SpinGlowStyle { rest: GlowSpec; peak: GlowSpec; disabled: GlowSpec; periodSec: number }
export interface FsTitleStyle {
  label: { color: string; glow: GlowSpec };
  count: { color: string; outline: string; glow: GlowSpec };
}

export interface GlowStyle {
  /** Width of one drawn band; smaller is smoother and costs more vertices. */
  bandPx: number;
  /** A dimmed card keeps this share of its outer glow. */
  dimGlowFactor: number;
  /** `.sym.win` and `winSway` */
  win: { ring: RingSpec; glow: GlowSpec; sway: SwayStyle };
  /** `.reel.beam` and `@keyframes beam` */
  beam: BeamStyle;
  /** `.sym.celebrate` and `@keyframes celebrate` */
  celebrate: CelebrateStyle;
  /** `.sym.gold`: inner rings from the card edge inwards, then the outer glow. */
  goldCard: { rings: RingSpec[]; glow: GlowSpec };
  /** `.step.on`: the lit multiplier step. */
  multStep: { base: GlowSpec; free: GlowSpec };
  /** `.win-glow` and `hudView.glow()` */
  winBurst: WinBurstStyle;
  /** `.spin-btn` and `@keyframes breathe` */
  spin: SpinGlowStyle;
  /** `.buy-btn` */
  buy: { glow: GlowSpec; edge: RingSpec };
  /** `.turbo-btn` */
  turbo: { turbo: GlowSpec; super: GlowSpec };
  /** `.winner-notice` */
  winnerNotice: { glow: GlowSpec };
  /** `.fs-label` and `.fs-left` */
  fsTitle: FsTitleStyle;
}

export const GLOW_STYLE: GlowStyle = {
  bandPx: 2,
  dimGlowFactor: 0.28,
  win: {
    ring: { color: '#ffe37a', width: 4 },
    glow: { color: '#ffe37a', alpha: 1, blur: 26 },
    sway: { periodSec: 1, shiftPx: 7, tiltDeg: 2.5 },
  },
  beam: {
    ring: { color: '#fff3b0', width: 3 },
    glow: { color: '#f5c542', alpha: 0.75, blur: 40, spread: 12 },
    radius: 14,
    light: [
      { at: 0, color: '#fff0aa', alpha: 0 },
      { at: 0.3, color: '#fff0aa', alpha: 0.55 },
      { at: 0.5, color: '#ffffe6', alpha: 0.85 },
      { at: 0.7, color: '#fff0aa', alpha: 0.55 },
      { at: 1, color: '#fff0aa', alpha: 0 },
    ],
    pulse: { min: 0.65, max: 1, halfSec: 0.5 },
  },
  celebrate: {
    periodSec: 0.5,
    anticipationPeriodSec: 0.45,
    tiltDeg: 4,
    rest: { ring: { color: '#b5fff6', width: 3 }, glow: { color: '#29d3c0', alpha: 1, blur: 20 } },
    peak: { ring: { color: '#ffffff', width: 5 }, glow: { color: '#29d3c0', alpha: 1, blur: 46 } },
  },
  goldCard: {
    rings: [{ color: '#fff6c8', width: 3 }, { color: '#8a6200', width: 3 }],
    glow: { color: '#f5c542', alpha: 0.9, blur: 18 },
  },
  multStep: {
    base: { color: '#f5c542', alpha: 0.8, blur: 24 },
    free: { color: '#29d3c0', alpha: 0.8, blur: 24 },
  },
  winBurst: {
    width: 560,
    height: 150,
    stops: [
      { at: 0, color: '#fff0aa', alpha: 0.95 },
      { at: 0.45, color: '#f5c542', alpha: 0.55 },
      { at: 1, color: '#f5c542', alpha: 0 },
    ],
    durationMs: 380,
    scaleStart: 0.25,
    scaleMid: 1,
    scaleEnd: 1.5,
    opacityStart: 0.95,
    opacityMid: 0.6,
    opacityEnd: 0,
    midAt: 0.55,
    easing: 'quartOut',
  },
  spin: {
    rest: { color: '#f5c542', alpha: 0.5, blur: 26 },
    peak: { color: '#f5c542', alpha: 0.95, blur: 46 },
    disabled: { color: '#f5c542', alpha: 0.65, blur: 34 },
    periodSec: 2.4,
  },
  buy: {
    glow: { color: '#f5c542', alpha: 0.5, blur: 18 },
    edge: { color: '#6b4300', width: 4 },
  },
  turbo: {
    turbo: { color: '#f5c542', alpha: 0.6, blur: 14 },
    super: { color: '#ff4f8b', alpha: 0.8, blur: 18 },
  },
  winnerNotice: { glow: { color: '#f5c542', alpha: 0.6, blur: 18 } },
  fsTitle: {
    label: { color: '#b5fff6', glow: { color: '#29d3c0', alpha: 1, blur: 12 } },
    count: { color: '#ffffff', outline: '#0b5f57', glow: { color: '#29d3c0', alpha: 1, blur: 24 } },
  },
};
