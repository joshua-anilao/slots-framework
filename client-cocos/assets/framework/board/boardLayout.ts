/** Where each card sits on the board. Pure maths, no engine, so it can be unit tested. */
export interface BoardLayout {
  card: number;
  gap: number;
  width: number;
  height: number;
  /** Centre of a cell, relative to the board centre. Row 0 is the top row; y grows upward (Cocos). */
  cell(reel: number, row: number): { x: number; y: number };
}

export function computeLayout(reels: number, rows: number, maxWidth: number, gap: number): BoardLayout {
  const card = Math.floor((maxWidth - gap * (reels - 1)) / reels);
  const width = card * reels + gap * (reels - 1);
  const height = card * rows + gap * (rows - 1);
  return {
    card, gap, width, height,
    cell: (reel, row) => ({
      x: -width / 2 + card / 2 + reel * (card + gap),
      y: height / 2 - card / 2 - row * (card + gap),
    }),
  };
}
