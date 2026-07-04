/**
 * Confidence Scorer — per docs/10_ARBITRAGE_ENGINE.md §6.
 *
 * Produces a 0-1 confidence score based on:
 *   1. Number of sources (more = better)
 *   2. Price consistency (lower std dev = better)
 *   3. Liquidity (higher = better)
 *   4. Recency (fresher = better)
 */

import type { PriceSnapshot } from '@nova-app/shared';

export interface ConfidenceDeps {
  readonly clock?: () => number;
}

const WEIGHTS = {
  sourceCount: 0.30,
  consistency: 0.30,
  liquidity: 0.20,
  recency: 0.20,
};

/**
 * Calculate confidence score for an opportunity based on all
 * available snapshots for that pair.
 */
export function calculateConfidence(
  allSnapshots: readonly PriceSnapshot[],
  askSnapshot: PriceSnapshot,
  bidSnapshot: PriceSnapshot,
  deps?: ConfidenceDeps,
): number {
  const now = deps?.clock ? deps.clock() : Date.now();

  // 1. Source Count — more venues = higher confidence
  const uniqueVenues = new Set(allSnapshots.map((s) => s.venue.code)).size;
  const sourceScore = Math.min(uniqueVenues / 5, 1.0); // 5+ venues = 1.0

  // 2. Price Consistency — lower coefficient of variation = higher confidence
  const bids = allSnapshots.map((s) => s.bid);
  const mean = bids.reduce((a, b) => a + b, 0) / bids.length;
  const variance = bids.reduce((sum, v) => sum + (v - mean) ** 2, 0) / bids.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  const consistencyScore = Math.max(0, 1 - Math.min(cv * 100, 1.0)); // 1% CV = 0, 0% CV = 1.0

  // 3. Liquidity — higher volume = higher confidence
  const askVolume = askSnapshot.volume24h * askSnapshot.last;
  const bidVolume = bidSnapshot.volume24h * bidSnapshot.last;
  const minVolume = Math.min(askVolume, bidVolume);
  const liquidityScore = Math.min(minVolume / 10_000_000, 1.0); // $10M+ = 1.0

  // 4. Recency — fresher = higher confidence
  const maxAge = Math.max(
    now - askSnapshot.timestamp,
    now - bidSnapshot.timestamp,
  );
  const recencyScore = Math.max(0, 1 - maxAge / 5_000); // 0s = 1.0, 5s+ = 0

  // Weighted average
  const confidence =
    sourceScore * WEIGHTS.sourceCount +
    consistencyScore * WEIGHTS.consistency +
    liquidityScore * WEIGHTS.liquidity +
    recencyScore * WEIGHTS.recency;

  return Math.max(0, Math.min(1, confidence));
}