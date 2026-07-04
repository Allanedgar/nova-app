/**
 * Uniswap V3 DEX Connector (via The Graph subgraph)
 * Uses corrected subgraph ID on the decentralized network.
 */
import { CONFIG } from '../../../dex/src/config.js';
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '../../dex/src/types.js';

const SUBGRAPH_URL = `${CONFIG.graphGateway}/${CONFIG.graphApiKey}/subgraphs/id/${CONFIG.uniswapV3SubgraphId}`;

export class UniswapV3Connector implements DexConnector {
  readonly id = 'uniswap-v3';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    chain: 'ethereum',
    subgraphUrl: SUBGRAPH_URL,
    factoryAddress: CONFIG.factories.uniswapV3,
    supportedFees: [100, 500, 3000, 10000],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ pools(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc) { id token0 { id symbol name decimals } token1 { id symbol name decimals } feeTier totalValueLockedUSD volumeUSD } }' }),
    });
    const body = await res.json() as { data?: { pools?: Array<{ id: string; token0: { id: string; symbol: string; name: string; decimals: number }; token1: { id: string; symbol: string; name: string; decimals: number }; feeTier: string; totalValueLockedUSD: string; volumeUSD: string }> } };
    const pools = body.data?.pools ?? [];
    return pools.map((p) => ({
      id: p.id,
      token0: { id: p.token0.id, symbol: p.token0.symbol, name: p.token0.name, decimals: p.token0.decimals },
      token1: { id: p.token1.id, symbol: p.token1.symbol, name: p.token1.name, decimals: p.token1.decimals },
      feeTier: Number(p.feeTier),
      tick: null,
      liquidity: p.totalValueLockedUSD ?? '0',
      sqrtPrice: '0',
      volumeUSD: p.volumeUSD ?? '0',
      totalValueLockedUSD: p.totalValueLockedUSD ?? '0',
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
      const res = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ _meta { block { number } } }' }) });
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}