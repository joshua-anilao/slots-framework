/**
 * Fishball Fiesta placeholder illustrations: original hand-drawn SVG street food in a sticker style
 * (thick dark outline, flat colour with a soft highlight). Style reference: Josh's Pinoy street food sheet.
 * Real art replaces these through the same frame names (sym_H1 ...); see the art guide.
 */
const O = '#3a1f12'; // outline colour
const S = `stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body: string): string => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const shine = (cx: number, cy: number, rx = 5, ry = 3) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".7"/>`;
const stick = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${O}" stroke-width="8" stroke-linecap="round"/>` +
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d9a35f" stroke-width="4" stroke-linecap="round"/>`;

/** Fishball skewer with sweet sauce. */
const fishball = svg(
  stick(50, 4, 50, 96) +
  [20, 42, 64, 86].map(cy => `<circle cx="50" cy="${cy}" r="12" fill="#f1d39d" ${S}/>${shine(45, cy - 5)}`).join('') +
  `<path d="M39 17 q5 6 11 1 t11 3 M39 39 q5 6 11 1 t11 3 M39 61 q5 6 11 1 t11 3" fill="none" stroke="#9a3f14" stroke-width="3.5" stroke-linecap="round"/>`,
);

/** Halo-halo in a tall glass: ube scoop, shaved ice, layers, wafer. */
const haloHalo = svg(
  `<defs><clipPath id="hh"><path d="M25 40 L75 40 L68 91 Q67 95 62 95 L38 95 Q33 95 32 91 Z"/></clipPath></defs>` +
  `<g transform="rotate(14 74 30)"><rect x="70" y="6" width="9" height="40" rx="3" fill="#f3d9a4" ${S}/><path d="M70 16 h9 M70 26 h9" stroke="${O}" stroke-width="1.5"/></g>` +
  `<path d="M25 40 L75 40 L68 91 Q67 95 62 95 L38 95 Q33 95 32 91 Z" fill="#e8f6ff"/>` +
  `<g clip-path="url(#hh)"><rect x="20" y="78" width="60" height="20" fill="#7a3e1d"/><rect x="20" y="66" width="60" height="12" fill="#f06292"/><rect x="20" y="54" width="60" height="12" fill="#7bc96f"/><rect x="20" y="40" width="60" height="14" fill="#ffd166"/>` +
  `<circle cx="38" cy="86" r="4" fill="#4e2410"/><circle cx="55" cy="84" r="4" fill="#4e2410"/><circle cx="46" cy="72" r="3.5" fill="#ff8fb3"/></g>` +
  `<path d="M25 40 L75 40 L68 91 Q67 95 62 95 L38 95 Q33 95 32 91 Z" fill="none" ${S}/>` +
  `<path d="M21 42 Q22 18 50 16 Q78 18 79 42 Z" fill="#fff" ${S}/>` +
  `<circle cx="50" cy="19" r="13" fill="#9b6bdc" ${S}/>${shine(45, 14, 5, 3)}` +
  `<path d="M26 36 q8 6 16 0 t16 0 t16 0" fill="none" stroke="#fff3c4" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="50" cy="5" r="4.5" fill="#e11d48" ${S}/>`,
);

/** Kwek-kwek: orange battered quail eggs on a stick. */
const kwek = svg(
  stick(50, 4, 50, 96) +
  [22, 50, 78].map(cy => `<circle cx="50" cy="${cy}" r="15" fill="#ff8a1f" ${S}/>` +
    `<circle cx="44" cy="${cy - 4}" r="2.2" fill="#e25b00"/><circle cx="56" cy="${cy + 3}" r="2.5" fill="#e25b00"/><circle cx="48" cy="${cy + 8}" r="1.8" fill="#e25b00"/>${shine(43, cy - 8, 5, 3)}`).join('') +
  `<path d="M40 36 q10 6 20 0" fill="none" stroke="#9a3f14" stroke-width="3.5" stroke-linecap="round"/>`,
);

/** Barbecue skewer (grilled, glazed). */
const bbq = svg(
  `<g transform="rotate(-38 50 50)">` + stick(50, -8, 50, 108) +
  [10, 38, 66].map(y => `<rect x="28" y="${y}" width="44" height="26" rx="12" fill="#b4401f" ${S}/><rect x="34" y="${y + 4}" width="26" height="7" rx="3.5" fill="#e0693a"/>` +
    `<path d="M40 ${y + 16} l4 6 M52 ${y + 14} l4 6 M62 ${y + 16} l3 5" stroke="#4a1d0c" stroke-width="2.5" stroke-linecap="round"/>`).join('') + `</g>`,
);

/** Banana cue: caramelised bananas on a stick. */
const bananaCue = svg(
  `<g transform="rotate(30 50 50)">` + stick(50, -8, 50, 108) +
  [14, 42, 70].map(y => `<ellipse cx="50" cy="${y + 8}" rx="25" ry="14" fill="#f7c948" ${S}/><path d="M28 ${y + 4} Q50 ${y - 6} 72 ${y + 4} Q60 ${y + 12} 40 ${y + 12} Z" fill="#b4691f" opacity=".85"/>` +
    `<circle cx="38" cy="${y + 6}" r="1.6" fill="#fff3c4"/><circle cx="52" cy="${y + 3}" r="1.6" fill="#fff3c4"/><circle cx="62" cy="${y + 8}" r="1.6" fill="#fff3c4"/>`).join('') + `</g>`,
);

/** Sago't gulaman: orange iced drink with pearls and a pink straw. */
const drink = svg(
  `<defs><clipPath id="dr"><path d="M25 30 L75 30 L69 91 Q68 95 63 95 L37 95 Q32 95 31 91 Z"/></clipPath></defs>` +
  `<g transform="rotate(10 58 28)"><rect x="54" y="2" width="8" height="46" rx="3" fill="#f472b6" ${S}/></g>` +
  `<path d="M25 30 L75 30 L69 91 Q68 95 63 95 L37 95 Q32 95 31 91 Z" fill="#fff4e0"/>` +
  `<g clip-path="url(#dr)"><rect x="20" y="38" width="60" height="60" fill="#ff9a1f"/><rect x="20" y="38" width="60" height="8" fill="#ffb84d"/>` +
  `<circle cx="38" cy="84" r="4" fill="#4e2410"/><circle cx="50" cy="88" r="4" fill="#4e2410"/><circle cx="62" cy="84" r="4" fill="#4e2410"/><circle cx="44" cy="76" r="4" fill="#4e2410"/><circle cx="57" cy="74" r="4" fill="#4e2410"/>` +
  `<rect x="32" y="46" width="14" height="14" rx="3" fill="#fff" opacity=".8" transform="rotate(-12 39 53)"/><rect x="52" y="52" width="14" height="14" rx="3" fill="#fff" opacity=".7" transform="rotate(14 59 59)"/></g>` +
  `<path d="M25 30 L75 30 L69 91 Q68 95 63 95 L37 95 Q32 95 31 91 Z" fill="none" ${S}/>` +
  `<rect x="22" y="24" width="56" height="8" rx="4" fill="#fff" ${S}/>`,
);

/** Pandesal in a clear bag. */
const pandesal = svg(
  `<path d="M26 32 L74 32 L79 90 Q79 96 72 96 L28 96 Q21 96 21 90 Z" fill="#fffdf5" ${S}/>` +
  [[38, 56], [62, 56], [38, 80], [62, 80]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="16" ry="12" fill="#e8a64a" ${S}/><ellipse cx="${x - 3}" cy="${y - 4}" rx="9" ry="4.5" fill="#f6c77a"/><path d="M${x - 5} ${y + 2} q5 4 10 0" stroke="#a8631a" stroke-width="2" fill="none" stroke-linecap="round"/>`).join('') +
  `<path d="M30 32 Q50 6 70 32" fill="#fffdf5" ${S}/><path d="M42 24 Q50 30 58 24" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="31" y="42" width="5" height="46" rx="2.5" fill="#fff" opacity=".55"/>`,
);

/** Puto: three steamed rice cakes in pleated cups, with cheese. */
const puto = svg(
  [[50, 30], [27, 62], [73, 62]].map(([x, y]) =>
    `<path d="M${x - 15} ${y + 14} L${x - 11} ${y + 28} L${x + 11} ${y + 28} L${x + 15} ${y + 14} Z" fill="#e9dcc0" ${S}/>` +
    `<path d="M${x - 5} ${y + 15} L${x - 4} ${y + 27} M${x + 5} ${y + 15} L${x + 4} ${y + 27}" stroke="${O}" stroke-width="1.8"/>` +
    `<path d="M${x - 21} ${y + 14} A21 19 0 0 1 ${x + 21} ${y + 14} Z" fill="#fffaf0" ${S}/>` +
    `<path d="M${x - 8} ${y - 3} L${x} ${y - 9} L${x + 8} ${y - 3} L${x} ${y + 3} Z" fill="#ffd23f" ${S}/>${shine(x - 12, y + 4, 3, 5)}`).join(''),
);

/** Sorbetes (dirty ice cream) in a cup with three scoops (scatter). */
const sorbetes = svg(
  `<g transform="rotate(18 66 22)"><rect x="60" y="2" width="9" height="40" rx="3" fill="#f3d9a4" ${S}/><path d="M60 12 h9 M60 22 h9 M60 32 h9" stroke="${O}" stroke-width="1.5"/></g>` +
  `<circle cx="36" cy="52" r="15" fill="#f9a8d4" ${S}/><circle cx="64" cy="52" r="15" fill="#fcd34d" ${S}/><circle cx="50" cy="36" r="15" fill="#a78bfa" ${S}/>` +
  `${shine(44, 31, 5, 3)}${shine(30, 47, 4, 2.5)}${shine(58, 47, 4, 2.5)}` +
  `<path d="M26 60 L74 60 L66 94 Q65 98 60 98 L40 98 Q35 98 34 94 Z" fill="#22c55e" ${S}/>` +
  `<rect x="24" y="56" width="52" height="8" rx="4" fill="#16a34a" ${S}/><path d="M42 68 L44 94 M58 68 L56 94" stroke="${O}" stroke-width="2" opacity=".5"/>`,
);

/** Wild: golden fishball skewer with a sparkle burst. */
const spark = (x: number, y: number, r: number) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="#fff" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>`;
const wild = svg(
  Array.from({ length: 12 }, (_, i) => `<path d="M50 52 L${50 + 60 * Math.cos(i * Math.PI / 6 - .13)} ${52 + 60 * Math.sin(i * Math.PI / 6 - .13)} L${50 + 60 * Math.cos(i * Math.PI / 6 + .13)} ${52 + 60 * Math.sin(i * Math.PI / 6 + .13)} Z" fill="#fff3b0" opacity=".55"/>`).join('') +
  stick(50, 4, 50, 98) +
  [24, 52, 80].map(cy => `<circle cx="50" cy="${cy}" r="14" fill="#ffc933" ${S}/><path d="M38 ${cy + 4} Q50 ${cy + 16} 62 ${cy + 4} Q58 ${cy + 14} 50 ${cy + 14} Q42 ${cy + 14} 38 ${cy + 4} Z" fill="#e89a00" opacity=".8"/>${shine(44, cy - 6, 5, 3)}`).join('') +
  spark(20, 22, 9) + spark(80, 40, 11) + spark(24, 74, 8),
);

export const FOOD_ART: Record<string, string> = { H1: fishball, H2: haloHalo, H3: kwek, H4: bbq, L1: bananaCue, L2: drink, L3: pandesal, L4: puto, SC: sorbetes, WILD: wild };
