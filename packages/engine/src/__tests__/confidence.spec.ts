import { describe, expect, it } from 'vitest';
import { calculateConfidence } from '../confidence.js';
import type { PriceSnapshot, ExchangeInfo } from '@nova-app/shared';

const INFO: ExchangeInfo = {
  code: 'binance', name: 'Binance', url: 'https://binance.com',
  rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10,
};

function makeSnapshot(overrides?: Partial<PriceSnapshot>): PriceSnapshot {
  return {
    bid: 100, ask: 101, last: 100.5, volume24h: 1_000_000,
    timestamp: Date.now(), venue: INFO,
    pair: { base: 'BTC', quote: 'USDT' },
    ...overrides,
  };
}

describe('calculateConfidence', () => {
  it('returns high confidence for consistent, fresh, high-volume data', () => {
    const allSnapshots = [
      makeSnapshot({ bid: 100, venue: { ...INFO, code: 'binance' } }),
      makeSnapshot({ bid: 100.1, venue: { ...INFO, code: 'coinbase' } }),
      makeSnapshot({ bid: 99.9, venue: { ...INFO, code: 'okx' } }),
    ];
    const ask = makeSnapshot();
    const bid = makeSnapshot({ bid: 100, ask: 101 });
    const confidence = calculateConfidence(allSnapshots, ask, bid, { clock: () => Date.now() });
    expect(confidence).toBeGreaterThan(0.5);
  });

  it('returns lower confidence for inconsistent data', () => {
    const allSnapshots = [
      makeSnapshot({ bid: 100, venue: { ...INFO, code: 'binance' } }),
      makeSnapshot({ bid: 200, venue: { ...INFO, code: 'coinbase' } }), // Very different
    ];
    const ask = makeSnapshot();
    const bid = makeSnapshot({ bid: 100, ask: 101 });
    const confidence = calculateConfidence(allSnapshots, ask, bid, { clock: () => Date.now() });
    expect(confidence).toBeLessThan(0.7);
  });

  it('returns 0-1 range', () => {
    const allSnapshots = [makeSnapshot()];
    const ask = makeSnapshot();
    const bid = makeSnapshot({ bid: 100, ask: 101 });
    const confidence = calculateConfidence(allSnapshots, ask, bid);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});