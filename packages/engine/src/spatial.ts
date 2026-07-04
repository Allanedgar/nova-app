/**
 * Spatial Arbitrage Detector — CEX ↔ CEX.
 *
 * Per docs/10_ARBITRAGE_ENGINE.md §3.
 *
 * For each pair with snapshots from multiple venues:
 *   1. Find the lowest ASK (buy) and highest BID (sell)
 *   2. Must be different venues
 *   3. Run the full validation pipeline
 *   4. If valid, create an ArbitrageOpportunity
 *
 * NEVER compares last price. Always uses bid/ask.
 */

import type {
  ArbitrageOpportunity,
  PairSnapshotSet,
  DetectionCycleResult,
} from '@nova-app/shared';
import { generateId } from './id.js';
import {
  validateAssetIdentity,
  validateBidAsk,
  validateSpread,
  calculateFees,
  calculateNetProfit,
  validateLiquidity,
  estimateSlippage,
  calculateExpectedValue,
} from './validator.js';
import { scoreRisk } from './risk.js';
import { calculateConfidence } from './confidence.js';

export interface SpatialDetectorOptions {
  readonly minProfitBps?: number;
  readonly minLiquidityUsd?: number;
  readonly maxAgeMs?: number;
  readonly defaultNotionalUsd?: number;
  readonly clock?: () => number;
}

const DEFAULT_OPTIONS: Required<SpatialDetectorOptions> = {
  minProfitBps: 50,
  minLiquidityUsd: 1_000,
  maxAgeMs: 5_000,
  defaultNotionalUsd: 1_000,
  clock: Date.now,
};

/**
 * Detect spatial arbitrage opportunities from grouped pair snapshots.
 */
export function detectSpatial(
  pairSets: readonly PairSnapshotSet[],
  options?: SpatialDetectorOptions,
): ArbitrageOpportunity[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = opts.clock();
  const opportunities: ArbitrageOpportunity[] = [];

  for (const ps of pairSets) {
    if (ps.snapshots.length < 2) continue;

    // Find lowest ASK (best buy) and highest BID (best sell)
    const bestAsk = ps.snapshots.reduce((min, s) =>
      s.ask < min.ask ? s : min,
    );
    const bestBid = ps.snapshots.reduce((max, s) =>
      s.bid > max.bid ? s : max,
    );

    // Must be different venues
    if (bestAsk.venue.code === bestBid.venue.code) continue;

    // ── Validation Pipeline ──────────────────────────────────────

    // 1. Asset Identity
    const identityCheck = validateAssetIdentity(bestAsk, bestBid);
    if (!identityCheck.valid) continue;

    // 2. Bid/Ask Sanity
    const askSanity = validateBidAsk(bestAsk);
    if (!askSanity.valid) continue;
    const bidSanity = validateBidAsk(bestBid);
    if (!bidSanity.valid) continue;

    // 3. Spread Validation
    const spreadCheck = validateSpread(
      bestAsk.ask,
      bestBid.bid,
      opts.minProfitBps,
    );
    if (!spreadCheck.valid) continue;

    // 4. Fee Calculation
    const fees = calculateFees(bestAsk.venue, bestBid.venue);

    // 5. Net Profit
    const profit = calculateNetProfit(
      spreadCheck.grossSpreadBps,
      fees,
      opts.defaultNotionalUsd,
    );

    // 6. Liquidity Validation
    const liquidity = validateLiquidity(
      bestAsk,
      bestBid,
      opts.minLiquidityUsd,
    );
    if (!liquidity.sufficient) continue;

    // 7. Slippage Estimation
    const slippage = estimateSlippage(
      opts.defaultNotionalUsd,
      bestAsk,
      bestBid,
    );

    // 8. Risk Score
    const risk = scoreRisk(bestAsk, bestBid, { clock: opts.clock });

    // 9. Confidence Score
    const confidence = calculateConfidence(
      ps.snapshots,
      bestAsk,
      bestBid,
      { clock: opts.clock },
    );

    // 10. Expected Value
    const maxLossUsd = slippage.priceImpactUsd + (profit.netProfitUsd < 0 ? Math.abs(profit.netProfitUsd) : 0);
    const expectedValue = calculateExpectedValue(
      profit.netProfitUsd,
      confidence,
      maxLossUsd,
    );

    // Snapshot age
    const snapshotAgeMs = Math.max(
      now - bestAsk.timestamp,
      now - bestBid.timestamp,
    );

    const opportunity: ArbitrageOpportunity = {
      id: generateId(),
      type: 'spatial',
      status: 'discovered',
      pair: ps.pair,
      symbol: ps.symbol,
      buyPrice: bestAsk.ask,
      sellPrice: bestBid.bid,
      sourceExchange: bestAsk.venue,
      targetExchange: bestBid.venue,
      grossSpreadBps: spreadCheck.grossSpreadBps,
      fees,
      netProfitBps: profit.netProfitBps,
      netProfitUsd: profit.netProfitUsd,
      expectedValue,
      liquidity,
      slippage,
      risk,
      confidenceScore: confidence,
      detectedAt: now,
      expiresAt: now + 30_000, // 30s TTL
      snapshotAgeMs,
      buySnapshot: bestAsk,
      sellSnapshot: bestBid,
    };

    opportunities.push(opportunity);
  }

  // Sort by net profit descending
  return opportunities.sort((a, b) => b.netProfitBps - a.netProfitBps);
}

/**
 * Run a full detection cycle: aggregate snapshots, detect spatial opportunities.
 */
export async function runDetectionCycle(
  pairSets: readonly PairSnapshotSet[],
  options?: SpatialDetectorOptions,
): Promise<DetectionCycleResult> {
  const started = options?.clock ? options.clock() : Date.now();
  const errors: string[] = [];

  let opportunities: ArbitrageOpportunity[] = [];
  try {
    opportunities = detectSpatial(pairSets, options);
  } catch (err) {
    errors.push(`detection error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const elapsedMs = (options?.clock ? options.clock() : Date.now()) - started;

  return {
    opportunities,
    pairsScanned: pairSets.length,
    pairsWithOpportunities: new Set(opportunities.map((o) => o.symbol)).size,
    elapsedMs,
    errors,
  };
}