/**
 * Jupiter DEX Aggregator Connector (Solana)
 * Uses the official Jupiter API v6.
 */
import { CONFIG } from '@nova-app/dex/config';
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from '@nova-app/dex';

export class JupiterConnector implements DexConnector {
  readonly id = 'jupiter';
  readonly kind = 'dex' as const;
  readonly info: DexInfo = {
    id: 'jupiter',
    name: 'Jupiter',
    chain: 'solana',
    subgraphUrl: 'https://quote-api.jup.ag/v6',
    factoryAddress: '',
    supportedFees: [],
  };

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await fetch(`${CONFIG.jupiter.baseUrl}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50&swapMode=ExactIn&restrictIntermediateTokens=true&maxAccounts=64&instructionVersion=V1`, {
      headers: { 'x-api-key': CONFIG.jupiter.apiKey },
    });
    const data = await res.json() as { routes?: Array<{ inAmount: string; outAmount: string; priceImpactPct: string; marketInfos: Array<{ label: string }> }> };
    const routes = data.routes ?? [];
    return routes.slice(0, 50).map((r, i) => ({
      id: `jup-route-${i}`,
      token0: { id: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9 },
      token1: { id: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      feeTier: Math.round(Number(r.priceImpactPct) * 100),
      tick: null,
      liquidity: r.inAmount ?? '0',
      sqrtPrice: r.outAmount ?? '0',
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
      const res = await fetch(`${CONFIG.jupiter.baseUrl}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50&swapMode=ExactIn&restrictIntermediateTokens=true&maxAccounts=64&instructionVersion=V1`, {
        headers: { 'x-api-key': CONFIG.jupiter.apiKey },
      });
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}
