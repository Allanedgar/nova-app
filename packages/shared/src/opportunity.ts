/**
 * Opportunity types — per docs/10_ARBITRAGE_ENGINE.md §2.
 *
 * The detection engine produces these types. They flow through the
 * validation pipeline before being persisted.
 */

import type { ExchangeInfo, PriceSnapshot } from './connector.js';
import type { TradingPair } from './assets.js';

/** Arbitrage strategy type. */
export type ArbitrageType = 'spatial' | 'triangular' | 'cross-chain';

/** Execution tier — determines how the opportunity is handled. */
export type ExecutionTier = 'manual' | 'simulated' | 'automated';

/** Status of an opportunity through its lifecycle. */
export type OpportunityStatus =
  | 'discovered'
  | 'validating'
  | 'valid'
  | 'expired'
  | 'executed'
  | 'failed';

/** Per-leg fee breakdown. */
export interface FeeBreakdown {
  readonly buyTakerFeeBps: number;
  readonly sellTakerFeeBps: number;
  readonly gasCostUsd: number;
  readonly bridgeFeeBps: number;
  readonly totalFeeBps: number;
}

/** Liquidity assessment for the opportunity. */
export interface LiquidityAssessment {
  readonly availableUsd: number;
  readonly sufficient: boolean;
  readonly maxNotionalUsd: number;
}

/** Slippage estimate for the opportunity. */
export interface SlippageEstimate {
  readonly expectedBps: number;
  readonly worstCaseBps: number;
  readonly priceImpactUsd: number;
}

/** Risk breakdown — per docs/11_RISK_ENGINE.md. */
export interface RiskBreakdown {
  readonly liquidityScore: number;    // 0-100
  readonly depthScore: number;        // 0-100
  readonly volatilityScore: number;   // 0-100
  readonly exchangeReliability: number; // 0-100
  readonly mevRisk: number;           // 0-100
  readonly networkCongestion: number; // 0-100
  readonly totalScore: number;        // 0-100 (weighted)
}

/** A single arbitrage opportunity after full validation. */
export interface ArbitrageOpportunity {
  readonly id: string;
  readonly type: ArbitrageType;
  readonly status: OpportunityStatus;
  readonly pair: TradingPair;
  readonly symbol: string;            // e.g. "BTC/USDT"

  // Prices — NEVER use last price. Only bid/ask.
  readonly buyPrice: number;          // Ask (what we pay)
  readonly sellPrice: number;         // Bid (what we receive)
  readonly sourceExchange: ExchangeInfo;
  readonly targetExchange: ExchangeInfo;

  // Profit
  readonly grossSpreadBps: number;
  readonly fees: FeeBreakdown;
  readonly netProfitBps: number;
  readonly netProfitUsd: number;
  readonly expectedValue: number;

  // Validation
  readonly liquidity: LiquidityAssessment;
  readonly slippage: SlippageEstimate;
  readonly risk: RiskBreakdown;
  readonly confidenceScore: number;   // 0-1

  // Timing
  readonly detectedAt: number;        // unix ms
  readonly expiresAt: number;         // unix ms
  readonly snapshotAgeMs: number;     // max age of source snapshots

  // Source data
  readonly buySnapshot: PriceSnapshot;
  readonly sellSnapshot: PriceSnapshot;
}

/** Input to the detection engine — a set of snapshots for one pair. */
export interface PairSnapshotSet {
  readonly pair: TradingPair;
  readonly symbol: string;
  readonly snapshots: readonly PriceSnapshot[];
  readonly fetchedAt: number;
}

/** Result of a single detection cycle. */
export interface DetectionCycleResult {
  readonly opportunities: readonly ArbitrageOpportunity[];
  readonly pairsScanned: number;
  readonly pairsWithOpportunities: number;
  readonly elapsedMs: number;
  readonly errors: readonly string[];
}