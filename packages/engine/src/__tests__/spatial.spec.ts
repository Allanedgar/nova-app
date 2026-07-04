import { describe, expect, it } from 'vitest';
import { detectSpatial, runDetectionCycle } from '../spatial.js';
import type { PriceSnapshot, PairSnapshotSet, ExchangeInfo } from '@nova-app/shared';

const BINANCE: ExchangeInfo = {
  code: 'binance', name: 'Binance', url: 'https://binance.com',
  rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10,
};

const COINBASE: ExchangeInfo = {
  code: 'coinbase', name: 'Coinbase', url: 'https://coinbase.com',
  rateLimitMs: 100, takerFeeBps: 12, makerFeeBps: 10,
};


function makeSnapshot(overrides?: Partial<PriceSnapshot> & { venue?: ExchangeInfo }): PriceSnapshot {
    return {
    bid: 100, ask: 101, last: 100.5, volume24h: 1_000_000,
    timestamp: Date.now(), venue: overrides.venue ?? BINANCE,
    pair: { base: 'BTC', quote: 'USDT' },
    ...overrides,
  };
}

function makePairSet(snapshots: PriceSnapshot[]): PairSnapshotSet {
  return {
    pair: { base: 'BTC', quote: 'USDT' },
    symbol: 'BTC/USDT',
    snapshots,
    fetchedAt: Date.now(),
  };
}

describe('detectSpatial', () => {
  it('detects profitable opportunity between two exchanges', () => {
    const pairSet = makePairSet([
      makeSnapshot({ ask: 100, bid: 99.9, venue: BINANCE }),     // Low ask
      makeSnapshot({ ask: 101, bid: 100.8, venue: COINBASE }),   // High bid
    ]);

    const opps = detectSpatial([pairSet], {
      minProfitBps: 50,
      minLiquidityUsd: 100,
      clock: () => Date.now(),
    });

    expect(opps).toHaveLength(1);
    expect(opps[0].type).toBe('spatial');
    expect(opps[0].buyPrice).toBe(100);   // Best ask (BINANCE)
    expect(opps[0].sellPrice).toBe(100.8); // Best bid (COINBASE)
    expect(opps[0].sourceExchange.code).toBe('binance');
    expect(opps[0].targetExchange.code).toBe('coinbase');
    expect(opps[0].netProfitBps).toBeGreaterThan(0);
    expect(opps[0].risk.totalScore).toBeGreaterThan(0);
    expect(opps[0].confidenceScore).toBeGreaterThan(0);
  });

  it('returns empty when same venue has best bid and ask', () => {
    const pairSet = makePairSet([
      makeSnapshot({ ask: 100, bid: 100.8, venue: BINANCE }),
      makeSnapshot({ ask: 101, bid: 100.5, venue: BINANCE }), // Same venue
    ]);

    const opps = detectSpatial([pairSet], { clock: () => Date.now() });
    expect(opps).toHaveLength(0);
  });

  it('returns empty when spread is below minimum', () => {
    const pairSet = makePairSet([
      makeSnapshot({ ask: 100, bid: 99.9, venue: BINANCE }),
      makeSnapshot({ ask: 100.1, bid: 100.05, venue: COINBASE }), // Tiny spread
    ]);

    const opps = detectSpatial([pairSet], {
      minProfitBps: 50,
      clock: () => Date.now(),
    });
    expect(opps).toHaveLength(0);
  });

  it('returns empty when insufficient snapshots', () => {
    const pairSet = makePairSet([
      makeSnapshot({ venue: BINANCE }),
    ]);

    const opps = detectSpatial([pairSet], { clock: () => Date.now() });
    expect(opps).toHaveLength(0);
  });

  it('returns multiple opportunities for multiple pairs', () => {
    const btcSet = makePairSet([
      makeSnapshot({ ask: 100, bid: 99.9, venue: BINANCE }),
      makeSnapshot({ ask: 101, bid: 100.8, venue: COINBASE }),
    ]);

    const ethSet: PairSnapshotSet = {
      pair: { base: 'ETH', quote: 'USDT' },
      symbol: 'ETH/USDT',
      snapshots: [
        makeSnapshot({ ask: 2000, bid: 1999, venue: BINANCE, pair: { base: 'ETH', quote: 'USDT' } }),
        makeSnapshot({ ask: 2010, bid: 2008, venue: COINBASE, pair: { base: 'ETH', quote: 'USDT' } }),
      ],
      fetchedAt: Date.now(),
    };

    const opps = detectSpatial([btcSet, ethSet], {
      minProfitBps: 10,
      minLiquidityUsd: 100,
      clock: () => Date.now(),
    });

    expect(opps.length).toBeGreaterThanOrEqual(1);
  });

  it('sorts by net profit descending', () => {
    const pairSet1 = makePairSet([
      makeSnapshot({ ask: 100, bid: 99.9, venue: BINANCE }),
      makeSnapshot({ ask: 101, bid: 101.5, venue: COINBASE }), // Big spread
    ]);

    const pairSet2: PairSnapshotSet = {
      pair: { base: 'ETH', quote: 'USDT' },
      symbol: 'ETH/USDT',
      snapshots: [
        makeSnapshot({ ask: 2000, bid: 1999, venue: BINANCE, pair: { base: 'ETH', quote: 'USDT' } }),
        makeSnapshot({ ask: 2005, bid: 2003, venue: COINBASE, pair: { base: 'ETH', quote: 'USDT' } }), // Small spread
      ],
      fetchedAt: Date.now(),
    };

    const opps = detectSpatial([pairSet1, pairSet2], {
      minProfitBps: 10,
      minLiquidityUsd: 100,
      clock: () => Date.now(),
    });

    for (let i = 1; i < opps.length; i++) {
      expect(opps[i - 1].netProfitBps).toBeGreaterThanOrEqual(opps[i].netProfitBps);
    }
  });
});

describe('runDetectionCycle', () => {
  it('returns DetectionCycleResult with correct counts', async () => {
    const pairSet = makePairSet([
      makeSnapshot({ ask: 100, bid: 99.9, venue: BINANCE }),
      makeSnapshot({ ask: 101, bid: 100.8, venue: COINBASE }),
    ]);

    const result = await runDetectionCycle([pairSet], {
      minProfitBps: 50,
      minLiquidityUsd: 100,
      clock: () => Date.now(),
    });

    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.pairsScanned).toBe(1);
    expect(result.pairsWithOpportunities).toBe(1);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.errors).toEqual([]);
  });

  it('handles empty input gracefully', async () => {
    const result = await runDetectionCycle([], { clock: () => Date.now() });
    expect(result.opportunities).toEqual([]);
    expect(result.pairsScanned).toBe(0);
    expect(result.errors).toEqual([]);
  });
});