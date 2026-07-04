/**
 * Core types for the Discovery Engine.
 */
import type { Connector } from '@nova-app/shared';
import type { DexConnector } from '@nova-app/dex';
import type { BridgeConnector } from '@nova-app/bridge';

export type VenueKind = 'cex' | 'dex' | 'bridge';

export interface VenueEntry {
  readonly id: string;
  readonly kind: VenueKind;
  readonly name: string;
  readonly code: string;
  readonly connector: Connector | DexConnector | BridgeConnector;
  readonly registeredAt: number;
  readonly lastHealthCheck: number;
  readonly isHealthy: boolean;
}

export interface AssetEntry {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly contractAddress?: string;
  readonly chainId?: number;
  readonly firstSeenAt: number;
  readonly lastObservedAt: number;
  readonly venues: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface DiscoveredPair {
  readonly venueId: string;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly symbol: string;
  readonly status: 'active' | 'paused' | 'delisted';
  readonly firstSeenAt: number;
  readonly lastObservedAt: number;
}

export interface DiscoveryResult {
  readonly cycleId: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly venuesScanned: number;
  readonly venuesSucceeded: number;
  readonly venuesFailed: number;
  readonly assetsDiscovered: number;
  readonly pairsDiscovered: number;
  readonly errors: readonly string[];
}

export interface DiscoverySchedulerConfig {
  readonly cexIntervalMs: number;
  readonly dexIntervalMs: number;
  readonly bridgeIntervalMs: number;
  readonly fullScanIntervalMs: number;
  readonly staleAssetThresholdMs: number;
  readonly maxConcurrentWorkers: number;
}

export interface MetadataResolver {
  resolveAsset(symbol: string, chainId?: number): Promise<AssetEntry | null>;
  resolveContract(chainId: number, address: string): Promise<AssetEntry | null>;
}

export interface ContractResolver {
  getPoolAddress(dexId: string, token0: string, token1: string, feeTier?: number): Promise<string | null>;
  getFactoryAddress(dexId: string): string | undefined;
}

export interface DiscoveryWorker {
  readonly id: string;
  scanVenue(venueId: string): Promise<{ assets: AssetEntry[]; pairs: DiscoveredPair[]; error?: string }>;
}