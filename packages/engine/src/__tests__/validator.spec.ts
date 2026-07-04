import { describe, expect, it } from 'vitest';
import {
  validateAssetIdentity,
  validateSnapshotAge,
  validateBidAsk,
  validateSpread,
  calculateFees,
  calculateNetProfit,
  validateLiquidity,
  estimateSlippage,
  calculateExpectedValue,
} from '../validator.js';
import type { PriceSnapshot, ExchangeInfo } from '@nova-app/shared';

const INFO: ExchangeInfo = {
  code: 'binance', name: 'Binance', url: 'https://binance.com',
  rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10,
};

const INFO2: ExchangeInfo = {
  code: 'coinbase', name: 'Coinbase', url: 'https://coinbase.com',
  rateLimitMs: 100, takerFeeBps: 12, makerFeeBps: 10,
};

function makeSnapshot(overrides?: Partial<PriceSnapshot>): PriceSnapshot {
  return {
    bid: 100, ask: 101, last: 100.5, volume24h: 1000,
    timestamp: Date.now(), venue: INFO,
    pair: { base: 'BTC', quote: 'USDT' },
    ...overrides,
  };
}

describe('validateAssetIdentity', () => {
  it('passes for same pair', () => {
    const a = makeSnapshot();
    const b = makeSnapshot();
    expect(validateAssetIdentity(a, b).valid).toBe(true);
  });

  it('fails for different pairs', () => {
    const a = makeSnapshot();
    const b = makeSnapshot({ pair: { base: 'ETH', quote: 'USDT' } });
    expect(validateAssetIdentity(a, b).valid).toBe(false);
  });
});

describe('validateSnapshotAge', () => {
  it('passes for fresh snapshot', () => {
    const snap = makeSnapshot({ timestamp: Date.now() - 1000 });
    expect(validateSnapshotAge(snap, 5000).valid).toBe(true);
  });

  it('fails for stale snapshot', () => {
    const snap = makeSnapshot({ timestamp: Date.now() - 10_000 });
    expect(validateSnapshotAge(snap, 5000).valid).toBe(false);
  });
});

describe('validateBidAsk', () => {
  it('passes for valid book', () => {
    expect(validateBidAsk(makeSnapshot()).valid).toBe(true);
  });

  it('fails for inverted book (ask <= bid)', () => {
    const snap = makeSnapshot({ bid: 101, ask: 100 });
    expect(validateBidAsk(snap).valid).toBe(false);
  });

  it('fails for zero prices', () => {
    expect(validateBidAsk(makeSnapshot({ ask: 0 })).valid).toBe(false);
    expect(validateBidAsk(makeSnapshot({ bid: 0 })).valid).toBe(false);
  });
});

describe('validateSpread', () => {
  it('passes for profitable spread', () => {
    const result = validateSpread(100, 101, 50);
    expect(result.valid).toBe(true);
    expect(result.grossSpreadBps).toBeCloseTo(100, 0); // (101-100)/100 * 10000 = 100
  });

  it('fails for negative spread', () => {
    const result = validateSpread(101, 100, 50);
    expect(result.valid).toBe(false);
    expect(result.grossSpreadBps).toBeLessThan(0);
  });

  it('fails for spread below minimum', () => {
    const result = validateSpread(100, 100.3, 50);
    expect(result.valid).toBe(false);
    expect(result.grossSpreadBps).toBeCloseTo(30, 0);
  });
});

describe('calculateFees', () => {
  it('sums taker fees from both venues', () => {
    const fees = calculateFees(INFO, INFO2);
    expect(fees.buyTakerFeeBps).toBe(10);
    expect(fees.sellTakerFeeBps).toBe(12);
    expect(fees.totalFeeBps).toBe(22);
  });
});

describe('calculateNetProfit', () => {
  it('computes net profit correctly', () => {
    const result = calculateNetProfit(100, { buyTakerFeeBps: 10, sellTakerFeeBps: 10, gasCostUsd: 0, bridgeFeeBps: 0, totalFeeBps: 20 }, 1000);
    expect(result.netProfitBps).toBe(80); // 100 - 20
    expect(result.netProfitUsd).toBeCloseTo(8, 1); // (80/10000) * 1000 = 8
  });
});

describe('validateLiquidity', () => {
  it('returns sufficient for high volume', () => {
    const ask = makeSnapshot({ volume24h: 1_000_000, last: 100 });
    const bid = makeSnapshot({ volume24h: 1_000_000, last: 100 });
    const result = validateLiquidity(ask, bid, 1000);
    expect(result.sufficient).toBe(true);
    expect(result.availableUsd).toBeGreaterThan(0);
  });

  it('returns insufficient for low volume', () => {
    const ask = makeSnapshot({ volume24h: 1, last: 100 });
    const bid = makeSnapshot({ volume24h: 1, last: 100 });
    const result = validateLiquidity(ask, bid, 1000);
    expect(result.sufficient).toBe(false);
  });
});

describe('estimateSlippage', () => {
  it('returns non-negative slippage', () => {
    const ask = makeSnapshot({ volume24h: 1_000_000, last: 100 });
    const bid = makeSnapshot({ volume24h: 1_000_000, last: 100 });
    const result = estimateSlippage(1000, ask, bid);
    expect(result.expectedBps).toBeGreaterThanOrEqual(0);
    expect(result.worstCaseBps).toBeGreaterThanOrEqual(result.expectedBps);
  });
});

describe('calculateExpectedValue', () => {
  it('returns positive EV for high confidence', () => {
    const ev = calculateExpectedValue(10, 0.9, 5);
    expect(ev).toBeCloseTo(8.5, 1); // 0.9*10 - 0.1*5 = 9 - 0.5 = 8.5
  });

  it('returns negative EV for low confidence', () => {
    const ev = calculateExpectedValue(10, 0.3, 20);
    expect(ev).toBeLessThan(0); // 0.3*10 - 0.7*20 = 3 - 14 = -11
  });
});