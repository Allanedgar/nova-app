/**
 * Core opportunity types for the arbitrage engine.
 */
export type OpportunityKind =
  | 'cex-cex'
  | 'cex-dex'
  | 'cross-chain'
  | 'graph'
  | 'funding'
  | 'statistical'
  | 'bridge-arb';

export type VenueKind = 'cex' | 'dex' | 'bridge';

export type OpportunityStatus =
  | 'detected'
  | 'validated'
  | 'scored'
  | 'ranked'
  | 'published'
  | 'reserved'
  | 'executing'
  | 'executed'
  | 'settled'
  | 'expired'
  | 'failed'
  | 'archived';

export interface OpportunityLeg {
  venueId: string;
  venueKind: VenueKind;
  action: 'buy' | 'sell';
  asset: string;
  amount: string;
  expectedPrice: string;
  chainId?: number;
}

export interface OpportunityCandidate {
  id: string;
  strategyId: string;
  kind: OpportunityKind;
  detectedAt: number;
  legs: OpportunityLeg[];
  grossProfitPct: number;
  estimatedFeesPct: number;
  netProfitPct: number;
}

export interface ScoredOpportunity extends OpportunityCandidate {
  confidenceScore: number;
  riskScore: number;
  rankingScore: number;
  executionProbability: number;
  expectedSlippage: number;
  expectedLatencyMs: number;
  expiresAt: number;
}

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
  adjustedProfitPct?: number;
  expectedFillPct?: number;
}

export interface PublishedOpportunity extends ScoredOpportunity {
  status: OpportunityStatus;
  publishedAt: number;
  version: number;
}