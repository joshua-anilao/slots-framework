import type { PuppetParts } from '../../framework/character/puppetRig';

/**
 * Placeholder cut-out puppet for Fishball Fiesta: a street-food vendor in a red apron and cap.
 * Plain inline SVG like foodArt.ts; real art (or a Spine export) replaces it later without touching the framework.
 * Each box is in px relative to its parent bone; the pivot is the joint it turns around.
 */
const SKIN = '#f4c29a';
const SKIN_SHADE = '#d9a177';
const SHIRT = '#f7efe0';
const APRON = '#e11d48';
const PANTS = '#3b2a6b';
const SHOE = '#2a1d44';
const INK = '#3a1f12';

const svg = (w: number, h: number, body: string) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;

const ARM_SLEEVE = svg(34, 70, `<rect x="2" y="0" width="30" height="66" rx="14" fill="${SHIRT}" stroke="${INK}" stroke-opacity=".35" stroke-width="2"/>`);
const FOREARM = svg(32, 66, `<rect x="4" y="0" width="24" height="46" rx="12" fill="${SKIN}" stroke="${SKIN_SHADE}" stroke-width="2"/>`
  + `<circle cx="16" cy="50" r="13" fill="${SKIN}" stroke="${SKIN_SHADE}" stroke-width="2"/>`);

export const VENDOR_PARTS: PuppetParts = {
  width: 260,
  height: 340,
  bones: {
    hips: {
      x: 55, y: 215, w: 150, h: 125, pivotX: 75, pivotY: 40,
      svg: svg(150, 125, `<rect x="22" y="0" width="106" height="34" rx="10" fill="${PANTS}"/>`
        + `<rect x="24" y="22" width="48" height="85" rx="10" fill="${PANTS}"/><rect x="78" y="22" width="48" height="85" rx="10" fill="${PANTS}"/>`
        + `<rect x="16" y="102" width="58" height="22" rx="10" fill="${SHOE}"/><rect x="76" y="102" width="58" height="22" rx="10" fill="${SHOE}"/>`),
    },
    torso: {
      x: 5, y: -122, w: 140, h: 135, pivotX: 70, pivotY: 125,
      svg: svg(140, 135, `<rect x="57" y="0" width="26" height="22" rx="8" fill="${SKIN}"/>`
        + `<rect x="20" y="10" width="100" height="122" rx="26" fill="${SHIRT}" stroke="${INK}" stroke-opacity=".35" stroke-width="2"/>`
        + `<rect x="34" y="46" width="72" height="86" rx="12" fill="${APRON}"/>`
        + `<path d="M44 14 L58 46 M96 14 L82 46" stroke="${APRON}" stroke-width="7" stroke-linecap="round"/>`
        + `<circle cx="70" cy="82" r="9" fill="#fff6c8" opacity=".85"/>`),
    },
    head: {
      x: 20, y: -92, w: 100, h: 104, pivotX: 50, pivotY: 98,
      svg: svg(100, 104, `<ellipse cx="50" cy="60" rx="38" ry="40" fill="${SKIN}" stroke="${SKIN_SHADE}" stroke-width="2"/>`
        + `<path d="M12 44 Q50 -6 88 44 Z" fill="${APRON}"/><rect x="8" y="40" width="84" height="10" rx="5" fill="#fff6c8"/>`
        + `<ellipse cx="36" cy="64" rx="5" ry="6" fill="${INK}"/><ellipse cx="64" cy="64" rx="5" ry="6" fill="${INK}"/>`
        + `<circle cx="34" cy="62" r="1.8" fill="#fff"/><circle cx="62" cy="62" r="1.8" fill="#fff"/>`
        + `<ellipse cx="26" cy="78" rx="7" ry="4" fill="#f08a7a" opacity=".55"/><ellipse cx="74" cy="78" rx="7" ry="4" fill="#f08a7a" opacity=".55"/>`
        + `<path d="M36 82 Q50 96 64 82" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`),
    },
    armL: { x: 4, y: 14, w: 34, h: 70, pivotX: 17, pivotY: 12, svg: ARM_SLEEVE },
    foreL: { x: 1, y: 52, w: 32, h: 66, pivotX: 16, pivotY: 10, svg: FOREARM },
    armR: { x: 102, y: 14, w: 34, h: 70, pivotX: 17, pivotY: 12, svg: ARM_SLEEVE },
    foreR: { x: 1, y: 52, w: 32, h: 66, pivotX: 16, pivotY: 10, svg: FOREARM },
  },
};

/** Night-market backdrop behind the vendor (CSS background). */
export const VENDOR_SCENE_BG =
  'radial-gradient(70% 90% at 30% 100%, rgba(255,170,60,.45), transparent 70%),'
  + 'repeating-linear-gradient(90deg, rgba(245,197,66,.10) 0 24px, transparent 24px 48px),'
  + 'linear-gradient(180deg, #4a2467 0%, #2a1340 60%, #1a0b2b 100%)';
