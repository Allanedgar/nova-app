import { describe, expect, it } from 'vitest';
import { runTick } from './noop.js';
import type { Connector, PriceSnapshot, TradingPair, ExchangeInfo } from '@nova-app/shared';

const INFO: ExchangeInfo = {
  code: 'stub', name: 'Stub', url: 'https://stub.local',
  rateLimitMs: 0, takerFeeBps: 10, makerFeeBps: 8,
};

const pair: TradingPair = { base: 'BTC', quote: 'USDT' };

function stub(id: string, returns: 'ok' | 'null' | 'throw'): Connector {
  return {
    id,
    kind: 'cex',
    info: INFO,
    fetchSnapshot: async () => {
      if (returns === 'throw') throw new Error('boom');
      if (returns === 'null') return null;
      const snap: PriceSnapshot = {
        bid: 100, ask: 101, bidQty: 1, askQty: 1,
        timestamp: 0, venue: INFO, pair,
      };
      return snap;
    },
    fetchHealth: async () => ({ status: 'active', latencyMs: 1, checkedAt: 0 }),
  };
}

describe('runTick (Phase 1 detector)', () => {
  it('returns one PriceSnapshot per working connector', async () => {
    const r = await runTick(pair, [stub('a', 'ok'), stub('b', 'ok')], {
      fetchAll: async () => [],
    });
    expect(r.snapshots).toHaveLength(2);
    expect(r.connectorsQueried).toBe(2);
    expect(r.connectorsReturned).toBe(2);
    expect(r.errors).toEqual([]);
  });

  it('tolerates a connector returning null (no quote available)', async () => {
    const r = await runTick(pair, [stub('a', 'ok'), stub('b', 'null')], {
      fetchAll: async () => [],
    });
    expect(r.snapshots).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it('tolerates a connector that throws (one bad venue does not break a tick)', async () => {
    const r = await runTick(pair, [stub('a', 'ok'), stub('b', 'throw')], {
      fetchAll: async () => [],
    });
    expect(r.snapshots).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('boom');
  });

  it('returns empty results when no connectors are registered', async () => {
    const r = await runTick(pair, [], { fetchAll: async () => [] });
    expect(r.snapshots).toEqual([]);
    expect(r.connectorsQueried).toBe(0);
    expect(r.errors).toEqual([]);
  });

  it('measures elapsed time when a clock is provided', async () => {
    let now = 1000;
    const r = await runTick(pair, [stub('a', 'ok')], {
      fetchAll: async () => [],
      clock: () => (now += 5),
    });
    expect(r.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
