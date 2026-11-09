/** Every player-facing text. English now; Tagalog later is a second table with the same keys. */
export const STRINGS = {
  win: 'WIN',
  balance: 'BALANCE',
  bet: 'BET',
  spin: 'SPIN',
  stop: 'STOP',
  auto: 'AUTO',
  turbo: 'TURBO',
  buyBonus: 'BUY\nBONUS',
  freeSpins: 'FREE SPINS',
  freeSpinsWon: (n: number) => `${n} FREE SPINS`,
  congrats: 'CONGRATULATIONS!',
  youWon: (n: number) => `YOU WON ${n} FREE SPINS`,
  youHaveWon: 'YOU HAVE WON',
  ladderLine: (l: number[]) => `MULTIPLIER ${l.map(x => 'x' + x).join('  ')}`,
  freeSpinsLeftLabel: 'FREE SPINS LEFT',
  retrigger: (n: number) => `+${n} FREE SPINS`,
  totalWin: 'TOTAL WIN',
  tapToContinue: 'Tap to continue',
  speedToast: { normal: 'Normal Speed', turbo: 'Turbo Spin Enabled', super: 'Super Turbo Spin Enabled' },
  tier: { big: 'BIG WIN', super: 'SUPER WIN', ultra: 'ULTRA WIN' },
  changeBet: 'CHANGE BET',
  confirm: 'CONFIRM',
  insufficient: 'Not enough balance for this bet',
  comingSoon: (what: string) => `${what}: coming in the next prototype drop`,
  maxWin: 'MAX WIN REACHED',
  debugActive: 'DEBUG OVERRIDES ACTIVE',
  marquee: 'Welcome to the Game 001 prototype! Placeholder art. Demo balance only, no real money.',
} as const;

const fmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ₱1,234.50 */
export const money = (v: number): string => `₱${fmt.format(v)}`;
