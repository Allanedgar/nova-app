/**
 * @nova-app/connectors — Binance REST connector tests.
 * Per docs/PHASE1.5_MARKET_INFRASTRUCTURE.md per-connector test policy:
 * offline-only, mocked fetchImpl, all 9 methods covered, all failure modes.
 */

import { describe, expect, it } from 'vitest';
import { BinanceConnector, fromBinanceSymbol, toBinanceSymbol } from '../cex/binance.js';

const pair = { base: 'BTC', quote: 'USDT' };

/** Helper: build a fake fetch that returns the given body for a given path. */
function fakeFetch(
  handler: (url: string) => { status?: number; body?: unknown; throwJson?: boolean } | { throw: Error },
): typeof fetch {
  return (async (url: string) => {
    const h = handler(url);
    if ('throw' in h) throw h.throw;
    const status = h.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: h.throwJson
        ? (async () => { throw new SyntaxError('Unexpected token in JSON'); })
        : (async () => h.body),
      text: async () => (typeof h.body === 'string' ? h.body : JSON.stringify(h.body)),
    } as Response;
  }) as unknown as typeof fetch;
}

const fixedClock = (() => {
  let n = 1_700_000_000_000;
  return () => (n += 5);
})();

describe('BinanceConnector symbol mapping', () => {
  it('round-trips UI ↔ Binance API form', () => {
    expect(toBinanceSymbol(pair)).toBe('BTCUSDT');
    expect(fromBinanceSymbol('BTCUSDT')).toEqual(pair);
  });

  it('handles USDC quote', () => {
    expect(toBinanceSymbol({ base: 'ETH', quote: 'USDC' })).toBe('ETHUSDC');
    expect(fromBinanceSymbol('ETHUSDC')).toEqual({ base: 'ETH', quote: 'USDC' });
  });

  it('returns null for unrecognized symbols', () => {
    expect(fromBinanceSymbol('XYZ123')).toBeNull();
  });
});

describe('BinanceConnector.fetchTicker (was fetchSnapshot)', () => {
  it('parses bookTicker + 24hr response', async () => {
    const f = fakeFetch((url) => {
      if (url.includes('bookTicker')) {
        return {
          body: { symbol: 'BTCUSDT', bidPrice: '60000.10', bidQty: '0.5', askPrice: '60000.20', askQty: '0.7' },
        };
      }
      if (url.includes('ticker/24hr')) {
        return { body: { symbol: 'BTCUSDT', lastPrice: '60000.15', volume: '1234.5', quoteVolume: '74070000' } };
      }
      return { status: 404, body: {} };
    });
    const c = new BinanceConnector({ fetchImpl: f, clock: fixedClock });
    const t = await c.fetchTicker(pair);
    expect(t).not.toBeNull();
    expect(t!.bid).toBeCloseTo(60000.10);
    expect(t!.ask).toBeCloseTo(60000.20);
    expect(t!.last).toBe(60000.15);
    expect(t!.volume24h).toBe(1234.5);
    expect(t!.timestamp).toBe(1_700_000_000_005);
  });

  it('falls back to mid when 24hr endpoint is down', async () => {
    const f = fakeFetch((url) => {
      if (url.includes('bookTicker')) {
        return { body: { symbol: 'BTCUSDT', bidPrice: '100', bidQty: '1', askPrice: '102', askQty: '1' } };
      }
      return { status: 503, body: {} };
    });
    const c = new BinanceConnector({ fetchImpl: f });
    const t = await c.fetchTicker(pair);
    expect(t).not.toBeNull();
    expect(t!.last).toBe(101); // mid of bid/ask
    expect(t!.volume24h).toBe(0);
  });

  it('returns null on 429 rate limit', async () => {
    const f = fakeFetch(() => ({ status: 429, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });

  it('returns null on network throw', async () => {
    const f: typeof fetch = (async () => { throw new TypeError('down'); }) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    const f = fakeFetch(() => ({ throwJson: true }));
    const c = new BinanceConnector({ fetchImpl: f });
    expect(await c.fetchTicker(pair)).toBeNull();
  });
});

describe('BinanceConnector.fetchOrderBook', () => {
  it('parses L2 depth response', async () => {
    const f = fakeFetch(() => ({
      body: {
        bids: [['60000.10', '0.5'], ['60000.00', '1.0']],
        asks: [['60000.20', '0.7'], ['60000.30', '2.0']],
      },
    }));
    const c = new BinanceConnector({ fetchImpl: f, clock: fixedClock });
    const ob = await c.fetchOrderBook(pair, 5);
    expect(ob).not.toBeNull();
    expect(ob!.bids).toHaveLength(2);
    expect(ob!.asks).toHaveLength(2);
    expect(ob!.bids[0]!.price).toBe(60000.10);
    expect(ob!.asks[0]!.price).toBe(60000.20);
  });

  it('returns null on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f });
    expect(await c.fetchOrderBook(pair)).toBeNull();
  });
});

describe('BinanceConnector.fetchTrades', () => {
  it('parses recent trades and maps isBuyerMaker to side', async () => {
    const f = fakeFetch(() => ({
      body: [
        { id: 1, price: '60000.10', qty: '0.5', time: 1, isBuyerMaker: false },
        { id: 2, price: '60000.05', qty: '0.3', time: 2, isBuyerMaker: true },
      ],
    }));
    const c = new BinanceConnector({ fetchImpl: f });
    const trades = await c.fetchTrades(pair);
    expect(trades).toHaveLength(2);
    expect(trades[0]!.side).toBe('buy');
    expect(trades[1]!.side).toBe('sell');
  });

  it('returns [] on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f });
    expect(await c.fetchTrades(pair)).toEqual([]);
  });
});

describe('BinanceConnector.fetchMarkets', () => {
  it('parses exchangeInfo response', async () => {
    const f = fakeFetch(() => ({
      body: {
        symbols: [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            status: 'TRADING',
            filters: [
              { filterType: 'LOT_SIZE', minQty: '0.00001', stepSize: '0.00001' },
              { filterType: 'PRICE_FILTER', minPrice: '0.01', tickSize: '0.01' },
              { filterType: 'NOTIONAL', minNotional: '10' },
            ],
          },
          {
            symbol: 'XYZUSDT',
            baseAsset: 'XYZ',
            quoteAsset: 'USDT',
            status: 'BREAK',
            filters: [],
          },
        ],
      },
    }));
    const c = new BinanceConnector({ fetchImpl: f });
    const markets = await c.fetchMarkets();
    expect(markets).toHaveLength(1); // BREAK filtered out
    expect(markets[0]!.symbol).toBe('BTCUSDT');
    expect(markets[0]!.minQty).toBe(0.00001);
    expect(markets[0]!.minNotional).toBe(10);
  });

  it('returns [] on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f });
    expect(await c.fetchMarkets()).toEqual([]);
  });
});

describe('BinanceConnector.discoverAssets', () => {
  it('returns a DiscoveredMarket per active market', async () => {
    const f = fakeFetch(() => ({
      body: {
        symbols: [
          { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', filters: [] },
        ],
      },
    }));
    const c = new BinanceConnector({ fetchImpl: f, clock: fixedClock });
    const d = await c.discoverAssets();
    expect(d).toHaveLength(1);
    expect(d[0]!.venue.code).toBe('binance');
    expect(d[0]!.firstSeenAt).toBeGreaterThan(0);
  });
});

describe('BinanceConnector.fetchFees', () => {
  it('returns the default-tier fee schedule', async () => {
    const c = new BinanceConnector({ clock: fixedClock });
    const f = await c.fetchFees();
    expect(f.makerFeeBps).toBe(10);
    expect(f.takerFeeBps).toBe(10);
    expect(f.venue.code).toBe('binance');
  });
});

describe('BinanceConnector.fetchExchangeInfo', () => {
  it('returns the static ExchangeInfo', async () => {
    const c = new BinanceConnector();
    const info = await c.fetchExchangeInfo();
    expect(info.code).toBe('binance');
    expect(info.takerFeeBps).toBe(10);
  });
});

describe('BinanceConnector.fetchNetworkStatus', () => {
  it('reports active + all-flags-on when ping returns 200', async () => {
    const f = fakeFetch(() => ({ status: 200, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f, clock: fixedClock });
    const ns = await c.fetchNetworkStatus();
    expect(ns.status).toBe('active');
    expect(ns.depositsEnabled).toBe(true);
    expect(ns.withdrawalsEnabled).toBe(true);
    expect(ns.tradingEnabled).toBe(true);
    expect(ns.maintenance).toBe(false);
  });

  it('reports maintenance when network is unreachable', async () => {
    const f: typeof fetch = (async () => { throw new TypeError('down'); }) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: f });
    const ns = await c.fetchNetworkStatus();
    expect(ns.status).toBe('maintenance');
    expect(ns.depositsEnabled).toBe(false);
    expect(ns.message).toBe('network unreachable');
  });

  it('reports degraded on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f });
    const ns = await c.fetchNetworkStatus();
    expect(ns.status).toBe('degraded');
    expect(ns.maintenance).toBe(true);
  });
});

describe('BinanceConnector.health', () => {
  it('reports active when ping returns 200', async () => {
    const f = fakeFetch(() => ({ status: 200, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f, clock: fixedClock });
    const h = await c.health();
    expect(h.status).toBe('active');
    expect(typeof h.latencyMs).toBe('number');
  });

  it('reports degraded on 5xx', async () => {
    const f = fakeFetch(() => ({ status: 503, body: {} }));
    const c = new BinanceConnector({ fetchImpl: f });
    expect((await c.health()).status).toBe('degraded');
  });

  it('reports maintenance with lastError when fetch throws', async () => {
    const f: typeof fetch = (async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    const c = new BinanceConnector({ fetchImpl: f });
    const h = await c.health();
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
