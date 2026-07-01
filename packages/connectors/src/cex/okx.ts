/**
 * OKX REST connector — `packages/connectors/src/cex/okx.ts`.
 * Per docs/PHASE1.5_MARKET_INFRASTRUCTURE.md + docs/07_CONNECTOR_SPECIFICATION.md.
 *
 * Symbol mapping: CCXT-style "BTC/USDT" → OKX's "BTC-USDT" (dash separator).
 *
 * Endpoints used:
 *   GET /api/v5/market/ticker?instId=BTC-USDT              → ticker
 *   GET /api/v5/market/books?instId=BTC-USDT&sz=20         → L2 order book
 *   GET /api/v5/market/trades?instId=BTC-USDT&limit=50     → recent trades
 *   GET /api/v5/market/tickers?instType=SPOT               → all markets
 *   GET /api/v5/public/instruments?instType=SPOT           → instruments
 *   GET /api/v5/system/status                             → network status
 *
 * Auth: HMAC-SHA256 signing of `timestamp + method + requestPath + body`.
 * Sign and headers are injectable for tests.
 *
 * `fetchImpl`, `clock`, `sign` are all injectable. `OKX_LIVE=1` env
 * gates real network calls in the test runner.
 */

import type {
  Connector,
  ConnectorHealth,
  DiscoveredMarket,
  ExchangeInfo,
  FeeSchedule,
  Market,
  NetworkStatus,
  OrderBook,
  OrderBookLevel,
  PriceSnapshot,
  Trade,
  TradingPair,
} from '@nova-app/shared';

const OKX_INFO: ExchangeInfo = {
  code: 'okx',
  name: 'OKX',
  url: 'https://www.okx.com',
  rateLimitMs: 100,           // 10 RPS public endpoints
  takerFeeBps: 10,
  makerFeeBps: 8,
};

export interface OkxConnectorDeps {
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
  readonly sign?: (timestamp: string, method: 'GET' | 'POST', path: string, body: string) => string;
  readonly baseUrl?: string;
}

/** Convert "BTC/USDT" → "BTC-USDT" (OKX's format). */
export function toOkxSymbol(pair: TradingPair): string {
  return `${pair.base}-${pair.quote}`;
}

/** Convert "BTC-USDT" → "BTC/USDT". */
export function fromOkxSymbol(symbol: string): TradingPair | null {
  // OKX instruments: e.g. 'BTC-USDT', 'ETH-USDT', 'BTC-USD', 'ETH-BTC'.
  const parts = symbol.split('-');
  if (parts.length !== 2) return null;
  const [base, quote] = parts;
  if (!base || !quote) return null;
  return { base, quote };
}

interface OkxTickerData {
  instId: string;
  bid: string;
  bidSz: string;
  ask: string;
  askSz: string;
  last: string;
  vol24h: string;
}

interface OkxTickersResponse {
  code: string;
  msg: string;
  data: OkxTickerData[];
}

interface OkxBookData {
  bids: [string, string, string, string][];  // price, qty, _, _
  asks: [string, string, string, string][];
  ts: string;
}

interface OkxBookResponse {
  code: string;
  msg: string;
  data: OkxBookData[];
}

interface OkxTradeData {
  tradeId: string;
  px: string;
  sz: string;
  side: 'buy' | 'sell';
  ts: string;
}

interface OkxTradesResponse {
  code: string;
  msg: string;
  data: OkxTradeData[];
}

interface OkxStatusResponse {
  code: string;
  msg: string;
  data: Array<{
    state: string;        // 'normal' | 'maintenance' | 'cancel_only' | 'suspend'
    title: string;
    maintStart?: string;
    maintEnd?: string;
  }>;
}

/** Default sign function: HMAC-SHA256 with base64 (no real secret here, just stub). */
const defaultSign =
  (secret: string) =>
  (timestamp: string, _method: 'GET' | 'POST', _path: string, _body: string): string => {
    // Real implementation: crypto.createHmac('sha256', secret).update(...).digest('base64').
    // We do NOT import crypto here — that requires Node runtime. The test suite
    // overrides `sign` to verify the call shape. The real sign lives in
    // `@sentinel`'s crypto review in a follow-up.
    return `stub-sig-${secret.slice(0, 4)}-${timestamp}`;
  };

const safeJson = async <T>(res: Response): Promise<T | null> => {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

const safeFetch = async (
  f: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<Response | null> => {
  try {
    return await f(url, init);
  } catch {
    return null;
  }
};

export class OkxConnector implements Connector {
  readonly id = 'okx';
  readonly kind = 'cex' as const;
  readonly info = OKX_INFO;

  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private readonly sign: (timestamp: string, method: 'GET' | 'POST', path: string, body: string) => string;
  private readonly baseUrl: string;

  constructor(deps: OkxConnectorDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clock = deps.clock ?? Date.now;
    this.sign = deps.sign ?? defaultSign(process.env.OKX_API_SECRET ?? '');
    this.baseUrl = deps.baseUrl ?? 'https://www.okx.com';
  }

  // ── Discovery ──────────────────────────────────────────────────

  async fetchMarkets(): Promise<readonly Market[]> {
    const url = `${this.baseUrl}/api/v5/market/tickers?instType=SPOT`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return [];
    const body = await safeJson<OkxTickersResponse>(res);
    if (!body || body.code !== '0') return [];
    return body.data.map((d): Market => {
      // OKX instId is already the symbol
      const [base, quote] = d.instId.split('-');
      return {
        symbol: d.instId,
        base: base ?? '',
        quote: quote ?? '',
        status: 'active',
        minQty: null,
        minPrice: null,
        minNotional: null,
        pricePrecision: null,
        qtyPrecision: null,
      };
    });
  }

  async discoverAssets(): Promise<readonly DiscoveredMarket[]> {
    const markets = await this.fetchMarkets();
    const now = this.clock();
    return markets.map(
      (m): DiscoveredMarket => ({
        venue: this.info,
        symbol: m.symbol,
        base: m.base,
        quote: m.quote,
        status: m.status,
        firstSeenAt: now,
        lastObservedAt: now,
      }),
    );
  }

  // ── Pricing ────────────────────────────────────────────────────

  async fetchTicker(pair: TradingPair): Promise<PriceSnapshot | null> {
    const instId = toOkxSymbol(pair);
    const path = `/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`;
    const url = `${this.baseUrl}${path}`;
    const ts = String(this.clock() / 1000); // OKX uses seconds
    // OKX public endpoints do not require auth, but we still pass the sign
    // signature shape to be consistent with the auth interface.
    const _sig = this.sign(ts, 'GET', path, '');
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return null;
    const body = await safeJson<OkxTickersResponse>(res);
    if (!body || body.code !== '0' || body.data.length === 0) return null;
    const t = body.data[0]!;
    return {
      bid: Number(t.bid),
      ask: Number(t.ask),
      last: Number(t.last),
      volume24h: Number(t.vol24h),
      timestamp: this.clock(),
      venue: this.info,
      pair,
    };
  }

  async fetchOrderBook(pair: TradingPair, depth: number = 20): Promise<OrderBook | null> {
    const instId = toOkxSymbol(pair);
    const sz = Math.min(Math.max(depth, 1), 400);
    const path = `/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=${sz}`;
    const url = `${this.baseUrl}${path}`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return null;
    const body = await safeJson<OkxBookResponse>(res);
    if (!body || body.code !== '0' || body.data.length === 0) return null;
    const b = body.data[0]!;
    const toLevel = (l: [string, string, string, string]): OrderBookLevel => ({
      price: Number(l[0]),
      quantity: Number(l[1]),
    });
    return {
      bids: b.bids.map(toLevel),
      asks: b.asks.map(toLevel),
      timestamp: Number(b.ts) || this.clock(),
      venue: this.info,
      pair,
    };
  }

  async fetchTrades(pair: TradingPair, _sinceMs?: number): Promise<readonly Trade[]> {
    const instId = toOkxSymbol(pair);
    const path = `/api/v5/market/trades?instId=${encodeURIComponent(instId)}&limit=50`;
    const url = `${this.baseUrl}${path}`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return [];
    const body = await safeJson<OkxTradesResponse>(res);
    if (!body || body.code !== '0') return [];
    return body.data.map(
      (t): Trade => ({
        id: t.tradeId,
        price: Number(t.px),
        quantity: Number(t.sz),
        side: t.side,
        timestamp: Number(t.ts),
      }),
    );
  }

  // ── Cost ───────────────────────────────────────────────────────

  async fetchFees(): Promise<FeeSchedule> {
    // OKX default spot tier: 8 bps maker, 10 bps taker.
    return {
      makerFeeBps: this.info.makerFeeBps,
      takerFeeBps: this.info.takerFeeBps,
      withdrawalFees: {},
      venue: this.info,
      asOf: this.clock(),
    };
  }

  async fetchExchangeInfo(): Promise<ExchangeInfo> {
    return this.info;
  }

  // ── Health ─────────────────────────────────────────────────────

  async fetchNetworkStatus(): Promise<NetworkStatus> {
    const url = `${this.baseUrl}/api/v5/system/status`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) {
      return {
        status: 'maintenance',
        message: 'network unreachable',
        depositsEnabled: false,
        withdrawalsEnabled: false,
        tradingEnabled: false,
        maintenance: true,
        checkedAt: this.clock(),
        venue: this.info,
      };
    }
    const body = await safeJson<OkxStatusResponse>(res);
    if (!body || body.code !== '0' || body.data.length === 0) {
      return {
        status: 'degraded',
        message: body?.msg ?? 'unknown',
        depositsEnabled: false,
        withdrawalsEnabled: false,
        tradingEnabled: false,
        maintenance: true,
        checkedAt: this.clock(),
        venue: this.info,
      };
    }
    const s = body.data[0]!;
    const normal = s.state === 'normal';
    const maint = s.state === 'maintenance' || s.state === 'suspend';
    return {
      status: normal ? 'active' : maint ? 'maintenance' : 'degraded',
      message: s.title,
      depositsEnabled: normal,
      withdrawalsEnabled: normal,
      tradingEnabled: normal,
      maintenance: maint,
      checkedAt: this.clock(),
      venue: this.info,
    };
  }

  async health(): Promise<ConnectorHealth> {
    const url = `${this.baseUrl}/api/v5/system/status`;
    const started = this.clock();
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) {
      return {
        status: 'maintenance',
        latencyMs: this.clock() - started,
        checkedAt: this.clock(),
        lastError: 'network unreachable',
      };
    }
    return {
      status: res.ok ? 'active' : 'degraded',
      latencyMs: this.clock() - started,
      checkedAt: this.clock(),
    };
  }
}
