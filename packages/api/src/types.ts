/**
 * API types for Nova backend.
 */
export interface ApiConfig {
  readonly port: number;
  readonly host: string;
  readonly corsOrigin?: string;
  readonly pipeline: {
    readonly cronIntervalMs: number;
    readonly defaultNotionalUsd: number;
    readonly minProfitBps: number;
  };
}

export interface ApiState {
  readonly isRunning: boolean;
  readonly startedAt?: number;
  readonly lastCycle?: number;
  readonly error?: string;
}

export interface OpportunitySummary {
  readonly id: string;
  readonly symbol: string;
  readonly type: string;
  readonly route: string;
  readonly buyVenue: string;
  readonly sellVenue: string;
  readonly netProfitBps: number;
  readonly netProfitUsd: number;
  readonly confidenceScore: number;
  readonly riskScore?: number;
  readonly detectedAt: number;
  readonly expiresAt?: number;
  readonly status: string;
}

export type OpportunityRouteType = 'cex-cex' | 'cex-dex' | 'dex-dex' | 'cross-chain';

export interface AssetOpportunityRow {
  readonly index: number;
  readonly baseAsset: string;
  readonly buyHereName: string;
  readonly buyHerePrice: number;
  readonly sellHereName: string;
  readonly sellHerePrice: number;
  readonly arbitrage: number;
  readonly grossSpreadBps: number;
  readonly estimatedFeeBps: number;
  readonly netSpreadBps: number;
  readonly routeType: OpportunityRouteType;
  readonly buyQuoteAsset: string;
  readonly sellQuoteAsset: string;
  readonly detectedAt: number;
}

export interface ConnectorSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly status?: string;
  readonly supportsOrderBook?: boolean;
  readonly supportsTicker?: boolean;
}

export interface PipelineResult {
  readonly discovery?: unknown;
  readonly opportunities: readonly OpportunitySummary[];
  readonly executionResults?: readonly unknown[];
}

export interface PipelineStats {
  readonly assets: number;
  readonly pairs: number;
  readonly opportunities: number;
  readonly executed: number;
}
