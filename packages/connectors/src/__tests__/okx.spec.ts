/**
 * @nova-app/connectors — OKX REST connector tests.
 * Per docs/PHASE1.5_MARKET_INFRASTRUCTURE.md per-connector test policy:
 * offline-only, mocked fetchImpl, all 9 methods covered, all failure modes.
 */

import { describe, expect, it, vi } from 'vitest';
import { OkxConnector, fromOkxSymbol, toOkxSymbol } from '../cex/okx.js';

const pair = { base: 'BTC', quote: 'USDT' };

function fakeFetch(
  handler: (url: string, init?: RequestInit) => { status?: number; body?: unknown; throwJson?: boolean } | { throw: Error },
): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const h = handler(url, init);
    if ('throw' in h) throw h.throw;
    const status = h.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: h.throwJson
        ? (async () => { throw new SyntaxError('Unexpected token'); })
        : (async () => h.body),
      text: async () => (typeof h.body === 'string' ? h.body : JSON.stringify(h.body)),
    } as Response;
  }) as unknown as typeof fetch;
}

const fixedClock = (() => {
  let n = 1_700_000_000_000;
  return () => (n += 5);
})();

describe('OkxConnector symbol mapping', () => {
  it('round-trips UI ↔ OKX API form', () => {
    expect(toOkxSymbol(pair)).toBe('BTC-USDT');
    expect(fromOkxSymbol('BTC-USDT')).toEqual(pair);
  });

  it('handles ETH-BTC pair', () => {
    expect(toOkxSymbol({ base: 'ETH', quote: 'BTC' })).toBe('ETH-BTC');
    expect(fromOkxSymbol('ETH-BTC')).toEqual({ base: 'ETH', quote: 'BTC' });
  });

  it('returns null for malformed symbols', () => {
    expect(fromOkxSymbol('BTCUSDT')).toBeNull();
    expect(fromOkxSymbol('BTC-USD-T')).toBeNull();
  });
});

describe('OkxConnector.fetchTicker', () => {
  it('parses OKX ticker response', async () => {
    const f = fakeFetch(() => ({
      body: {
        code: '0',
        msg: '',
        data: [{
          instId: 'BTC-USDT',
          bid: '60000.10',
          bidSz: '0.5',
          ask: '60000.20',
          askSz: '0.7',
          last: '60000.15',
          vol24h: '1234.5',
        }],
      },
    }));
    const c = new OkxConnector({ fetchImpl: f, clock: fixedClock });
    const t = await c.fetchTicker(pair);
    expect(t).not.toBeNull();
    expect(t!.bid).toBe(60000.10);
    expect(t!.ask).toBe(60000.20);
    expect(t!.last).toBe(60000.15);
    expect(t!.volume24h).toBe(1234.5);
  });

  it('returns null when OKX code != 0 (auth or rate limit)', async () => {
    const f = fakeFetch(() => ({
      body: { code: '50011', msg: 'Too Many Requests', data: [] },
    }));
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });

  it('returns null on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });

  it('returns null on network throw', async () => {
    const f: typeof fetch = (async () => { throw new TypeError('down'); }) as unknown as typeof fetch;
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    const f = fakeFetch(() => ({ throwJson: true }));
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });

  it('invokes the sign() function for the request', async () => {
    const signSpy = vi.fn().mockReturnValue('fake-sig');
    const f = fakeFetch(() => ({
      body: { code: '0', msg: '', data: [{ instId: 'BTC-USDT', bid: '1', bidSz: '1', ask: '2', askSz: '1', last: '1.5', vol24h: '0' }] },
    }));
    const c = new OkxConnector({ fetchImpl: f, clock: fixedClock, sign: signSpy });
    await c.fetchTicker(pair);
    expect(signSpy).toHaveBeenCalledOnce();
    const [timestamp, method, path, body] = signSpy.mock.calls[0]!;
    expect(typeof timestamp).toBe('string');
    expect(method).toBe('GET');
    expect(path).toBe('/api/v5/market/ticker?instId=BTC-USDT');
    expect(body).toBe('');
  });
});

describe('OkxConnector.fetchOrderBook', () => {
  it('parses L2 book response', async () => {
    const f = fakeFetch(() => ({
      body: {
        code: '0',
        msg: '',
        data: [{
          bids: [['60000.10', '0.5', '0', '1'], ['60000.00', '1.0', '0', '1']],
          asks: [['60000.20', '0.7', '0', '1'], ['60000.30', '2.0', '0', '1']],
          ts: '1700000000000',
        }],
      },
    }));
    const c = new OkxConnector({ fetchImpl: f });
    const ob = await c.fetchOrderBook(pair, 5);
    expect(ob).not.toBeNull();
    expect(ob!.bids).toHaveLength(2);
    expect(ob!.asks).toHaveLength(2);
    expect(ob!.bids[0]!.price).toBe(60000.10);
    expect(ob!.asks[0]!.price).toBe(60000.20);
    expect(ob!.timestamp).toBe(1_700_000_000_000);
  });

  it('clamps depth to OKX max (400)', async () => {
    let observedUrl = '';
    const f: typeof fetch = (async (url: string) => {
      observedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: '0', msg: '', data: [{ bids: [], asks: [], ts: '0' }] }),
      } as Response;
    }) as unknown as typeof fetch;
    const c = new OkxConnector({ fetchImpl: f });
    await c.fetchOrderBook(pair, 9999);
    expect(observedUrl).toContain('sz=400');
  });

  it('returns null on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchOrderBook(pair)).toBeNull();
  });
});

describe('OkxConnector.fetchTrades', () => {
  it('parses recent trades and preserves side', async () => {
    const f = fakeFetch(() => ({
      body: {
        code: '0',
        msg: '',
        data: [
          { tradeId: '1', px: '60000.10', sz: '0.5', side: 'buy', ts: '1700000000000' },
          { tradeId: '2', px: '60000.05', sz: '0.3', side: 'sell', ts: '1700000001000' },
        ],
      },
    }));
    const c = new OkxConnector({ fetchImpl: f });
    const trades = await c.fetchTrades(pair);
    expect(trades).toHaveLength(2);
    expect(trades[0]!.side).toBe('buy');
    expect(trades[1]!.side).toBe('sell');
  });

  it('returns [] on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchTrades(pair)).toEqual([]);
  });
});

describe('OkxConnector.fetchMarkets', () => {
  it('parses tickers?instType=SPOT', async () => {
    const f = fakeFetch(() => ({
      body: {
        code: '0',
        msg: '',
        data: [
          { instId: 'BTC-USDT', bid: '1', bidSz: '1', ask: '2', askSz: '1', last: '1.5', vol24h: '0' },
          { instId: 'ETH-USDT', bid: '2', bidSz: '1', ask: '3', askSz: '1', last: '2.5', vol24h: '0' },
        ],
      },
    }));
    const c = new OkxConnector({ fetchImpl: f });
    const markets = await c.fetchMarkets();
    expect(markets).toHaveLength(2);
    expect(markets[0]!.symbol).toBe('BTC-USDT');
    expect(markets[0]!.base).toBe('BTC');
    expect(markets[0]!.quote).toBe('USDT');
  });

  it('returns [] when OKX code != 0', async () => {
    const f = fakeFetch(() => ({ body: { code: '50011', msg: 'rate limit', data: [] } }));
    const c = new OkxConnector({ fetchImpl: f });
    expect(await c.fetchMarkets()).toEqual([]);
  });
});

describe('OkxConnector.discoverAssets', () => {
  it('returns DiscoveredMarket per market', async () => {
    const f = fakeFetch(() => ({
      body: {
        code: '0',
        msg: '',
        data: [{ instId: 'BTC-USDT', bid: '1', bidSz: '1', ask: '2', askSz: '1', last: '1.5', vol24h: '0' }],
      },
    }));
    const c = new OkxConnector({ fetchImpl: f, clock: fixedClock });
    const d = await c.discoverAssets();
    expect(d).toHaveLength(1);
    expect(d[0]!.venue.code).toBe('okx');
  });
});

describe('OkxConnector.fetchFees', () => {
  it('returns the default-tier schedule', async () => {
    const c = new OkxConnector({ clock: fixedClock });
    const f = await c.fetchFees();
    expect(f.makerFeeBps).toBe(8);
    expect(f.takerFeeBps).toBe(10);
    expect(f.venue.code).toBe('okx');
  });
});

describe('OkxConnector.fetchExchangeInfo', () => {
  it('returns the static ExchangeInfo', async () => {
    const c = new OkxConnector();
    const info = await c.fetchExchangeInfo();
    expect(info.code).toBe('okx');
    expect(info.url).toBe('https://www.okx.com');
  });
});

describe('OkxConnector.fetchNetworkStatus', () => {
  it('reports active when state=normal', async () => {
    const f = fakeFetch(() => ({
      body: { code: '0', msg: '', data: [{ state: 'normal', title: 'Operational' }] },
    }));
    const c = new OkxConnector({ fetchImpl: f, clock: fixedClock });
    const ns = await c.fetchNetworkStatus();
    expect(ns.status).toBe('active');
    expect(ns.depositsEnabled).toBe(true);
    expect(ns.maintenance).toBe(false);
  });

  it('reports maintenance when state=maintenance', async () => {
    const f = fakeFetch(() => ({
      body: { code: '0', msg: '', data: [{ state: 'maintenance', title: 'Scheduled maintenance' }] },
    }));
    const c = new OkxConnector({ fetchImpl: f });
    const ns = await c.fetchNetworkStatus();
    expect(ns.status).toBe('maintenance');
    expect(ns.maintenance).toBe(true);
  });

  it('reports maintenance when network is unreachable', async () => {
    const f: typeof fetch = (async () => { throw new TypeError('down'); }) as unknown as typeof fetch;
    const c = new OkxConnector({ fetchImpl: f });
    const ns = await c.fetchNetworkStatus();
    expect(ns.status).toBe('maintenance');
    expect(ns.message).toBe('network unreachable');
  });
});

describe('OkxConnector.health', () => {
  it('reports active on 200', async () => {
    const f = fakeFetch(() => ({ body: { code: '0', msg: '', data: [{ state: 'normal', title: '' }] } }));
    const c = new OkxConnector({ fetchImpl: f, clock: fixedClock });
    const h = await c.health();
    expect(h.status).toBe('active');
  });

  it('reports degraded on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new OkxConnector({ fetchImpl: f });
    expect((await c.health()).status).toBe('degraded');
  });

  it('reports maintenance with lastError when fetch throws', async () => {
    const f: typeof fetch = (async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    const c = new OkxConnector({ fetchImpl: f });
    const h = await c.health();
    expect(h.status).toBe('maintenance');
    expect(h.lastError).toBe('network unreachable');
  });
});

describe('OkxConnector metadata', () => {
  it('exposes the correct Connector contract', () => {
    const c = new OkxConnector();
    expect(c.id).toBe('okx');
    expect(c.kind).toBe('cex');
    expect(c.info.code).toBe('okx');
    expect(c.info.takerFeeBps).toBe(10);
    expect(c.info.makerFeeBps).toBe(8);
  });
});
