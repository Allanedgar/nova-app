/**
 * Across Bridge Connector
 * Uses the verified working Across API.
 * Endpoint: across.to/api
 */
import { CONFIG } from '../../dex/src/config.js';
import type { BridgeInfo, BridgeRoute, BridgeQuote, BridgeConnector } from './types.js';

export class AcrossConnector implements BridgeConnector {
  readonly id = 'across';
  readonly kind = 'bridge' as const;
  readonly info: BridgeInfo = {
    id: 'across',
    name: 'Across Protocol',
    supportedChains: [1, 10, 137, 42161, 8453, 324, 59144, 534352],
    website: 'https://across.to',
  };

  private async apiGet(path: string): Promise<unknown> {
    const res = await fetch(`${CONFIG.across.baseUrl}${path}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.across.apiKey}` },
    });
    if (!res.ok) throw new Error(`Across API error: ${res.status}`);
    return res.json();
  }

  async getRoutes(): Promise<readonly BridgeRoute[]> {
    const data = await this.apiGet('/available-routes') as Array<{ originChainId: number; destinationChainId: number; originToken: string; destinationToken: string }>;
    return (data ?? []).map((r) => ({
      originChainId: r.originChainId,
      destinationChainId: r.destinationChainId,
      originToken: r.originToken,
      destinationToken: r.destinationToken,
      bridgeId: this.id,
    }));
  }

  async getQuote(route: BridgeRoute, amount: string): Promise<BridgeQuote | null> {
    try {
      const data = await this.apiGet(`/quote?originChainId=${route.originChainId}&destinationChainId=${route.destinationChainId}&originToken=${route.originToken}&amount=${amount}`) as { totalRelayFeePct: string; relayGasFeePct: string; lpFeePct: string; timestamp: string };
      return {
        bridgeId: this.id,
        originChainId: route.originChainId,
        destinationChainId: route.destinationChainId,
        originToken: route.originToken,
        destinationToken: route.destinationToken,
        amount,
        feePct: data.totalRelayFeePct ?? '0',
        relayGasFeePct: data.relayGasFeePct ?? '0',
        lpFeePct: data.lpFeePct ?? '0',
        estimatedTimeMs: 60_000,
        expiresAt: Number(data.timestamp ?? Date.now()) + 300_000,
      };
    } catch {
      return null;
    }
  }

  async getPools(): Promise<readonly { token: string; chainId: number; totalPoolSize: string; liquidReserves: string; apy: string }[]> {
    const tokens = ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '0xdAC17F958D2ee523a2206206994597C13D831ec7', '0x6B175474E89094C44Da98b954EedeAC495271d0F'];
    const pools: Array<{ token: string; chainId: number; totalPoolSize: string; liquidReserves: string; apy: string }> = [];
    for (const token of tokens) {
      try {
        const data = await this.apiGet(`/pools?token=${token}`) as { totalPoolSize: string; liquidReserves: string; estimatedApy: string };
        pools.push({ token, chainId: 1, totalPoolSize: data.totalPoolSize ?? '0', liquidReserves: data.liquidReserves ?? '0', apy: data.estimatedApy ?? '0' });
      } catch { /* skip */ }
    }
    return pools;
  }

  async health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }> {
    const started = Date.now();
    try {
      const res = await fetch(`${CONFIG.across.baseUrl}/pools?token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, {
        headers: { 'Authorization': `Bearer ${CONFIG.across.apiKey}` },
      });
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}