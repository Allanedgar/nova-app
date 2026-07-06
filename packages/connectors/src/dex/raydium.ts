/**
 * Raydium DEX Connector (Solana)
 * Uses the official Raydium API v3.
 */
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '@nova-app/dex';

export class RaydiumConnector implements DexConnector {
  readonly id = 'raydium';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: 'raydium',
    name: 'Raydium',
    chain: 'solana',
    subgraphUrl: 'https://api.raydium.io/v3',
    factoryAddress: '',
    supportedFees: [25, 100],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch(`${this.info.subgraphUrl}/pools/info`);
    const data = await res.json() as Array<{ id: string; symbol: string; mintA: { symbol: string; decimals: number }; mintB: { symbol: string; decimals: number }; feeRate: number; tvl: string; volume24h: string }>;
    return (data ?? []).slice(0, 100).map((p) => ({
      id: p.id,
      token0: { id: p.mintA.symbol, symbol: p.mintA.symbol, name: p.mintA.symbol, decimals: p.mintA.decimals },
      token1: { id: p.mintB.symbol, symbol: p.mintB.symbol, name: p.mintB.symbol, decimals: p.mintB.decimals },
      feeTier: Math.round(Number(p.feeRate) * 10000),
      tick: null,
      liquidity: p.tvl ?? '0',
      sqrtPrice: '0',
      volumeUSD: p.volume24h ?? '0',
      totalValueLockedUSD: p.tvl ?? '0',
    }));
  }

  async fetchPoolSnapshot(poolId: string): Promise<DexPoolSnapshot | null> {
    const pools = await this.discoverPools();
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return null;
    return { id: pool.id, liquidity: pool.liquidity, volumeUSD: pool.volumeUSD, feeTier: pool.feeTier, token0: pool.token0, token1: pool.token1, timestamp: Date.now() };
  }

  async health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }> {
    const started = Date.now();
    try {
      const res = await fetch(`${this.info.subgraphUrl}/pools/info`);
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}
