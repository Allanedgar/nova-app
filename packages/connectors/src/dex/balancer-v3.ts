/**
 * Balancer v3 DEX Connector (via The Graph subgraph)
 * Uses corrected subgraph ID on the decentralized network.
 */
import { CONFIG } from '@nova-app/dex/config';
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '@nova-app/dex';

const SUBGRAPH_URL = `${CONFIG.graphGateway}/${CONFIG.graphApiKey}/subgraphs/id/${CONFIG.balancerV3SubgraphId}`;

export class BalancerV3Connector implements DexConnector {
  readonly id = 'balancer-v3';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: 'balancer-v3',
    name: 'Balancer v3',
    chain: 'ethereum',
    subgraphUrl: SUBGRAPH_URL,
    factoryAddress: CONFIG.factories.balancer,
    supportedFees: [100, 300, 1000, 3000, 10000],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ pools(first: 50, orderBy: totalLiquidity, orderDirection: desc) { id address poolType tokens { address symbol name decimals } swapFee totalLiquidity volumeUSD } }' }),
    });
    const body = await res.json() as { data?: { pools?: Array<{ id: string; address: string; poolType: string; tokens: Array<{ address: string; symbol: string; name: string; decimals: number }>; swapFee: string; totalLiquidity: string; volumeUSD: string }> } };
    const pools = body.data?.pools ?? [];
    return pools.map((p) => ({
      id: p.id,
      token0: p.tokens?.[0] ? { id: p.tokens[0].address, symbol: p.tokens[0].symbol, name: p.tokens[0].name, decimals: p.tokens[0].decimals } : { id: '', symbol: '?', name: '?', decimals: 18 },
      token1: p.tokens?.[1] ? { id: p.tokens[1].address, symbol: p.tokens[1].symbol, name: p.tokens[1].name, decimals: p.tokens[1].decimals } : { id: '', symbol: '?', name: '?', decimals: 18 },
      feeTier: Math.round(Number(p.swapFee) * 10000),
      tick: null,
      liquidity: p.totalLiquidity ?? '0',
      sqrtPrice: '0',
      volumeUSD: p.volumeUSD ?? '0',
      totalValueLockedUSD: p.totalLiquidity ?? '0',
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
