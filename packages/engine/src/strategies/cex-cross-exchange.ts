/**
 * CEX Cross-Exchange Arbitrage Strategy
 *
 * Implements the ArbitrageStrategy interface.
 * Detects price differences for the same asset pair across different CEX venues.
 *
 * Strategy: Buy on venue with lowest ask, sell on venue with highest bid.
 * Profit = (highestBid - lowestAsk) / lowestAsk - fees
 */
import type { ArbitrageStrategy } from './interface.js';
import type { NormalizedSnapshot, NormalizedPair } from '../types/snapshot.js';
import type {
  OpportunityCandidate, ScoredOpportunity, ValidationResult,
  OpportunityLeg, OpportunityKind,
} from '../types/opportunity.js';

// Venue fee schedules (taker fee in bps)
const VENUE_FEES: Record<string, number> = {
  binance: 10, coinbase: 60, okx: 10, bybit: 10, kraken: 26,
  bitget: 10, gate: 20, kucoin: 10, mexc: 10, htx: 20,
  bitfinex: 20, bitstamp: 50, whitebit: 10, poloniex: 20, gemini: 40,
  cryptocom: 10, phemex: 10, lbank: 10, bingx: 10, backpack: 10,
};

const DEFAULT_FEE_BPS = 10;

export class CexCrossExchangeStrategy implements ArbitrageStrategy {
  readonly id = 'cex-cross-exchange';
  readonly kind: OpportunityKind = 'cex-cex';
  readonly version = '1.0.0';
  readonly displayName = 'CEX Cross-Exchange Arbitrage';

  private minNetProfitPct = 0.01;
  private maxSpreadAgeMs = 5000;

  constructor(config?: { minNetProfitPct?: number; maxSpreadAgeMs?: number }) {
    if (config?.minNetProfitPct !== undefined) this.minNetProfitPct = config.minNetProfitPct;
    if (config?.maxSpreadAgeMs !== undefined) this.maxSpreadAgeMs = config.maxSpreadAgeMs;
  }

  async detect(snapshots: NormalizedSnapshot[]): Promise<OpportunityCandidate[]> {
    const candidates: OpportunityCandidate[] = [];

    // Group pairs by normalized symbol across venues
    const pairMap = this.groupPairsBySymbol(snapshots);

    for (const [symbol, pairs] of pairMap) {
      if (pairs.length < 2) continue;

      // Find lowest ask and highest bid
      let lowestAsk = { venue: '', ask: Infinity, pair: null as NormalizedPair | null };
      let highestBid = { venue: '', bid: 0, pair: null as NormalizedPair | null };

      for (const p of pairs) {
        const ask = parseFloat(p.ask);
        const bid = parseFloat(p.bid);
        if (ask < lowestAsk.ask) lowestAsk = { venue: p.venueId, ask, pair: p };
        if (bid > highestBid.bid) highestBid = { venue: p.venueId, bid, pair: p };
      }

      if (lowestAsk.venue === highestBid.venue) continue;

      // Calculate profit
      const grossProfitPct = ((highestBid.bid - lowestAsk.ask) / lowestAsk.ask) * 100;
      const buyFeeBps = VENUE_FEES[lowestAsk.venue] ?? DEFAULT_FEE_BPS;
      const sellFeeBps = VENUE_FEES[highestBid.venue] ?? DEFAULT_FEE_BPS;
      const totalFeePct = (buyFeeBps + sellFeeBps) / 100;
      const netProfitPct = grossProfitPct - totalFeePct;

      if (netProfitPct < this.minNetProfitPct) continue;

      const legs: OpportunityLeg[] = [
        {
          venueId: lowestAsk.venue,
          venueKind: 'cex',
          action: 'buy',
          asset: symbol,
          amount: '0', // Will be set by execution engine
          expectedPrice: lowestAsk.ask.toString(),
        },
        {
          venueId: highestBid.venue,
          venueKind: 'cex',
          action: 'sell',
          asset: symbol,
          amount: '0',
          expectedPrice: highestBid.bid.toString(),
        },
      ];

      candidates.push({
        id: `cex-${symbol}-${lowestAsk.venue}-${highestBid.venue}-${Date.now()}`,
        strategyId: this.id,
        kind: this.kind,
        detectedAt: Date.now(),
        legs,
        grossProfitPct,
        estimatedFeesPct: totalFeePct,
        netProfitPct,
      });
    }

    return candidates;
  }

  async score(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): Promise<ScoredOpportunity> {
    // Compute confidence score
    const freshness = this.scoreFreshness(candidate);
    const liquidity = this.scoreLiquidity(candidate, snapshots);
    const spread = this.scoreSpread(candidate);
    const venueReliability = this.scoreVenueReliability(candidate);
    const volume = this.scoreVolume(candidate, snapshots);
    const depth = this.scoreDepth(candidate, snapshots);

    const confidenceScore = Math.round(
      freshness * 0.30 + liquidity * 0.25 + spread * 0.15 +
      venueReliability * 0.15 + volume * 0.10 + depth * 0.05
    );

    // Compute execution probability
    const executionProbability = this.computeExecutionProbability(candidate);

    // Compute risk score (inverse of confidence)
    const riskScore = 100 - confidenceScore;

    // Compute ranking score
    const freshnessMultiplier = Math.max(0, 1 - (Date.now() - candidate.detectedAt) / 5000);
    const liquidityMultiplier = liquidity / 100;
    const rankingScore =
      candidate.netProfitPct *
      (confidenceScore / 100) *
      executionProbability *
      (1 - riskScore / 100) *
      freshnessMultiplier *
      liquidityMultiplier;

    return {
      ...candidate,
      confidenceScore,
      riskScore,
      rankingScore,
      executionProbability,
      expectedSlippage: 0.05,
      expectedLatencyMs: 500,
      expiresAt: candidate.detectedAt + 3000,
    };
  }

  async validate(opportunity: ScoredOpportunity): Promise<ValidationResult> {
    const age = Date.now() - opportunity.detectedAt;
    if (age > this.maxSpreadAgeMs) {
      return { valid: false, reasons: ['Opportunity expired'], expectedFillPct: 0 };
    }
    return { valid: true, reasons: [], expectedFillPct: 0.95 };
  }

  private groupPairsBySymbol(snapshots: NormalizedSnapshot[]): Map<string, NormalizedPair[]> {
    const map = new Map<string, NormalizedPair[]>();
    for (const snap of snapshots) {
      for (const pair of snap.pairs) {
        const key = pair.normalizedSymbol;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(pair);
      }
    }
    return map;
  }

  private scoreFreshness(candidate: OpportunityCandidate): number {
    const age = Date.now() - candidate.detectedAt;
    if (age < 100) return 100;
    if (age < 500) return 80;
    if (age < 1000) return 60;
    if (age < 5000) return 30;
    return 0;
  }

  private scoreLiquidity(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): number {
    return 70; // Default — will be enhanced with depth data
  }

  private scoreSpread(candidate: OpportunityCandidate): number {
    if (candidate.grossProfitPct < 0.01) return 100;
    if (candidate.grossProfitPct < 0.05) return 80;
    if (candidate.grossProfitPct < 0.10) return 60;
    if (candidate.grossProfitPct < 0.50) return 40;
    return 20;
  }

  private scoreVenueReliability(candidate: OpportunityCandidate): number {
    return 80; // Default — will be enhanced with uptime data
  }

  private scoreVolume(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): number {
    return 60; // Default — will be enhanced with 24h volume data
  }

  private scoreDepth(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): number {
    return 50; // Default — will be enhanced with order book depth
  }

  private computeExecutionProbability(candidate: OpportunityCandidate): number {
    return 0.85; // Default — will be enhanced with fill rate data
  }
}