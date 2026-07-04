import { describe, expect, it } from 'vitest';
import { aggregateSnapshots, filterFresh, symbolKey } from '../aggregator.js';
import type { Connector, PriceSnapshot, TradingPair, ExchangeInfo } from '@nova-app/shared';

const INFO: ExchangeInfo = {
  code: 'stub', name: 'Stub', url: 'https://stub.local',
  rateLimitMs: 0, takerFeeBps: 10, makerFeeBps: 8,
};

const pair: TradingPair = { base: 'BTC', quote: 'USDT' };

function makeSnapshot(overrides?: Partial<PriceSnapshot>): PriceSnapshot {
  return {
    bid: 100, ask: 101, last: 100.5, volume24h: 1000,
    timestamp: Date.now(), venue: INFO, pair,
    ...overrides,
  };
}

function stubConnector(id: string, returns: 'ok' | 'null' | 'throw' | 'stale'): Connector {
  return {
    id,
    kind: 'cex',
    info: { ...INFO, code: id, name: id },
    fetchTicker: async () => {
      if (returns === 'throw') throw new Error('boom');
      if (returns === 'null') return null;
      if (returns === 'stale') return makeSnapshot({ timestamp: Date.now() - 10_000 });
      return makeSnapshot({ venue: { ...INFO, code: id, name: id } });
    },
    fetchOrderBook: async () => null,
    fetchTrades: async () => [],
    fetchFees: async () => ({ makerFeeBps: 0, takerFeeBps: 0, withdrawalFees: {}, venue: INFO, asOf: 0 }),
    fetchExchangeInfo: async () => INFO,
    fetchMarkets: async () => [],
    discoverAssets: async () => [],
    fetchNetworkStatus: async () => ({
      status: 'active', message: null,
      depositsEnabled: true, withdrawalsEnabled: true,
      tradingEnabled: true, maintenance: false,
      checkedAt: 0, venue: INFO,
    }),
    health: async () => ({ status: 'active', latencyMs: 1, checkedAt: 0 }),
  };
}

describe('aggregateSnapshots', () => {
  it('returns snapshots grouped by pair', async () => {
    const result = await aggregateSnapshots(
      [pair],
      [stubConnector('a', 'ok'), stubConnector('b', 'ok')],
    );

    expect(result.pairSets).toHaveLength(1);
    expect(result.pairSets[0].snapshots).toHaveLength(2);
    expect(result.totalSnapshots).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it('tolerates null returns', async () => {
    const result = await aggregateSnapshots(
      [pair],
      [stubConnector('a', 'ok'), stubConnector('b', 'null')],
    );

    expect(result.pairSets).toHaveLength(1);
    expect(result.pairSets[0].snapshots).toHaveLength(1);
  });

  it('tolerates thrown errors', async () => {
    const result = await aggregateSnapshots(
      [pair],
      [stubConnector('a', 'ok'), stubConnector('b', 'throw')],
    );

    expect(result.pairSets).toHaveLength(1);
    expect(result.pairSets[0].snapshots).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('boom');
  });

  it('filters stale snapshots', async () => {
    const result = await aggregateSnapshots(
      [pair],
      [stubConnector('a', 'stale'), stubConnector('b', 'ok')],
    );

    expect(result.pairSets).toHaveLength(1);
    expect(result.pairSets[0].snapshots).toHaveLength(1);
  });

  it('returns empty when no connectors', async () => {
    const result = await aggregateSnapshots([pair], []);
    expect(result.pairSets).toHaveLength(0);
    expect(result.totalSnapshots).toBe(0);
  });

  it('handles multiple pairs', async () => {
    const pair2: TradingPair = { base: 'ETH', quote: 'USDT' };
    const result = await aggregateSnapshots(
      [pair, pair2],
      [stubConnector('a', 'ok')],
    );

    expect(result.pairSets).toHaveLength(2);
    expect(result.totalSnapshots).toBe(2);
  });
});

describe('filterFresh', () => {
  it('keeps fresh snapshots', () => {
    const snapshots = [makeSnapshot({ timestamp: Date.now() - 1000 })];
    const fresh = filterFresh(snapshots, 5000);
    expect(fresh).toHaveLength(1);
  });

  it('removes stale snapshots', () => {
    const snapshots = [makeSnapshot({ timestamp: Date.now() - 10_000 })];
    const fresh = filterFresh(snapshots, 5000);
    expect(fresh).toHaveLength(0);
  });
});

describe('symbolKey', () => {
  it('formats pair as BASE/QUOTE', () => {
    expect(symbolKey({ base: 'BTC', quote: 'USDT' })).toBe('BTC/USDT');
  });
});