import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../risk.js';
import type { PriceSnapshot, ExchangeInfo } from '@nova-app/shared';

const BINANCE: ExchangeInfo = {
  code: 'binance', name: 'Binance', url: 'https://binance.com',
  rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10,
};

const MEXC: ExchangeInfo = {
  code: 'mexc', name: 'MEXC', url: 'https://mexc.com',
  rateLimitMs: 200, takerFeeBps: 20, makerFeeBps: 15,
};

function makeSnapshot(overrides?: Partial<PriceSnapshot>): PriceSnapshot {
  return {
    bid: 100, ask: 101, last: 100.5, volume24h: 1_000_000,
    timestamp: Date.now(), venue: BINANCE,
    pair: { base: 'BTC', quote: 'USDT' },
    ...overrides,
  };
}

describe('scoreRisk', () => {
  it('returns high score for reliable venues with high volume and tight spread', () => {
    // Tight spread: ask=100.05, bid=100 → 5 bps spread → depthScore = 100 - 5*5 = 75
    const ask = makeSnapshot({ venue: BINANCE, volume24h: 10_000_000, ask: 100.05, bid: 100 });
    const bid = makeSnapshot({ venue: BINANCE, volume24h: 10_000_000, ask: 100.05, bid: 100 });
    const risk = scoreRisk(ask, bid, { clock: () => Date.now() });
    expect(risk.totalScore).toBeGreaterThan(60);
    expect(risk.liquidityScore).toBeGreaterThan(50);
    expect(risk.exchangeReliability).toBeGreaterThan(80);
  });

  it('returns lower score for unreliable venues', () => {
    const ask = makeSnapshot({ venue: MEXC, volume24h: 1000 });
    const bid = makeSnapshot({ venue: MEXC, volume24h: 1000, ask: 100.5, bid: 100 });
    const risk = scoreRisk(ask, bid, { clock: () => Date.now() });
    expect(risk.exchangeReliability).toBeLessThan(70);
  });

  it('penalizes stale snapshots', () => {
    const ask = makeSnapshot({ timestamp: Date.now() - 10_000 });
    const bid = makeSnapshot({ timestamp: Date.now() - 10_000, ask: 100.5, bid: 100 });
    const risk = scoreRisk(ask, bid, { clock: () => Date.now() });
    expect(risk.volatilityScore).toBeLessThan(50);
  });

  it('returns scores in 0-100 range', () => {
    const ask = makeSnapshot();
    const bid = makeSnapshot({ ask: 100.5, bid: 100 });
    const risk = scoreRisk(ask, bid);
    expect(risk.totalScore).toBeGreaterThanOrEqual(0);
    expect(risk.totalScore).toBeLessThanOrEqual(100);
    expect(risk.liquidityScore).toBeGreaterThanOrEqual(0);
    expect(risk.liquidityScore).toBeLessThanOrEqual(100);
    expect(risk.depthScore).toBeGreaterThanOrEqual(0);
    expect(risk.depthScore).toBeLessThanOrEqual(100);
  });
});