/**
 * @nova-app/discovery — Dynamic Discovery Engine.
 * Never hardcodes assets. Discovers CEX markets, DEX pools, and bridge routes dynamically.
 */
export { VenueRegistry } from './venue-registry.js';
export { AssetRegistry } from './asset-registry.js';
export { DiscoveryScheduler } from './scheduler.js';
export { CexDiscoveryWorker } from './workers/cex-worker.js';
export { DexDiscoveryWorker } from './workers/dex-worker.js';
export { BridgeDiscoveryWorker } from './workers/bridge-worker.js';
export { DefaultMetadataResolver } from './metadata/resolver.js';
export type {
  VenueEntry, VenueKind, AssetEntry, DiscoveredPair,
  DiscoveryResult, DiscoverySchedulerConfig, DiscoveryWorker,
  MetadataResolver, ContractResolver,
} from './types.js';
export const NOVA_DISCOVERY_VERSION = '0.1.0';