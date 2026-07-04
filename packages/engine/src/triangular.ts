/**
 * Triangular Arbitrage Detector — same-exchange 3-cycle opportunities.
 *
 * Per docs/10_ARBITRAGE_ENGINE.md §4.
 *
 * For each exchange with ≥3 connected pairs:
 *   1. Build adjacency map of token prices
 *   2. Find 3-cycles (A→B→C→A)
 *   3. Validate profitability after fees
 *   4. Rank by net profit
 *
 * NEVER uses last price. Always uses bid/ask.
 */

import type { ArbitrageOpportunity, PriceSnapshot } from '@nova-app/shared';
import { generateId } from './id.js';

export interface TriangularDetectorOptions {
  readonly minProfitBps?: number;
  readonly maxAgeMs?: number;
  readonly defaultNotionalUsd?: number;
  readonly clock?: () => number;
}

const DEFAULT_OPTIONS: Required<TriangularDetectorOptions> = {
  minProfitBps: 50,
  maxAgeMs: 5_000,
  defaultNotionalUsd: 1_000,
  clock: Date.now,
};

/**
 * Detect triangular arbitrage opportunities from snapshots grouped by exchange.
 *
 * Input: snapshots already grouped by exchange.
 * Output: ranked TriangularOpportunity[] sorted by netProfitBps desc.
 */
export function detectTriangular(
  snapshotsByExchange: Map<string, PriceSnapshot[]>,
  options?: TriangularDetectorOptions,
): ArbitrageOpportunity[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const opportunities: ArbitrageOpportunity[] = [];

  for (const [exchangeCode, snapshots] of snapshotsByExchange) {
    if (snapshots.length < 3) continue;

    // Filter fresh snapshots
    const now = opts.clock();
    const fresh = snapshots.filter((s) => now - s.timestamp <= opts.maxAgeMs);
    if (fresh.length < 3) continue;

    // Build adjacency map: token -> (quote token -> effective price)
    const adjacency = new Map<string, Map<string, { price: number; isBid: boolean }>>();

    for (const snap of fresh) {
      const base = snap.pair.base;
      const quote = snap.pair.quote;

      // base -> quote (ask: buy base with quote)
      let baseMap = adjacency.get(base);
      if (!baseMap) {
        baseMap = new Map();
        adjacency.set(base, baseMap);
      }
      baseMap.set(quote, { price: snap.ask, isBid: false });

      // quote -> base (bid: sell base for quote)
      let quoteMap = adjacency.get(quote);
      if (!quoteMap) {
        quoteMap = new Map();
        adjacency.set(quote, quoteMap);
      }
      quoteMap.set(base, { price: 1 / snap.bid, isBid: true });
    }

    // Find 3-cycles: A -> B -> C -> A
    const tokens = Array.from(adjacency.keys());
    for (const start of tokens) {
      const startEdges = adjacency.get(start);
      if (!startEdges) continue;

      for (const [mid1, leg1] of startEdges) {
        const mid1Edges = adjacency.get(mid1);
        if (!mid1Edges) continue;

        for (const [mid2, leg2] of mid1Edges) {
          if (mid2 === start) continue; // Skip 2-cycles

          const leg3 = adjacency.get(mid2)?.get(start);
          if (!leg3) continue;

          // Compute round-trip product
          const product = leg1.price * leg2.price * leg3.price;
          const grossProfitBps = ((product - 1) * 10000);

          if (grossProfitBps < opts.minProfitBps) continue;

          // Estimate fees: 3 trades × taker fee
          const feeBps = 3 * 10; // Assume 10 bps per trade
          const netProfitBps = grossProfitBps - feeBps;

          if (netProfitBps < opts.minProfitBps) continue;

          const opportunity: ArbitrageOpportunity = {
            id: generateId(),
            type: 'triangular',
            status: 'discovered',
            pair: { base: start, quote: mid1 },
            symbol: `${start}/${mid1}`,
            buyPrice: leg1.price,
            sellPrice: leg3.price,
            sourceExchange: { code: exchangeCode, name: exchangeCode, url: '', rateLimitMs: 0, takerFeeBps: 10, makerFeeBps: 10 },
            targetExchange: { code: exchangeCode, name: exchangeCode, url: '', rateLimitMs: 0, takerFeeBps: 10, makerFeeBps: 10 },
            grossSpreadBps: grossProfitBps,
            fees: { buyTakerFeeBps: 10, sellTakerFeeBps: 10, gasCostUsd: 0, bridgeFeeBps: 0, totalFeeBps: 20 },
            netProfitBps,
            netProfitUsd: opts.defaultNotionalUsd * (netProfitBps / 10000),
            expectedValue: opts.defaultNotionalUsd * (netProfitBps / 10000),
            liquidity: { availableUsd: opts.defaultNotionalUsd, sufficient: true, maxNotionalUsd: opts.defaultNotionalUsd },
            slippage: { expectedBps: 0, worstCaseBps: 0, priceImpactUsd: 0 },
            risk: { liquidityScore: 80, depthScore: 80, volatilityScore: 80, exchangeReliability: 80, mevRisk: 50, networkCongestion: 80, totalScore: 75 },
            confidenceScore: 0.8,
            detectedAt: now,
            expiresAt: now + 15_000, // 15s TTL
            snapshotAgeMs: 0,
            buySnapshot: fresh[0]!,
            sellSnapshot: fresh[0]!,
          };

          opportunities.push(opportunity);
        }
      }
    }
  }

  return opportunities.sort((a, b) => b.netProfitBps - a.netProfitBps);
}

/**
 * Run a full triangular detection cycle.
 */
export async function runTriangularCycle(
  snapshotsByExchange: Map<string, PriceSnapshot[]>,
  options?: TriangularDetectorOptions,
): Promise<{
  opportunities: ArbitrageOpportunity[];
  exchangesScanned: number;
  cyclesFound: number;
  elapsedMs: number;
  errors: string[];
}> {
  const started = options?.clock ? options.clock() : Date.now();
  const errors: string[] = [];

  try {
    const opportunities = detectTriangular(snapshotsByExchange, options);
    const elapsedMs = (options?.clock ? options.clock() : Date.now()) - started;
    return {
      opportunities,
      exchangesScanned: snapshotsByExchange.size,
      cyclesFound: opportunities.length,
      elapsedMs,
      errors,
    };
  } catch (err) {
    const elapsedMs = (options?.clock ? options.clock() : Date.now()) - started;
    return {
      opportunities: [],
      exchangesScanned: snapshotsByExchange.size,
      cyclesFound: 0,
      elapsedMs,
      errors: [`triangular detection error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}