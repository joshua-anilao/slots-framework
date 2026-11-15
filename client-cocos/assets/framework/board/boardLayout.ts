/** Where each card sits on the board. Pure maths, no engine, so it can be unit tested. */
export interface BoardLayout {
  /** Width and height of one cell (the card plus its margin). */
  cellW: number;
  cellH: number;
  /** Space between reels. */
  gap: number;
  /** Card size inside a cell. */
  cardW: number;
  cardH: number;
  width: number;
  height: number;
  /** Centre of a cell, relative to the board centre. Row 0 is the top row; y grows upward (Cocos). */
  cell(reel: number, row: number): { x: number; y: number };
}

/** Margin between a card and the edge of its cell. */
const CARD_MARGIN = 4;

export function computeLayout(reels: number, rows: number, cellW: number, cellH: number, gap: number): BoardLayout {
  const width = cellW * reels + gap * (reels - 1);
  const height = cellH * rows;
  return {
    cellW, cellH, gap, width, height,
    cardW: cellW - CARD_MARGIN * 2,
    cardH: cellH - CARD_MARGIN * 2,
    cell: (reel, row) => ({
      x: -width / 2 + cellW / 2 + reel * (cellW + gap),
      y: height / 2 - cellH / 2 - row * cellH,
    }),
  };
}
