/**
 * Validation Pipeline — per docs/10_ARBITRAGE_ENGINE.md §2.
 *
 * Each step in the pipeline validates a specific property of the
 * candidate opportunity. The pipeline short-circuits on first failure.
 *
 * Pipeline order:
 *   1. Asset Identity      → ensure same pair
 *   2. Snapshot Age        → no stale snapshots
 *   3. Bid/Ask Sanity      → ask < bid (inverted) impossible
 *   4. Fee Calculation     → compute total fees
 *   5. Liquidity Validation→ sufficient depth
 *   6. Slippage Estimation → estimate price impact
 *   7. Expected Profit     → net profit > min threshold
 *   8. Risk Score          → institutional risk scoring
 *   9. Confidence Score    → probabilistic confidence
 */

import type {
  PriceSnapshot,
  ExchangeInfo,
  FeeBreakdown,
  SlippageEstimate,
} from '@nova-app/shared';

// ── Validation Result ──────────────────────────────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

// ── 1. Asset Identity ──────────────────────────────────────────────

export function validateAssetIdentity(
  askSnapshot: PriceSnapshot,
  bidSnapshot: PriceSnapshot,
): ValidationResult {
  const askPair = `${askSnapshot.pair.base}/${askSnapshot.pair.quote}`;
  const bidPair = `${bidSnapshot.pair.base}/${bidSnapshot.pair.quote}`;
  if (askPair !== bidPair) {
    return { valid: false, reason: `Asset mismatch: ${askPair} vs ${bidPair}` };
  }
  return { valid: true };
}

// ── 2. Snapshot Age ────────────────────────────────────────────────

export function validateSnapshotAge(
  snapshot: PriceSnapshot,
  maxAgeMs: number,
  now?: number,
): ValidationResult {
  const age = (now ?? Date.now()) - snapshot.timestamp;
  if (age > maxAgeMs) {
    return { valid: false, reason: `Snapshot stale by ${age}ms (max ${maxAgeMs}ms)` };
  }
  return { valid: true };
}

// ── 3. Bid/Ask Sanity ──────────────────────────────────────────────

export function validateBidAsk(snapshot: PriceSnapshot): ValidationResult {
  if (snapshot.ask <= 0 || snapshot.bid <= 0) {
    return { valid: false, reason: 'Non-positive price' };
  }
  if (snapshot.ask <= snapshot.bid) {
    // Inverted order book (ask <= bid) is impossible — discard
    return { valid: false, reason: `Inverted book: ask ${snapshot.ask} <= bid ${snapshot.bid}` };
  }
  return { valid: true };
}

// ── 4. Spread Validation ───────────────────────────────────────────

export function validateSpread(
  askPrice: number,
  bidPrice: number,
  minProfitBps: number,
): { valid: boolean; grossSpreadBps: number; reason?: string } {
  const grossSpreadBps = ((bidPrice - askPrice) / askPrice) * 10_000;
  if (grossSpreadBps <= 0) {
    return { valid: false, grossSpreadBps, reason: 'Negative spread (bid <= ask)' };
  }
  if (grossSpreadBps < minProfitBps) {
    return { valid: false, grossSpreadBps, reason: `Spread ${grossSpreadBps.toFixed(1)} bps below min ${minProfitBps} bps` };
  }
  return { valid: true, grossSpreadBps };
}

// ── 5. Fee Calculation ─────────────────────────────────────────────

export function calculateFees(
  buyVenue: ExchangeInfo,
  sellVenue: ExchangeInfo,
): FeeBreakdown {
  const buyTakerFeeBps = buyVenue.takerFeeBps;
  const sellTakerFeeBps = sellVenue.takerFeeBps;
  const totalFeeBps = buyTakerFeeBps + sellTakerFeeBps;
  return {
    buyTakerFeeBps,
    sellTakerFeeBps,
    gasCostUsd: 0,     // Phase 2.1+
    bridgeFeeBps: 0,   // Phase 2.1+ (cross-chain)
    totalFeeBps,
  };
}

// ── 6. Net Profit ──────────────────────────────────────────────────

export function calculateNetProfit(
  grossSpreadBps: number,
  fees: FeeBreakdown,
  notionalUsd: number,
): { netProfitBps: number; netProfitUsd: number } {
  const netProfitBps = grossSpreadBps - fees.totalFeeBps;
  const netProfitUsd = (netProfitBps / 10_000) * notionalUsd;
  return { netProfitBps, netProfitUsd };
}

// ── 7. Liquidity Validation ────────────────────────────────────────

export function validateLiquidity(
  askSnapshot: PriceSnapshot,
  bidSnapshot: PriceSnapshot,
  minLiquidityUsd: number,
): LiquidationAssessment {
  // Estimate available liquidity from top-of-book
  // Use last price volumes as a proxy for depth
  const askLiquidity = askSnapshot.volume24h > 0
    ? askSnapshot.volume24h * askSnapshot.last
    : 0;
  const bidLiquidity = bidSnapshot.volume24h > 0
    ? bidSnapshot.volume24h * bidSnapshot.last
    : 0;

  // 24h volume * 0.01 = 1% of daily volume as available
  const availableUsd = Math.min(askLiquidity, bidLiquidity) * 0.01;
  const sufficient = availableUsd >= minLiquidityUsd;
  const maxNotionalUsd = sufficient ? availableUsd : 0;

  return { availableUsd, sufficient, maxNotionalUsd };
}

export interface LiquidationAssessment {
  readonly availableUsd: number;
  readonly sufficient: boolean;
  readonly maxNotionalUsd: number;
}

// Re-export for consumers
export type { LiquidationAssessment as LiquidityAssessment };

// ── 8. Slippage Estimation ─────────────────────────────────────────

export function estimateSlippage(
  notionalUsd: number,
  askSnapshot: PriceSnapshot,
  bidSnapshot: PriceSnapshot,
): SlippageEstimate {
  // Simple slippage model: 1 bps per $1000 of notional relative to liquidity
  const avgVolume = Math.max(
    askSnapshot.volume24h * askSnapshot.last,
    bidSnapshot.volume24h * bidSnapshot.last,
    1,
  );
  const impactRatio = notionalUsd / avgVolume;
  const expectedBps = impactRatio * 10; // 10 bps per unit of impact
  const worstCaseBps = expectedBps * 2; // 2x for worst case
  const priceImpactUsd = (worstCaseBps / 10_000) * notionalUsd;

  return { expectedBps, worstCaseBps, priceImpactUsd };
}

// ── 9. Expected Value ──────────────────────────────────────────────

export function calculateExpectedValue(
  netProfitUsd: number,
  confidenceScore: number,
  maxLossUsd: number,
): number {
  // Expected Value = P(win) * win_amount - P(lose) * lose_amount
  return confidenceScore * netProfitUsd - (1 - confidenceScore) * maxLossUsd;
}