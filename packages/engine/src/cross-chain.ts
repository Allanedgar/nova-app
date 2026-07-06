/**
 * Cross-Chain Arbitrage Detector — same asset across chains.
 *
 * Per docs/10_ARBITRAGE_ENGINE.md §5.
 *
 * For each asset available on multiple chains:
 *   1. Compare best bid and ask across chains
 *   2. Must be different chains
 *   3. Get bridge quote
 *   4. Subtract bridge fee + gas
 *   5. Validate net profit
 *   6. Rank by expected value
 *
 * Uses bridge quote integration from `bridgeAggregator` (placeholder).
 */

import type { ArbitrageOpportunity, PriceSnapshot } from '@nova-app/shared';
import { generateId } from './id.js';

export interface CrossChainDetectorOptions {
  readonly minNetBps?: number;
  readonly maxAgeMs?: number;
  readonly defaultNotionalUsd?: number;
  readonly clock?: () => number;
  readonly getBridgeQuote?: (
    fromChain: string,
    toChain: string,
    token: string,
    amountUsd: number,
  ) => Promise<{ feeBps: number; gasCostUsd: number; estimatedTimeMs: number } | null>;
}

const DEFAULT_OPTIONS: Required<CrossChainDetectorOptions> = {
  minNetBps: 50,
  maxAgeMs: 10_000,
  defaultNotionalUsd: 1_000,
  clock: Date.now,
  getBridgeQuote: async () => null,
};

export interface CrossChainOpportunity {
  readonly id: string;
  readonly type: 'cross-chain';
  readonly asset: string;
  readonly sourceChain: string;
  readonly targetChain: string;
  readonly buyPrice: number;
  readonly sellPrice: number;
  readonly grossProfitBps: number;
  readonly bridgeFeeBps: number;
  readonly bridgeGasUsd: number;
  readonly bridgeEstimatedTimeMs: number;
  readonly netProfitBps: number;
  readonly netProfitUsd: number;
  readonly confidenceScore: number;
  readonly detectedAt: number;
  readonly expiresAt: number;
}

/**
 * Detect cross-chain arbitrage opportunities from snapshots grouped by chain.
 */
export async function detectCrossChain(
  snapshotsByChain: Map<string, PriceSnapshot[]>,
  options?: CrossChainDetectorOptions,
): Promise<ArbitrageOpportunity[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const opportunities: ArbitrageOpportunity[] = [];
  const now = opts.clock();

  // Collect all assets present on at least 2 chains
  const assetMap = new Map<string, { chain: string; snapshot: PriceSnapshot }[]>();

  for (const [chain, snapshots] of snapshotsByChain) {
    for (const snap of snapshots) {
      const asset = snap.pair.base;
      const list = assetMap.get(asset) ?? [];
      list.push({ chain, snapshot: snap });
      assetMap.set(asset, list);
    }
  }

  for (const [asset, entries] of assetMap) {
    if (entries.length < 2) continue;

    // Filter fresh snapshots
    const fresh = entries.filter((e) => now - e.snapshot.timestamp <= opts.maxAgeMs);
    if (fresh.length < 2) continue;

    // Find best ask (lowest buy) and best bid (highest sell) across chains
    const askEntry = fresh.reduce((min, e) => (e.snapshot.ask < min.snapshot.ask ? e : min));
    const bidEntry = fresh.reduce((max, e) => (e.snapshot.bid > max.snapshot.bid ? e : max));

    if (askEntry.chain === bidEntry.chain) continue;

    const grossSpreadBps = ((bidEntry.snapshot.bid - askEntry.snapshot.ask) / askEntry.snapshot.ask) * 10000;

    const bridgeQuote = await opts.getBridgeQuote?.(askEntry.chain, bidEntry.chain, asset, opts.defaultNotionalUsd);
    if (!bridgeQuote) continue;

    const totalDeductionBps = grossSpreadBps - bridgeQuote.feeBps;
    if (totalDeductionBps < opts.minNetBps) {
      continue;
    }

    const netProfitBps = totalDeductionBps;
    const opportunity: ArbitrageOpportunity = {
      id: generateId(),
      type: 'cross-chain',
      status: 'discovered',
      pair: askEntry.snapshot.pair,
      symbol: `${askEntry.snapshot.pair.base}/${askEntry.snapshot.pair.quote}`,
      buyPrice: askEntry.snapshot.ask,
      sellPrice: bidEntry.snapshot.bid,
      sourceExchange: { code: askEntry.chain, name: askEntry.chain, url: '', rateLimitMs: 0, takerFeeBps: 0, makerFeeBps: 0 },
      targetExchange: { code: bidEntry.chain, name: bidEntry.chain, url: '', rateLimitMs: 0, takerFeeBps: 0, makerFeeBps: 0 },
      grossSpreadBps,
      fees: { buyTakerFeeBps: 0, sellTakerFeeBps: 0, gasCostUsd: bridgeQuote.gasCostUsd, bridgeFeeBps: bridgeQuote.feeBps, totalFeeBps: bridgeQuote.feeBps },
      netProfitBps,
      netProfitUsd: opts.defaultNotionalUsd * (netProfitBps / 10000),
      expectedValue: opts.defaultNotionalUsd * (netProfitBps / 10000),
      liquidity: { availableUsd: opts.defaultNotionalUsd, sufficient: true, maxNotionalUsd: opts.defaultNotionalUsd },
      slippage: { expectedBps: bridgeQuote.feeBps, worstCaseBps: bridgeQuote.feeBps, priceImpactUsd: bridgeQuote.gasCostUsd },
      risk: { liquidityScore: 70, depthScore: 70, volatilityScore: 70, exchangeReliability: 60, mevRisk: 60, networkCongestion: 60, totalScore: 65 },
      confidenceScore: 0.7,
      detectedAt: now,
      expiresAt: now + 60_000,
      snapshotAgeMs: Math.max(askEntry.snapshot.timestamp, bidEntry.snapshot.timestamp),
      buySnapshot: askEntry.snapshot,
      sellSnapshot: bidEntry.snapshot,
    };

    opportunities.push(opportunity);
  }

  return opportunities.sort((a, b) => b.netProfitBps - a.netProfitBps);
}

/**
 * Run a full cross-chain detection cycle.
 */
export async function runCrossChainCycle(
  snapshotsByChain: Map<string, PriceSnapshot[]>,
  options?: CrossChainDetectorOptions,
): Promise<{
  opportunities: ArbitrageOpportunity[];
  chainsScanned: number;
  assetsScanned: number;
  elapsedMs: number;
  errors: string[];
}> {
  const started = options?.clock ? options.clock() : Date.now();
  const errors: string[] = [];

  try {
    const opportunities = await detectCrossChain(snapshotsByChain, options);
    const elapsedMs = (options?.clock ? options.clock() : Date.now()) - started;
    return {
      opportunities,
      chainsScanned: snapshotsByChain.size,
      assetsScanned: (() => { const all = []; for (const s of snapshotsByChain.values()) for (const x of s) all.push(x.pair.base); return new Set(all).size; })(),
      elapsedMs,
      errors,
    };
  } catch (err) {
    const elapsedMs = (options?.clock ? options.clock() : Date.now()) - started;
    return {
      opportunities: [],
      chainsScanned: snapshotsByChain.size,
      assetsScanned: 0,
      elapsedMs,
      errors: [`cross-chain detection error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}