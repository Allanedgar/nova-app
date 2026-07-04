/**
 * @nova-app/market-data — unified market data layer.
 * Connects discovery → snapshot → arbitrage → execution.
 *
 * Sources:
 *   - REST polling via CEX connectors
 *   - WebSocket feeds where available
 *   - GraphQL subgraphs for DEX pools
 *   - RPC calls for on-chain data
 */
export { MarketDataPipeline } from './pipeline.js';
export type { PipelineConfig, PipelineResult, PipelineStats } from './pipeline.js';

export { RestMarketDataSource } from './sources/rest.js';
export { DexSubgraphSource } from './sources/dex-subgraph.js';
export { BridgeRpcSource } from './sources/bridge-rpc.js';