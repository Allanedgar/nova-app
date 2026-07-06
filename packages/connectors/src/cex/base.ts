/**
 * BaseCexConnector — shared implementation for all REST CEX connectors.
 * Each connector provides paths, parsers, and optional response extractors.
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
} from '@nova-app/shared';

export interface BaseCexDeps {
  readonly info: ExchangeInfo;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
  readonly baseUrl: string;
  readonly toSymbol: (pair: { base: string; quote: string }) => string;
  readonly fromSymbol?: (symbol: string) => { base: string; quote: string } | null;
  readonly tickerPath: (symbol: string) => string;
  readonly tradesPath?: (symbol: string) => string;
  readonly obPath: (symbol: string, depth: number) => string;
  readonly marketsPath: string;
  readonly statusPath: string;
  readonly parseTicker: (raw: unknown) => { bid: string; ask: string; last: string; volume: string } | null;
  readonly parseOB: (raw: unknown) => { bids: [string, string][]; asks: [string, string][] } | null;
  readonly parseTrade: (raw: unknown) => { id: string; price: string; qty: string; side: 'buy' | 'sell'; ts: number } | null;
  readonly parseMarket: (raw: unknown) => { symbol: string; base: string; quote: string; status: string } | null;
  /** Extract the array of market items from the API response body. Default: body.data ?? body */
  readonly extractMarkets?: (body: unknown) => unknown[];
  /** Extract the ticker object from the API response body. Default: body */
  readonly extractTicker?: (body: unknown) => unknown;
  /** Extract the order book object from the API response body. Default: body */
  readonly extractOB?: (body: unknown) => unknown;
  /** Extract the trades array from the API response body. Default: body.data ?? body */
  readonly extractTrades?: (body: unknown) => unknown[];
  /** Extract the network status object from the API response body. Default: body */
  readonly extractStatus?: (body: unknown) => unknown;
  /** Maximum time for each HTTP attempt before the venue is treated as unreachable. */
  readonly requestTimeoutMs?: number;
}

const safeJson = async <T>(res: Response): Promise<T | null> => {
  if (!res.ok) return null;
  try { return (await res.json()) as T; } catch { return null; }
};
const safeFetch = async (f: typeof fetch, url: string, timeoutMs: number): Promise<Response | null> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await f(url, { signal: controller.signal });
    } catch (e) {
      lastError = e;
      if (attempt >= 2) break;
      await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
};

const defaultExtractArray = (body: unknown): unknown[] =>
  Array.isArray((body as Record<string, unknown>).data)
    ? ((body as Record<string, unknown>).data as unknown[])
    : Array.isArray(body)
      ? (body as unknown[])
      : [];

const defaultExtractSingle = (body: unknown): unknown => body;

// Shared parsers with broad field-name fallback chains
export const parsers = {
  ticker: (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    return {
      bid: String(rec.best_bid ?? rec.bid ?? rec.bid1Price ?? rec.bidPrice ?? rec.b ?? 0),
      ask: String(rec.best_ask ?? rec.ask ?? rec.ask1Price ?? rec.askPrice ?? rec.a ?? 0),
      last: String(rec.last ?? rec.lastPrice ?? rec.price ?? rec.c ?? 0),
      volume: String(rec.base_volume ?? rec.volume ?? rec.volume24h ?? rec.vol24h ?? rec.v ?? 0),
    };
  },
  ob: (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return { bids: [], asks: [] };
    const rec = raw as Record<string, unknown>;
    const toTuple = (arr: unknown): [string, string][] =>
      Array.isArray(arr) ? arr.map((x: unknown) => [String((x as [unknown, unknown])[0] ?? ''), String((x as [unknown, unknown])[1] ?? '')]) : [];
    return {
      bids: toTuple(rec.bids ?? rec.b ?? []),
      asks: toTuple(rec.asks ?? rec.a ?? []),
    };
  },
  trade: (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const sideRaw = String(rec.side ?? rec.S ?? 'buy');
    const side: 'buy' | 'sell' = sideRaw === 'sell' ? 'sell' : 'buy';
    return {
      id: String(rec.id ?? rec.trade_id ?? rec.i ?? 0),
      price: String(rec.price ?? rec.p ?? 0),
      qty: String(rec.amount ?? rec.qty ?? rec.v ?? 0),
      side,
      ts: Number(rec.time ?? rec.T ?? rec.create_time_ms ?? 0),
    };
  },
  market: (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return null;
    const rec = raw as Record<string, unknown>;
    const symbol = String(rec.id ?? rec.symbol ?? rec.product_id ?? rec.instId ?? rec.currency_pair ?? rec.pair ?? '');
    let base = String(rec.base ?? rec.baseCoin ?? rec.baseAsset ?? rec.base_name ?? rec.base_currency ?? '');
    let quote = String(rec.quote ?? rec.quoteCoin ?? rec.quoteAsset ?? rec.quote_name ?? rec.quote_currency ?? '');
    if ((!base || !quote) && symbol.includes('-')) {
      const parts = symbol.split('-');
      if (parts.length === 2) { base = parts[0]!; quote = parts[1]!; }
    }
    return {
      symbol,
      base,
      quote,
      status: String(rec.status ?? rec.trade_status ?? rec.enableTrading ?? rec.state ?? 'active'),
    };
  },
};

export class BaseCexConnector implements Connector {
  readonly id: string;
  readonly kind = 'cex' as const;
  readonly info: ExchangeInfo;

  protected readonly fetchImpl: typeof fetch;
  protected readonly clock: () => number;
  protected readonly baseUrl: string;
  protected readonly toSymbol: (pair: { base: string; quote: string }) => string;
  protected readonly fromSymbol?: (symbol: string) => { base: string; quote: string } | null;
  protected readonly tickerPath: (symbol: string) => string;
  protected readonly tradesPath?: (symbol: string) => string;
  protected readonly obPath: (symbol: string, depth: number) => string;
  protected readonly marketsPath: string;
  protected readonly statusPath: string;
  protected readonly parseTicker: (raw: unknown) => { bid: string; ask: string; last: string; volume: string } | null;
  protected readonly parseOB: (raw: unknown) => { bids: [string, string][]; asks: [string, string][] } | null;
  protected readonly parseTrade: (raw: unknown) => { id: string; price: string; qty: string; side: 'buy' | 'sell'; ts: number } | null;
  protected readonly parseMarket: (raw: unknown) => { symbol: string; base: string; quote: string; status: string } | null;
  protected readonly extractMarkets: (body: unknown) => unknown[];
  protected readonly extractTicker: (body: unknown) => unknown;
  protected readonly extractOB: (body: unknown) => unknown;
  protected readonly extractTrades: (body: unknown) => unknown[];
  protected readonly extractStatus: (body: unknown) => unknown;
  protected readonly requestTimeoutMs: number;

  constructor(deps: BaseCexDeps & { id: string }) {
    this.id = deps.id;
    this.info = deps.info;
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clock = deps.clock ?? Date.now;
    this.baseUrl = deps.baseUrl;
    this.toSymbol = deps.toSymbol;
    this.fromSymbol = deps.fromSymbol;
    this.tickerPath = deps.tickerPath;
    this.tradesPath = deps.tradesPath;
    this.obPath = deps.obPath;
    this.marketsPath = deps.marketsPath;
    this.statusPath = deps.statusPath;
    this.parseTicker = deps.parseTicker;
    this.parseOB = deps.parseOB;
    this.parseTrade = deps.parseTrade;
    this.parseMarket = deps.parseMarket;
    this.extractMarkets = deps.extractMarkets ?? defaultExtractArray;
    this.extractTicker = deps.extractTicker ?? defaultExtractSingle;
    this.extractOB = deps.extractOB ?? defaultExtractSingle;
    this.extractTrades = deps.extractTrades ?? defaultExtractArray;
    this.extractStatus = deps.extractStatus ?? defaultExtractSingle;
    this.requestTimeoutMs = deps.requestTimeoutMs ?? 1_500;
  }

  async fetchMarkets(): Promise<readonly Market[]> {
    const url = `${this.baseUrl}${this.marketsPath}`;
    const res = await safeFetch(this.fetchImpl, url, this.requestTimeoutMs);
    if (!res) return [];
    const body = await safeJson<unknown>(res);
    if (!body) return [];
    const arr = this.extractMarkets(body);
    const out: Market[] = [];
    for (const raw of arr) {
      const p = this.parseMarket(raw);
      if (!p) continue;
      const isActive = p.status === 'active' || p.status === 'online' || p.status === 'TRADING' || p.status === 'trading' || p.status === 'enabled';
      out.push({ symbol: p.symbol, base: p.base, quote: p.quote, status: isActive ? 'active' : 'paused', minQty: null, minPrice: null, minNotional: null, pricePrecision: null, qtyPrecision: null });
    }
    return out;
  }

  async discoverAssets(): Promise<readonly DiscoveredMarket[]> {
    const markets = await this.fetchMarkets();
    const now = this.clock();
    return markets.map((m): DiscoveredMarket => ({ venue: this.info, symbol: m.symbol, base: m.base, quote: m.quote, status: m.status, firstSeenAt: now, lastObservedAt: now }));
  }

  async fetchTicker(pair: { base: string; quote: string }): Promise<PriceSnapshot | null> {
    const symbol = this.toSymbol(pair);
    const url = `${this.baseUrl}${this.tickerPath(symbol)}`;
    const res = await safeFetch(this.fetchImpl, url, this.requestTimeoutMs);
    if (!res) return null;
    const body = await safeJson<unknown>(res);
    if (!body) return null;
    const p = this.parseTicker(this.extractTicker(body));
    if (!p) return null;
    return { bid: Number(p.bid), ask: Number(p.ask), last: Number(p.last), volume24h: Number(p.volume), timestamp: this.clock(), venue: this.info, pair: { base: pair.base, quote: pair.quote } };
  }

  async fetchOrderBook(pair: { base: string; quote: string }, depth: number = 20): Promise<OrderBook | null> {
    const symbol = this.toSymbol(pair);
    const url = `${this.baseUrl}${this.obPath(symbol, depth)}`;
    const res = await safeFetch(this.fetchImpl, url, this.requestTimeoutMs);
    if (!res) return null;
    const body = await safeJson<unknown>(res);
    if (!body) return null;
    const extracted = this.extractOB(body);
    const p = this.parseOB(extracted);
    if (!p) return null;
    const toLevel = (l: [string, string]): OrderBookLevel => ({ price: Number(l[0]), quantity: Number(l[1]) });
    return { bids: p.bids.map(toLevel), asks: p.asks.map(toLevel), timestamp: this.clock(), venue: this.info, pair: { base: pair.base, quote: pair.quote } };
  }

  async fetchTrades(pair: { base: string; quote: string }, _sinceMs?: number): Promise<readonly Trade[]> {
    if (!this.tradesPath) return [];
    const symbol = this.toSymbol(pair);
    const url = `${this.baseUrl}${this.tradesPath(symbol)}`;
    const res = await safeFetch(this.fetchImpl, url, this.requestTimeoutMs);
    if (!res) return [];
    const body = await safeJson<unknown>(res);
    if (!body) return [];
    const arr = this.extractTrades(body);
    return arr.map((raw: unknown): Trade => {
      const t = this.parseTrade(raw);
      if (!t) return { id: '', price: 0, quantity: 0, side: 'buy', timestamp: 0 };
      return { id: t.id, price: Number(t.price), quantity: Number(t.qty), side: t.side, timestamp: t.ts };
    }).filter((t: Trade) => t.id !== '');
  }

  async fetchFees(): Promise<FeeSchedule> {
    return { makerFeeBps: this.info.makerFeeBps, takerFeeBps: this.info.takerFeeBps, withdrawalFees: {}, venue: this.info, asOf: this.clock() };
  }

  async fetchExchangeInfo(): Promise<ExchangeInfo> {
    return this.info;
  }

  async fetchNetworkStatus(): Promise<NetworkStatus> {
    const url = `${this.baseUrl}${this.statusPath}`;
    const res = await safeFetch(this.fetchImpl, url, this.requestTimeoutMs);
    if (!res) return { status: 'maintenance', message: 'network unreachable', depositsEnabled: false, withdrawalsEnabled: false, tradingEnabled: false, maintenance: true, checkedAt: this.clock(), venue: this.info };
    const ok = res.ok;
    return { status: ok ? 'active' : 'degraded', message: ok ? null : `HTTP ${res.status}`, depositsEnabled: ok, withdrawalsEnabled: ok, tradingEnabled: ok, maintenance: !ok, checkedAt: this.clock(), venue: this.info };
  }

  async health(): Promise<ConnectorHealth> {
    const url = `${this.baseUrl}${this.statusPath}`;
    const started = this.clock();
    const res = await safeFetch(this.fetchImpl, url, this.requestTimeoutMs);
    if (!res) return { status: 'maintenance', latencyMs: this.clock() - started, checkedAt: this.clock(), lastError: 'network unreachable' };
    return { status: res.ok ? 'active' : 'degraded', latencyMs: this.clock() - started, checkedAt: this.clock() };
  }
}
