/**
 * Cross-Venue Arbitrage Strategy (CEX ↔ DEX)
 *
 * Compares prices between centralized and decentralized exchanges.
 * Handles asset identity resolution (WETH↔ETH, USDC↔USDT) and gas costs.
 *
 * Strategy: Buy on CEX (ask), sell on DEX (bid) or vice versa.
 * Profit = (sellPrice - buyPrice) - fees - gasCost
 */
import type { ArbitrageStrategy } from './interface.js';
import type { NormalizedSnapshot, NormalizedPair } from '../types/snapshot.js';
import type {
  OpportunityCandidate, ScoredOpportunity, ValidationResult,
  OpportunityLeg, OpportunityKind,
} from '../types/opportunity.js';

// CEX fee schedules (taker fee in bps)
const CEX_FEES: Record<string, number> = {
  binance: 10, coinbase: 60, okx: 10, bybit: 10, kraken: 26,
  bitget: 10, gate: 20, kucoin: 10, mexc: 10, htx: 20,
  bitfinex: 20, bitstamp: 50, whitebit: 10, poloniex: 20, gemini: 40,
};

const DEX_FEE_BPS = 30; // Typical DEX swap fee (0.3%)
const GAS_COST_USD = 0.10; // Estimated gas cost in USD for a DEX swap
const DEFAULT_CEX_FEE_BPS = 10;

// Asset identity mapping: normalize WETH→ETH, WBTC→BTC, etc.
const ASSET_ALIASES: Record<string, string> = {
  WETH: 'ETH',
  WBTC: 'BTC',
  WBNB: 'BNB',
  WMATIC: 'MATIC',
  WAVAX: 'AVAX',
  WFTM: 'FTM',
  WGLMR: 'GLMR',
  WXDAI: 'XDAI',
};

export class CrossVenueStrategy implements ArbitrageStrategy {
  readonly id = 'cross-venue';
  readonly kind: OpportunityKind = 'cex-dex';
  readonly version = '1.0.0';
  readonly displayName = 'Cross-Venue (CEX↔DEX) Arbitrage';

  private minNetProfitPct = 0.05;
  private maxSpreadAgeMs = 10000;
  private minTradeSizeUSD = 100;

  async detect(snapshots: NormalizedSnapshot[]): Promise<OpportunityCandidate[]> {
    const candidates: OpportunityCandidate[] = [];

    // Separate CEX and DEX snapshots
    const cexSnapshots = snapshots.filter(s => s.venueKind === 'cex');
    const dexSnapshots = snapshots.filter(s => s.venueKind === 'dex');

    if (cexSnapshots.length === 0 || dexSnapshots.length === 0) {
      return candidates;
    }

    // Build CEX and DEX pair maps (normalized by asset)
    const cexPairs = this.flattenPairs(cexSnapshots);
    const dexPairs = this.flattenPairs(dexSnapshots);

    // Compare each CEX pair with DEX pairs
    for (const cexPair of cexPairs) {
      const normalizedBase = this.normalizeAsset(cexPair.baseAsset);
      const normalizedQuote = this.normalizeAsset(cexPair.quoteAsset);

      // Find matching DEX pair
      const matchingDex = dexPairs.find(p =>
        this.normalizeAsset(p.baseAsset) === normalizedBase &&
        this.normalizeAsset(p.quoteAsset) === normalizedQuote
      );
      if (!matchingDex) continue;

      // Check both directions: CEX→DEX and DEX→CEX
      const directions: Array<{
        direction: string;
        buyVenue: string; sellVenue: string;
        buyPrice: number; sellPrice: number;
        buyFee: number; sellFee: number;
      }> = [
        {
          direction: 'cex→dex',
          buyVenue: cexPair.venueId, sellVenue: matchingDex.venueId,
          buyPrice: parseFloat(cexPair.ask), sellPrice: parseFloat(matchingDex.bid),
          buyFee: (CEX_FEES[cexPair.venueId] ?? DEFAULT_CEX_FEE_BPS) / 100,
          sellFee: DEX_FEE_BPS / 100,
        },
        {
          direction: 'dex→cex',
          buyVenue: matchingDex.venueId, sellVenue: cexPair.venueId,
          buyPrice: parseFloat(matchingDex.ask), sellPrice: parseFloat(cexPair.bid),
          buyFee: DEX_FEE_BPS / 100,
          sellFee: (CEX_FEES[cexPair.venueId] ?? DEFAULT_CEX_FEE_BPS) / 100,
        },
      ];

      for (const dir of directions) {
        if (dir.buyPrice <= 0 || dir.sellPrice <= 0) continue;

        const grossProfitPct = ((dir.sellPrice - dir.buyPrice) / dir.buyPrice) * 100;
        const totalFeePct = dir.buyFee + dir.sellFee;
        const gasCostPct = (GAS_COST_USD / this.minTradeSizeUSD) * 100;
        const netProfitPct = grossProfitPct - totalFeePct - gasCostPct;

        if (netProfitPct < this.minNetProfitPct) continue;

        candidates.push({
          id: `cross-venue-${dir.direction}-${normalizedBase}${normalizedQuote}-${Date.now()}`,
          strategyId: this.id,
          kind: this.kind,
          detectedAt: Date.now(),
          legs: [
            {
              venueId: dir.buyVenue,
              venueKind: dir.buyVenue === cexPair.venueId ? 'cex' : 'dex',
              action: 'buy',
              asset: `${normalizedBase}${normalizedQuote}`,
              amount: '0',
              expectedPrice: dir.buyPrice.toFixed(6),
            },
            {
              venueId: dir.sellVenue,
              venueKind: dir.sellVenue === cexPair.venueId ? 'cex' : 'dex',
              action: 'sell',
              asset: `${normalizedBase}${normalizedQuote}`,
              amount: '0',
              expectedPrice: dir.sellPrice.toFixed(6),
            },
          ],
          grossProfitPct: Math.round(grossProfitPct * 10000) / 10000,
          estimatedFeesPct: Math.round((totalFeePct + gasCostPct) * 10000) / 10000,
          netProfitPct: Math.round(netProfitPct * 10000) / 10000,
        });
      }
    }

    return candidates;
  }

  async score(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): Promise<ScoredOpportunity> {
    const freshness = Math.min(100, Math.max(0, 100 - (Date.now() - candidate.detectedAt) / 50));
    const liquidity = 65;
    const spread = candidate.grossProfitPct < 0.1 ? 80 : 50;
    const venueReliability = 70;
    const volume = 55;
    const depth = 40;

    const confidenceScore = Math.round(
      freshness * 0.30 + liquidity * 0.20 + spread * 0.15 +
      venueReliability * 0.15 + volume * 0.10 + depth * 0.10
    );

    const executionProbability = 0.70;
    const riskScore = 100 - confidenceScore;
    const freshnessMultiplier = Math.max(0, 1 - (Date.now() - candidate.detectedAt) / 10000);
    const rankingScore =
      candidate.netProfitPct *
      (confidenceScore / 100) *
      executionProbability *
      (1 - riskScore / 100) *
      freshnessMultiplier;

    return {
      ...candidate,
      confidenceScore,
      riskScore,
      rankingScore,
      executionProbability,
      expectedSlippage: 0.15,
      expectedLatencyMs: 2000,
      expiresAt: candidate.detectedAt + 5000,
    };
  }

  async validate(opportunity: ScoredOpportunity): Promise<ValidationResult> {
    if (Date.now() - opportunity.detectedAt > this.maxSpreadAgeMs) {
      return { valid: false, reasons: ['Opportunity expired'], expectedFillPct: 0 };
    }
    return { valid: true, reasons: [], expectedFillPct: 0.80 };
  }

  private flattenPairs(snapshots: NormalizedSnapshot[]): NormalizedPair[] {
    const pairs: NormalizedPair[] = [];
    for (const snap of snapshots) {
      for (const pair of snap.pairs) {
        pairs.push(pair);
      }
    }
    return pairs;
  }

  private normalizeAsset(asset: string): string {
    return ASSET_ALIASES[asset.toUpperCase()] ?? asset.toUpperCase();
  }
}