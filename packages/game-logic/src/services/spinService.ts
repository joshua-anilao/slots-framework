import type { ForceOptions, RoundResult } from '@slots/math-core';

export interface SpinRequest {
  bet: number;
  buyBonus?: boolean;
  /** Debug only. Ignored unless the service allows forcing. */
  force?: ForceOptions;
}

export interface SpinResponse {
  /** Unique round / transaction id (shown in the footer and in history). */
  roundId: string;
  result: RoundResult;
  balanceBefore: number;
  balanceAfter: number;
  /** Server time in ms. */
  timestamp: number;
}

/** Thrown when the player cannot pay for the round. */
export class InsufficientFundsError extends Error {
  constructor(readonly needed: number, readonly balance: number) {
    super(`Not enough balance: need ${needed}, have ${balance}`);
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Where spin results come from. Local today (math-core in the browser),
 * a remote game server (RGS) later. Views and controllers don't change.
 */
export interface ISpinService {
  spin(request: SpinRequest): Promise<SpinResponse>;
}
