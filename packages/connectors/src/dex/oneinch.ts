/**
 * 1inch DEX Aggregator Connector
 * Uses the official 1inch API v5.
 */
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '../../dex/src/types.js';

export class OneInchConnector implements DexConnector {
  readonly id = '1inch';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: '1inch',
    name: '1inch',
    chain: 'ethereum',
    subgraphUrl: 'https://api.1inch.dev/swap/v5.2/1',
    factoryAddress: '',
    supportedFees: [],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch('https://tokens.1inch.eth.link');
    const data = await res.json() as Array<{ address: string; symbol: string; name: string; decimals: number }>;
    return (data ?? []).slice(0, 100).map((t) => ({
      id: t.address,
      token0: { id: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals },
      token1: { id: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      feeTier: 0,
      tick: null,
      liquidity: '0',
      sqrtPrice: '0',
      volumeUSD: '0',
      totalValueLockedUSD: '0',
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
      const res = await fetch('https://tokens.1inch.eth.link');
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}