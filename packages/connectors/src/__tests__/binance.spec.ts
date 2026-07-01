/**
 * @nova-app/connectors — Binance REST connector tests.
 * Per docs/08_MARKET_DATA_ENGINE.md §5.1 acceptance criteria.
 */

import { describe, expect, it } from 'vitest';
import { BinanceConnector, fromBinanceSymbol, toBinanceSymbol } from '../cex/binance.js';

describe('BinanceConnector symbol mapping', () => {
  it('round-trips UI ↔ Binance API form', () => {
    const uiForm = { base: 'BTC', quote: 'USDT' };
    expect(toBinanceSymbol(uiForm)).toBe('BTCUSDT');
    expect(fromBinanceSymbol('BTCUSDT')).toEqual(uiForm);
  });

  it('handles USDC quote', () => {
    expect(toBinanceSymbol({ base: 'ETH', quote: 'USDC' })).toBe('ETHUSDC');
    expect(fromBinanceSymbol('ETHUSDC')).toEqual({ base: 'ETH', quote: 'USDC' });
  });

  it('returns null for unrecognized symbols', () => {
    expect(fromBinanceSymbol('XYZ123')).toBeNull();
  });
});

describe('BinanceConnector.fetchSnapshot', () => {
  it('parses a bookTicker response', async () => {
    const fakeFetch = (async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        symbol: 'BTCUSDT',
        bidPrice: '60000.10',
        bidQty: '0.5',
        askPrice: '60000.20',
        askQty: '0.7',
      }),
    })) as unknown as typeof fetch;

    const c = new BinanceConnector({ fetchImpl: fakeFetch, clock: () => 1_700_000_000_000 });
    const snap = await c.fetchSnapshot({ base: 'BTC', quote: 'USDT' });
    expect(snap).not.toBeNull();
    expect(snap!.bid).toBeCloseTo(60000.10);
    expect(snap!.ask).toBeCloseTo(60000.20);
    expect(snap!.bidQty).toBe(0.5);
    expect(snap!.askQty).toBe(0.7);
    expect(snap!.timestamp).toBe(1_700_000_000_000);
    expect(snap!.venue.code).toBe('binance');
  });

  it('returns null on non-2xx response (rate-limit, 5xx, …)', async () => {
    const fakeFetch = (async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: fakeFetch });
    expect(await c.fetchSnapshot({ base: 'BTC', quote: 'USDT' })).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fakeFetch = (async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: fakeFetch });
    expect(await c.fetchSnapshot({ base: 'BTC', quote: 'USDT' })).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    const fakeFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('unexpected token');
      },
    })) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: fakeFetch });
    expect(await c.fetchSnapshot({ base: 'BTC', quote: 'USDT' })).toBeNull();
  });
});

describe('BinanceConnector.fetchHealth', () => {
  it('reports active when ping returns 200', async () => {
    const fakeFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: fakeFetch });
    const h = await c.fetchHealth();
    expect(h.status).toBe('active');
    expect(typeof h.latencyMs).toBe('number');
    expect(h.lastError).toBeUndefined();
  });

  it('reports degraded on 5xx', async () => {
    const fakeFetch = (async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: fakeFetch });
    expect((await c.fetchHealth()).status).toBe('degraded');
  });

  it('reports maintenance with lastError when fetch throws', async () => {
    const fakeFetch = (async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: fakeFetch });
    const h = await c.fetchHealth();
    expect(h.status).toBe('maintenance');
    expect(h.lastError).toBe('boom');
  });
});

describe('BinanceConnector metadata', () => {
  it('exposes the correct Connector contract', () => {
    const c = new BinanceConnector();
    expect(c.id).toBe('binance');
    expect(c.kind).toBe('cex');
    expect(c.info.code).toBe('binance');
    expect(c.info.takerFeeBps).toBe(10);
    expect(c.info.makerFeeBps).toBe(10);
  });
});
