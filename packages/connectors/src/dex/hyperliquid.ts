/**
 * Hyperliquid DEX Connector
 * Uses the verified working Hyperliquid API.
 * Endpoint: api.hyperliquid.xyz/info
 */
import { CONFIG } from '../../../dex/src/config.js';
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '../../dex/src/types.js';

export class HyperliquidConnector implements DexConnector {
  readonly id = 'hyperliquid';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: 'hyperliquid',
    name: 'Hyperliquid Spot',
    chain: 'hyperliquid',
    subgraphUrl: CONFIG.hyperliquid.info,
    factoryAddress: '',
    supportedFees: [],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch(CONFIG.hyperliquid.info, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    });
    const data = await res.json() as Record<string, string>;
    return Object.entries(data).map(([symbol, mid]) => ({
      id: symbol,
      token0: { id: symbol, symbol, name: symbol, decimals: 18 },
      token1: { id: 'USDC', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      feeTier: 0,
      tick: null,
      liquidity: '0',
      sqrtPrice: mid,
      volumeUSD: '0',
      totalValueLockedUSD: '0',
    }));
  }

  async fetchPoolSnapshot(poolId: string): Promise<DexPoolSnapshot | null> {
    const pools = await this.discoverPools();
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return null;
    return {
      id: pool.id,
      liquidity: pool.liquidity,
      volumeUSD: pool.volumeUSD,
      feeTier: pool.feeTier,
      token0: pool.token0,
      token1: pool.token1,
      timestamp: Date.now(),
    };
  }

  async health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }> {
    const started = Date.now();
    try {
      const res = await fetch(CONFIG.hyperliquid.info, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
      });
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}