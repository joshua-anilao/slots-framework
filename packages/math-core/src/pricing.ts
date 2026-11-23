import type { GameConfig } from './config';
import { goldBankMode } from './goldBank';

/**
 * Buy bonus price (x bet). With the gold bank on, the mode's own tuned price if set.
 * Otherwise the live variant's own price if set, else the main price.
 */
export const buyPriceX = (config: GameConfig): number => {
  const mode = goldBankMode(config);
  const tuned = mode === 'off' ? undefined : config.goldBank?.tuning?.[mode]?.buyPriceX;
  return tuned ?? config.buyBonus.priceXByVariant?.[config.multiplier.variant] ?? config.buyBonus.priceX;
};
