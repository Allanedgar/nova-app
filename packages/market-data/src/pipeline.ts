/**
 * Market Data Pipeline — orchestrates the flow:
 *   discovery -> snapshot -> arbitrage detection -> execution
 */
import type { Connector } from '@nova-app/shared';
import type { AssetRegistry, DiscoveryScheduler, VenueRegistry, DiscoveryResult } from '@nova-app/discovery';
import { aggregateSnapshots, detectSpatial } from '@nova-app/engine';
import { ExecutionEngine } from '@nova-app/execution';
import type { ArbitrageOpportunity } from '@nova-app/shared';
import { RestMarketDataSource } from './sources/rest.js';
import { DexSubgraphSource } from './sources/dex-subgraph.js';
import { BridgeRpcSource } from './sources/bridge-rpc.js';

export interface PipelineConfig {
  readonly maxDiscoveryAgeMs: number;
  readonly maxSnapshotAgeMs: number;
  readonly defaultNotionalUsd: number;
  readonly minProfitBps: number;
  readonly cronIntervalMs: number;
  readonly clock?: () => number;
}

export interface PipelineResult {
  readonly discovery: DiscoveryResult;
  readonly opportunities: ArbitrageOpportunity[];
  readonly executionResults: Array<{ opportunityId: string; result: unknown }>;
}

export interface PipelineStats {
  readonly assets: number;
  readonly pairs: number;
  readonly opportunities: number;
  readonly executed: number;
}

const DEFAULT_CONFIG: PipelineConfig = {
  maxDiscoveryAgeMs: 86_400_000,
  maxSnapshotAgeMs: 5_000,
  defaultNotionalUsd: 1_000,
  minProfitBps: 50,
  cronIntervalMs: 60_000,
};

export class MarketDataPipeline {
  private readonly config: PipelineConfig;
  private readonly scheduler: DiscoveryScheduler;
  private readonly assetRegistry: AssetRegistry;
  private readonly venueRegistry: VenueRegistry;
  private readonly engine: ExecutionEngine;
  private readonly rest: RestMarketDataSource;
  private readonly dex: DexSubgraphSource;
  private readonly bridge: BridgeRpcSource;

  constructor(
    scheduler: DiscoveryScheduler,
    assetRegistry: AssetRegistry,
    venueRegistry: VenueRegistry,
    engine: ExecutionEngine,
    config?: Partial<PipelineConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scheduler = scheduler;
    this.assetRegistry = assetRegistry;
    this.venueRegistry = venueRegistry;
    this.engine = engine;
    this.rest = new RestMarketDataSource();
    this.dex = new DexSubgraphSource();
    this.bridge = new BridgeRpcSource();
  }

  async runCycle(): Promise<PipelineResult> {
    const discovery = await this.scheduler.runCycle();
    const pairs = this.assetRegistry.pairs
      .filter((p) => p.status !== 'delisted')
      .map((p) => ({ base: p.symbol.split(':')[1]?.split('/')[0] ?? p.symbol, quote: p.symbol.split(':')[1]?.split('/')[1] ?? 'USDT' }));

    const cexConnectors = this.venueRegistry.byKind('cex').map((v) => v.connector as Connector);
    const { pairSets } = await aggregateSnapshots(pairs, cexConnectors);
    const opportunities = detectSpatial(pairSets, {
      minProfitBps: this.config.minProfitBps,
      defaultNotionalUsd: this.config.defaultNotionalUsd,
    });

    const executionResults: Array<{ opportunityId: string; result: unknown }> = [];
    for (const opp of opportunities) {
      const result = await this.engine.execute({
        opportunityId: opp.id,
        tier: 'simulated',
        venueId: opp.sourceExchange.code,
        pair: opp.pair,
        side: 'buy',
        price: opp.buyPrice,
        quantity: Number.isFinite(opp.buyPrice) && opp.buyPrice > 0 ? this.config.defaultNotionalUsd / opp.buyPrice : 0,
        notionalUsd: this.config.defaultNotionalUsd,
        maxSlippageBps: 50,
        timeoutMs: 30_000,
      });
      executionResults.push({ opportunityId: opp.id, result });
    }

    return { discovery, opportunities, executionResults };
  }

  get stats(): PipelineStats {
    return {
      assets: this.assetRegistry.size.assets,
      pairs: this.assetRegistry.size.pairs,
      opportunities: 0,
      executed: this.engine.auditLog.size,
    };
  }
}
