/**
 * Core types for the DEX connector system.
 */
export interface DexInfo {
  readonly id?: string;
  readonly name: string;
  readonly code?: string;
  readonly url?: string;
  readonly chain: string;
  readonly version?: string;
  readonly factoryAddress?: string;
  readonly subgraphUrl: string;
  readonly feeTiers?: number[];
  readonly supportedFees?: number[];
}

export interface DexPool {
  readonly id: string;
  readonly address?: string;
  readonly token0: { id: string; symbol: string; decimals: number; name?: string };
  readonly token1: { id: string; symbol: string; decimals: number; name?: string };
  readonly feeTier: number;
  readonly tick?: number | null;
  readonly liquidity: string;
  readonly sqrtPrice?: string;
  readonly volumeUSD: string;
  readonly totalValueLockedUSD?: string;
  readonly createdAtBlock?: number;
  readonly createdAtTimestamp?: number;
}

export interface DexPoolSnapshot {
  readonly id: string;
  readonly pool?: { id: string };
  readonly liquidity: string;
  readonly volumeUSD: string;
  readonly totalValueLockedUSD?: string;
  readonly feeTier?: number;
  readonly token0?: { id: string; symbol: string; decimals: number; name?: string };
  readonly token1?: { id: string; symbol: string; decimals: number; name?: string };
  readonly token0Price?: string;
  readonly token1Price?: string;
  readonly timestamp: number;
}

export interface DexConnector {
  readonly id: string;
  readonly kind: 'dex';
  readonly info: DexInfo;
  discoverPools(): Promise<readonly DexPool[]>;
  fetchPoolSnapshot(poolId: string): Promise<DexPoolSnapshot | null>;
  health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }>;
}

export interface DexRegistry {
  all(): readonly DexConnector[];
  get(id: string): DexConnector | undefined;
}
