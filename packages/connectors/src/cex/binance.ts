/**
 * Binance REST connector — `packages/connectors/src/cex/binance.ts`.
 * Per docs/PHASE1.5_MARKET_INFRASTRUCTURE.md + docs/08_MARKET_DATA_ENGINE.md.
 *
 * Symbol mapping: CCXT-style "BTC/USDT" → Binance's "BTCUSDT" (no separator).
 *
 * Endpoints used:
 *   GET /api/v3/ticker/bookTicker?symbol=BTCUSDT       → ticker (top of book)
 *   GET /api/v3/ticker/24hr?symbol=BTCUSDT            → ticker + 24h volume
 *   GET /api/v3/depth?symbol=BTCUSDT&limit=20         → L2 order book
 *   GET /api/v3/trades?symbol=BTCUSDT                 → recent trades
 *   GET /api/v3/exchangeInfo                          → markets
 *   GET /api/v3/ping                                  → network health
 *
 * `fetchImpl` defaults to global `fetch`, but is injectable for tests.
 * `clock` is also injectable for deterministic timestamps.
 *
 * Real network calls are NOT exercised by the bundled test — the test
 * uses a mock fetchImpl. To exercise the live API, set BINANCE_LIVE=1
 * in the env when running this package's tests.
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

const BINANCE_INFO: ExchangeInfo = {
  code: 'binance',
  name: 'Binance',
  url: 'https://www.binance.com',
  rateLimitMs: 100,           // 10 RPS for /api/v3 public endpoints
  takerFeeBps: 10,
  makerFeeBps: 10,
};

export interface BinanceConnectorDeps {
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
  readonly baseUrl?: string;
}

/** Convert "BTC/USDT" (UI form) → "BTCUSDT" (Binance API form). */
export function toBinanceSymbol(pair: TradingPair): string {
  return `${pair.base}${pair.quote}`;
}

/** Convert "BTCUSDT" → "BTC/USDT" (used in test fixtures). */
export function fromBinanceSymbol(symbol: string): TradingPair | null {
  // Heuristic: split at common quote tokens. Binance has many quote
  // assets — we keep this minimal so the connector stays deterministic.
  const QUOTES = ['USDT', 'BUSD', 'USDC', 'FDUSD', 'BTC', 'ETH', 'TRY', 'EUR'];
  for (const q of QUOTES) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      return { base: symbol.slice(0, symbol.length - q.length), quote: q };
    }
  }
  return null;
}

interface BookTickerResponse {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

interface Ticker24hResponse {
  symbol: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
}

interface DepthResponse {
  bids: [string, string][];
  asks: [string, string][];
}

interface TradeResponse {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

interface ExchangeInfoResponse {
  symbols: Array<{
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: string;
    filters: Array<{
      filterType: string;
      minQty?: string;
      minPrice?: string;
      minNotional?: string;
      tickSize?: string;
      stepSize?: string;
    }>;
  }>;
}

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
): Promise<Response | null> => {
  try {
    return await f(url);
  } catch {
    return null;
  }
};

export class BinanceConnector implements Connector {
  readonly id = 'binance';
  readonly kind = 'cex' as const;
  readonly info = BINANCE_INFO;

  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private readonly baseUrl: string;

  constructor(deps: BinanceConnectorDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clock = deps.clock ?? Date.now;
    this.baseUrl = deps.baseUrl ?? 'https://api.binance.com';
  }

  // ── Discovery ──────────────────────────────────────────────────

  async fetchMarkets(): Promise<readonly Market[]> {
    const url = `${this.baseUrl}/api/v3/exchangeInfo`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return [];
    const body = await safeJson<ExchangeInfoResponse>(res);
    if (!body) return [];
    return body.symbols
      .filter((s) => s.status === 'TRADING' || s.status === 'HALT')
      .map((s): Market => {
        const minQty = s.filters.find((f) => f.filterType === 'LOT_SIZE')?.minQty;
        const minPrice = s.filters.find((f) => f.filterType === 'PRICE_FILTER')?.minPrice;
        const minNotional = s.filters.find((f) => f.filterType === 'NOTIONAL')?.minNotional;
        const tickSize = s.filters.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize;
        const stepSize = s.filters.find((f) => f.filterType === 'LOT_SIZE')?.stepSize;
        return {
          symbol: s.symbol,
          base: s.baseAsset,
          quote: s.quoteAsset,
          status: s.status === 'TRADING' ? 'active' : 'paused',
          minQty: minQty ? Number(minQty) : null,
          minPrice: minPrice ? Number(minPrice) : null,
          minNotional: minNotional ? Number(minNotional) : null,
          pricePrecision: tickSize ? Number(tickSize) : null,
          qtyPrecision: stepSize ? Number(stepSize) : null,
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
    const symbol = toBinanceSymbol(pair);
    const bookUrl = `${this.baseUrl}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;
    const bookRes = await safeFetch(this.fetchImpl, bookUrl);
    if (!bookRes) return null;
    const book = await safeJson<BookTickerResponse>(bookRes);
    if (!book) return null;
    const t24Url = `${this.baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
    const t24Res = await safeFetch(this.fetchImpl, t24Url);
    const t24 = t24Res ? await safeJson<Ticker24hResponse>(t24Res) : null;
    return {
      bid: Number(book.bidPrice),
      ask: Number(book.askPrice),
      last: t24 ? Number(t24.lastPrice) : (Number(book.bidPrice) + Number(book.askPrice)) / 2,
      volume24h: t24 ? Number(t24.volume) : 0,
      timestamp: this.clock(),
      venue: this.info,
      pair,
    };
  }

  async fetchOrderBook(pair: TradingPair, depth: number = 20): Promise<OrderBook | null> {
    const symbol = toBinanceSymbol(pair);
    const url = `${this.baseUrl}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${depth}`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return null;
    const body = await safeJson<DepthResponse>(res);
    if (!body) return null;
    const toLevel = (l: [string, string]): OrderBookLevel => ({
      price: Number(l[0]),
      quantity: Number(l[1]),
    });
    return {
      bids: body.bids.map(toLevel),
      asks: body.asks.map(toLevel),
      timestamp: this.clock(),
      venue: this.info,
      pair,
    };
  }

  async fetchTrades(pair: TradingPair, _sinceMs?: number): Promise<readonly Trade[]> {
    const symbol = toBinanceSymbol(pair);
    const url = `${this.baseUrl}/api/v3/trades?symbol=${encodeURIComponent(symbol)}`;
    const res = await safeFetch(this.fetchImpl, url);
    if (!res) return [];
    const body = await safeJson<TradeResponse[]>(res);
    if (!body) return [];
    return body.map(
      (t): Trade => ({
        id: String(t.id),
        price: Number(t.price),
        quantity: Number(t.qty),
        side: t.isBuyerMaker ? 'sell' : 'buy', // buyer-maker = taker sold
        timestamp: t.time,
      }),
    );
  }

  // ── Cost ───────────────────────────────────────────────────────

  async fetchFees(): Promise<FeeSchedule> {
    // Binance spot maker/taker is 10 bps each for default tier.
    return {
      makerFeeBps: this.info.makerFeeBps,
      takerFeeBps: this.info.takerFeeBps,
      withdrawalFees: {}, // per-asset; Phase 1.5+ will populate from /sapi/asset/assetDetail
      venue: this.info,
      asOf: this.clock(),
    };
  }

  async fetchExchangeInfo(): Promise<ExchangeInfo> {
    return this.info;
  }

  // ── Health ─────────────────────────────────────────────────────

  async fetchNetworkStatus(): Promise<NetworkStatus> {
    const url = `${this.baseUrl}/api/v3/ping`;
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
    return {
      status: res.ok ? 'active' : 'degraded',
      message: res.ok ? null : `HTTP ${res.status}`,
      depositsEnabled: res.ok,
      withdrawalsEnabled: res.ok,
      tradingEnabled: res.ok,
      maintenance: !res.ok,
      checkedAt: this.clock(),
      venue: this.info,
    };
  }

  async health(): Promise<ConnectorHealth> {
    const url = `${this.baseUrl}/api/v3/ping`;
    const started = this.clock();
    let res: Response;
    try {
      res = await this.fetchImpl(url);
    } catch (err) {
      return {
        status: 'maintenance',
        latencyMs: this.clock() - started,
        checkedAt: this.clock(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      status: res.ok ? 'active' : 'degraded',
      latencyMs: this.clock() - started,
      checkedAt: this.clock(),
    };
  }
}
