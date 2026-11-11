import type { GameConfig } from './config';

/** Buy bonus price (x bet) for the live multiplier variant: the variant's own price if set, else the main price. */
export const buyPriceX = (config: GameConfig): number =>
  config.buyBonus.priceXByVariant?.[config.multiplier.variant] ?? config.buyBonus.priceX;
