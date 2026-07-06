/**
 * Li.Fi Bridge Aggregator Connector
 * Covers all 20+ bridges through a single API:
 * Stargate, LayerZero, Wormhole, Hyperlane, Axelar, deBridge, Hop,
 * Across, CCIP, Relay, Mayan, CCTP, and more.
 */
import type { BridgeInfo, BridgeRoute, BridgeQuote, BridgeConnector } from './types.js';

const API_KEY = 'f9e0f97a-7d56-47dc-b62c-2ce0aa8cd35d.95fbe9c4-b7ec-4407-83b0-bd8642b1f4e5';
const BASE_URL = 'https://li.quest/v1';

const ALL_BRIDGES = [
  'stargate', 'layerzero', 'wormhole', 'hyperlane', 'axelar',
  'debridge', 'hop', 'across', 'ccip', 'mayan',
  'cctp', 'polygon-bridge', 'arbitrum-bridge', 'optimism-bridge', 'base-bridge',
  'relay', 'rhino', 'symbiosis', 'usdt0', 'butter',
];

export class LiFiConnector implements BridgeConnector {
  readonly id = 'lifi';
  readonly kind = 'bridge' as const;
  readonly info: BridgeInfo = {
    id: 'lifi',
    name: 'LI.FI Bridge Aggregator',
    supportedChains: [1, 10, 56, 100, 137, 250, 288, 324, 1088, 1284, 1285, 42161, 42220, 43114, 8453, 59144, 534352, 1666600000],
    website: 'https://li.fi',
  };

  private async fetchJson(path: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}${path}${path.includes('?') ? '&' : '?'}apiKey=${API_KEY}`);
    if (!res.ok) throw new Error(`Li.Fi error: ${res.status}`);
    return res.json();
  }

  async getRoutes(): Promise<readonly BridgeRoute[]> {
    const data = await this.fetchJson('/tools') as { bridges: Array<{ key: string; name: string; supportedChains: number[] }> };
    const routes: BridgeRoute[] = [];
    for (const bridge of data.bridges ?? []) {
      if (!ALL_BRIDGES.includes(bridge.key)) continue;
      for (const origin of (bridge.supportedChains ?? []).slice(0, 3)) {
        for (const dest of (bridge.supportedChains ?? []).slice(0, 3)) {
          if (origin === dest) continue;
          routes.push({
            originChainId: origin,
            destinationChainId: dest,
            originToken: '',
            destinationToken: '',
            bridgeId: bridge.key,
          });
        }
      }
    }
    return routes;
  }

  async fetchRoutes(): Promise<readonly BridgeRoute[]> {
    return this.getRoutes();
  }

  async getQuote(route: BridgeRoute, amount: string): Promise<BridgeQuote | null> {
    try {
      const data = await this.fetchJson(
        `/quote?fromChain=${route.originChainId}&toChain=${route.destinationChainId}&fromToken=0x0000000000000000000000000000000000000000&toToken=0x0000000000000000000000000000000000000000&fromAmount=${amount}&bridges=${route.bridgeId}`
      ) as { estimate: { gasCosts: Array<{ amount: string }>; fees: Array<{ amount: string }> }; transactionRequest: { data: string; to: string; value: string } };
      const gas = data.estimate?.gasCosts?.[0]?.amount ?? '0';
      const fees = data.estimate?.fees?.[0]?.amount ?? '0';
      return {
        bridgeId: route.bridgeId,
        originChainId: route.originChainId,
        destinationChainId: route.destinationChainId,
        originToken: '0x0000000000000000000000000000000000000000',
        destinationToken: '0x0000000000000000000000000000000000000000',
        amount,
        feePct: fees,
        relayGasFeePct: '0',
        lpFeePct: '0',
        estimatedTimeMs: 120_000,
        expiresAt: Date.now() + 600_000,
      };
    } catch {
      return null;
    }
  }

  async getChains(): Promise<readonly { id: number; name: string; coin: string; nativeToken: { symbol: string; priceUSD: string } }[]> {
    const data = await this.fetchJson('/chains') as { chains: Array<{ id: number; name: string; coin: string; nativeToken: { symbol: string; priceUSD: string } }> };
    return (data.chains ?? []).map(c => ({ id: c.id, name: c.name, coin: c.coin, nativeToken: c.nativeToken }));
  }

  async getTokenPrices(chainId: number): Promise<readonly { symbol: string; priceUSD: string }[]> {
    const data = await this.fetchJson(`/tokens?chains=${chainId}`) as { tokens: Record<string, Array<{ symbol: string; priceUSD: string }>> };
    const tokens = data.tokens?.[String(chainId)] ?? data.tokens?.[chainId] ?? [];
    return tokens.map(t => ({ symbol: t.symbol, priceUSD: t.priceUSD }));
  }

  async health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }> {
    const started = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/tools?apiKey=${API_KEY}`);
      return { status: res.ok ? 'active' : 'degraded', latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch {
      return { status: 'maintenance', latencyMs: Date.now() - started, checkedAt: Date.now() };
    }
  }
}
