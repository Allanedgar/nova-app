/**
 * SushiSwap DEX Connector (via The Graph subgraph)
 * Uses corrected subgraph ID on the decentralized network.
 */
import { CONFIG } from '@nova-app/dex/config';
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '@nova-app/dex';

const SUBGRAPH_URL = `${CONFIG.graphGateway}/${CONFIG.graphApiKey}/subgraphs/id/${CONFIG.sushiswapSubgraphId}`;

export class SushiSwapConnector implements DexConnector {
  readonly id = 'sushiswap';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: 'sushiswap',
    name: 'SushiSwap',
    chain: 'ethereum',
    subgraphUrl: SUBGRAPH_URL,
    factoryAddress: CONFIG.factories.sushiswap,
    supportedFees: [100, 300, 1000, 3000, 10000],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ liquidityPools(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc) { id name inputTokens { id symbol name decimals } fees { feePercentage feeType } totalValueLockedUSD cumulativeVolumeUSD } }' }),
    });
    const body = await res.json() as { data?: { liquidityPools?: Array<{ id: string; name: string; inputTokens: Array<{ id: string; symbol: string; name: string; decimals: number }>; fees: Array<{ feePercentage: string; feeType: string }>; totalValueLockedUSD: string; cumulativeVolumeUSD: string }> } };
    const pools = body.data?.liquidityPools ?? [];
    return pools.map((p) => ({
      id: p.id,
      token0: p.inputTokens?.[0] ? { id: p.inputTokens[0].id, symbol: p.inputTokens[0].symbol, name: p.inputTokens[0].name, decimals: p.inputTokens[0].decimals } : { id: '', symbol: '?', name: '?', decimals: 18 },
      token1: p.inputTokens?.[1] ? { id: p.inputTokens[1].id, symbol: p.inputTokens[1].symbol, name: p.inputTokens[1].name, decimals: p.inputTokens[1].decimals } : { id: '', symbol: '?', name: '?', decimals: 18 },
      feeTier: Math.round(Number(p.fees?.find(f => f.feeType === 'FIXED_TRADING_FEE')?.feePercentage ?? '0.3') * 10000),
      tick: null,
      liquidity: p.totalValueLockedUSD ?? '0',
      sqrtPrice: '0',
      volumeUSD: p.cumulativeVolumeUSD ?? '0',
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
