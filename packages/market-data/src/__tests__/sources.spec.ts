import { describe, expect, it } from 'vitest';
import type { BridgeConnector } from '@nova-app/bridge';
import type { DexConnector } from '@nova-app/dex';
import type { Connector, ExchangeInfo, TradingPair } from '@nova-app/shared';
import { BridgeRpcSource, DexSubgraphSource, RestMarketDataSource } from '../index.js';

const venue: ExchangeInfo = {
  code: 'binance',
  name: 'Binance',
  url: 'https://binance.com',
  rateLimitMs: 50,
  takerFeeBps: 10,
  makerFeeBps: 8,
};

const pair: TradingPair = { base: 'BTC', quote: 'USDT' };

describe('@nova-app/market-data sources', () => {
  it('collects CEX ticker snapshots and records connector errors', async () => {
    const source = new RestMarketDataSource();
    const goodConnector = {
      id: 'good',
      kind: 'cex',
      info: venue,
      fetchTicker: async () => ({
        ask: 100,
        bid: 101,
        last: 100.5,
        pair,
        timestamp: 1,
        venue,
        volume24h: 10,
      }),
    } as Connector;
    const badConnector = {
      ...goodConnector,
      id: 'bad',
      fetchTicker: async () => {
        throw new Error('rate limited');
      },
    } as Connector;

    const result = await source.fetchTickers([pair], [goodConnector, badConnector]);

    expect(result.snapshots).toHaveLength(1);
    expect(result.errors).toEqual(['bad:BTC/USDT: rate limited']);
  });

  it('discovers DEX pools and snapshots', async () => {
    const source = new DexSubgraphSource();
    const connector: DexConnector = {
      id: 'uniswap-v3',
      kind: 'dex',
      info: { name: 'Uniswap V3', chain: 'ethereum', subgraphUrl: 'https://example.test' },
      discoverPools: async () => [{
        id: 'pool-1',
        feeTier: 500,
        liquidity: '1000',
        token0: { id: 'weth', symbol: 'WETH', decimals: 18 },
        token1: { id: 'usdc', symbol: 'USDC', decimals: 6 },
        volumeUSD: '100',
      }],
      fetchPoolSnapshot: async (poolId) => ({
        id: poolId,
        liquidity: '1000',
        timestamp: 2,
        volumeUSD: '100',
      }),
      health: async () => ({ status: 'active', latencyMs: 5, checkedAt: 2 }),
    };

    const result = await source.discover([connector]);

    expect(result.pools).toHaveLength(1);
    expect(result.snapshots[0]?.id).toBe('pool-1');
    expect(result.errors).toHaveLength(0);
  });

  it('fetches bridge routes and quotes', async () => {
    const source = new BridgeRpcSource();
    const connector: BridgeConnector = {
      id: 'across',
      kind: 'bridge',
      info: { name: 'Across', supportedChains: ['ethereum', 'arbitrum'] },
      fetchRoutes: async () => [{
        id: 'route-1',
        sourceChain: 'ethereum',
        destinationChain: 'arbitrum',
        tokenSymbol: 'USDC',
      }],
      getQuote: async (route, amount) => ({
        routeId: typeof route === 'string' ? route : route.id,
        amount,
        estimatedTimeMs: 90_000,
      }),
      health: async () => ({ status: 'active', latencyMs: 8, checkedAt: 3 }),
    };

    const result = await source.fetchRoutesAndQuotes([connector], '1000');

    expect(result.routes).toHaveLength(1);
    expect(result.quotes[0]?.quote?.amount).toBe('1000');
    expect(result.errors).toHaveLength(0);
  });
});
