/**
 * Cross-Chain Arbitrage Strategy
 *
 * Detects price differences for the same asset across different chains.
 * Uses the Bridge Manager to query bridge costs.
 *
 * Strategy: Buy on chain A, bridge to chain B, sell on chain B.
 * Profit = sellPrice - buyPrice - bridgeFee - gasSource - gasDest
 */
import type { ArbitrageStrategy } from './interface.js';
import type { NormalizedSnapshot, NormalizedPair } from '../types/snapshot.js';
import type {
  OpportunityCandidate, ScoredOpportunity, ValidationResult,
  OpportunityLeg, OpportunityKind,
} from '../types/opportunity.js';
import type { BridgeManager } from '../bridge/manager.js';

const CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum', 10: 'optimism', 56: 'bsc', 137: 'polygon',
  250: 'fantom', 324: 'zksync', 42161: 'arbitrum', 43114: 'avalanche',
  59144: 'linea', 534352: 'scroll', 8453: 'base', 81457: 'blast',
};

const GAS_ESTIMATES_USD: Record<number, number> = {
  1: 5, 10: 0.5, 56: 0.3, 137: 0.5, 250: 0.5, 324: 0.3,
  42161: 0.3, 43114: 0.5, 59144: 0.3, 534352: 0.3, 8453: 0.3, 81457: 0.5,
};

export class CrossChainStrategy implements ArbitrageStrategy {
  readonly id = 'cross-chain';
  readonly kind: OpportunityKind = 'cross-chain';
  readonly version = '1.0.0';
  readonly displayName = 'Cross-Chain Arbitrage';

  private minNetProfitPct = 0.1;
  private bridgeManager: BridgeManager;

  constructor(bridgeManager: BridgeManager, config?: { minNetProfitPct?: number }) {
    this.bridgeManager = bridgeManager;
    if (config?.minNetProfitPct !== undefined) this.minNetProfitPct = config.minNetProfitPct;
  }

  async detect(snapshots: NormalizedSnapshot[]): Promise<OpportunityCandidate[]> {
    const candidates: OpportunityCandidate[] = [];

    // Group snapshots by asset across chains
    const assetMap = this.groupByAsset(snapshots);

    for (const [asset, pairs] of assetMap) {
      if (pairs.length < 2) continue;

      // Find cheapest buy (lowest ask) and most expensive sell (highest bid) across chains
      for (let i = 0; i < pairs.length; i++) {
        for (let j = 0; j < pairs.length; j++) {
          if (i === j) continue;

          const buyPair = pairs[i]!;
          const sellPair = pairs[j]!;
          const buyPrice = parseFloat(buyPair.ask);
          const sellPrice = parseFloat(sellPair.bid);

          if (buyPrice <= 0 || sellPrice <= 0) continue;
          if (sellPrice <= buyPrice) continue;

          const grossPct = ((sellPrice - buyPrice) / buyPrice) * 100;
          const gasCostPct = ((GAS_ESTIMATES_USD[buyPair.chainId ?? 1] ?? 2) / (buyPrice * 0.1)) * 100;

          // Query bridge for quote
          let bridgeFeePct = 0.5; // default fallback
          try {
            const quote = await this.bridgeManager.getQuote({
              sourceChainId: buyPair.chainId ?? 1,
              destinationChainId: sellPair.chainId ?? 1,
              sourceToken: buyPair.baseAddress ?? buyPair.baseAsset,
              destinationToken: sellPair.baseAddress ?? sellPair.baseAsset,
              amount: '100',
            });
            if (quote) {
              bridgeFeePct = parseFloat(quote.feePct) * 100;
            }
          } catch { /* use default */ }

          const netPct = grossPct - 0.20 - gasCostPct - bridgeFeePct;
          if (netPct < this.minNetProfitPct) continue;

          candidates.push({
            id: `cross-chain-${asset}-${CHAIN_NAMES[buyPair.chainId ?? 1]}-${CHAIN_NAMES[sellPair.chainId ?? 1]}-${Date.now()}`,
            strategyId: this.id,
            kind: this.kind,
            detectedAt: Date.now(),
            legs: [
              { venueId: buyPair.venueId, venueKind: 'dex', action: 'buy', asset, amount: '0', expectedPrice: buyPrice.toFixed(6), chainId: buyPair.chainId },
              { venueId: `bridge:${buyPair.chainId}→${sellPair.chainId}`, venueKind: 'bridge', action: 'buy', asset, amount: '0', expectedPrice: '0', chainId: sellPair.chainId },
              { venueId: sellPair.venueId, venueKind: 'dex', action: 'sell', asset, amount: '0', expectedPrice: sellPrice.toFixed(6), chainId: sellPair.chainId },
            ],
            grossProfitPct: Math.round(grossPct * 10000) / 10000,
            estimatedFeesPct: Math.round((0.20 + gasCostPct + bridgeFeePct) * 10000) / 10000,
            netProfitPct: Math.round(netPct * 10000) / 10000,
          });
        }
      }
    }

    return candidates;
  }

  async score(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): Promise<ScoredOpportunity> {
    const bridgeLeg = candidate.legs.find(l => l.venueKind === 'bridge');
    const chainCount = new Set(candidate.legs.map(l => l.chainId)).size;
    const confidenceScore = Math.round(
      Math.min(100, Math.max(0, 100 - (Date.now() - candidate.detectedAt) / 50)) * 0.20 +
      (chainCount > 1 ? 60 : 80) * 0.20 +
      (candidate.netProfitPct > 0.5 ? 80 : 50) * 0.20 +
      (bridgeLeg ? 50 : 80) * 0.20 +
      60 * 0.20
    );
    const riskScore = 100 - confidenceScore;
    const executionProbability = Math.max(0.1, 0.5 - chainCount * 0.1);
    return {
      ...candidate, confidenceScore, riskScore,
      rankingScore: candidate.netProfitPct * (confidenceScore / 100) * executionProbability * (1 - riskScore / 100),
      executionProbability, expectedSlippage: 0.2, expectedLatencyMs: 30000, expiresAt: candidate.detectedAt + 120000,
    };
  }

  async validate(opportunity: ScoredOpportunity): Promise<ValidationResult> {
    if (Date.now() - opportunity.detectedAt > 120000) {
      return { valid: false, reasons: ['Opportunity expired'], expectedFillPct: 0 };
    }
    return { valid: true, reasons: [], expectedFillPct: 0.6 };
  }

  private groupByAsset(snapshots: NormalizedSnapshot[]): Map<string, NormalizedPair[]> {
    const map = new Map<string, NormalizedPair[]>();
    for (const snap of snapshots) {
      for (const pair of snap.pairs) {
        const asset = pair.baseAsset.toUpperCase();
        if (!map.has(asset)) map.set(asset, []);
        map.get(asset)!.push(pair);
      }
    }
    return map;
  }
}