import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'binance', name: 'Binance', url: 'https://www.binance.com', rateLimitMs: 50, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();
export const toBinanceSymbol = toSymbol;
export function fromBinanceSymbol(symbol: string): { base: string; quote: string } | null {
  const s = symbol.toUpperCase();
  const quotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB'];
  for (const q of quotes) {
    if (s.endsWith(q) && s.length > q.length) {
      return { base: s.slice(0, s.length - q.length), quote: q };
    }
  }
  return null;
}

const extractDataArray = (b: unknown): unknown[] => { const r = b as Record<string, unknown>; return (r.data as unknown[]) ?? []; };

export class BinanceConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'binance', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.binance.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol, fromSymbol: fromBinanceSymbol,
      tickerPath: (s) => `/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v3/trades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v3/depth?symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v3/exchangeInfo`, statusPath: `/api/v3/ping`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractTicker: (b) => b,
      extractMarkets: (b) => { const r = b as Record<string, unknown>; return (r.symbols as unknown[]) ?? []; },
      extractTrades: (b) => Array.isArray(b) ? b : [],
    });
  }

  override async fetchTicker(pair: { base: string; quote: string }): Promise<import('@nova-app/shared').PriceSnapshot | null> {
    try {
      const symbol = this.toSymbol(pair);
      const bookUrl = `${this.baseUrl}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;
      const bookRes = await this.fetchImpl(bookUrl);
      if (!bookRes || !bookRes.ok) return null;
      const bookBody = await bookRes.json().catch(() => null);
      if (!bookBody) return null;
      const book = this.parseTicker(bookBody);
      if (!book) return null;

      const bidNum = Number(book.bid);
      const askNum = Number(book.ask);
      if (!Number.isFinite(bidNum) || !Number.isFinite(askNum) || bidNum <= 0 || askNum <= 0) return null;
      const mid = (bidNum + askNum) / 2;

      const dayUrl = `${this.baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
      const dayRes = await this.fetchImpl(dayUrl);
      let last = mid;
      let volume = '0';
      if (dayRes && dayRes.ok) {
        const dayBody = await dayRes.json().catch(() => null);
        if (dayBody) {
          const day = this.parseTicker(dayBody);
          if (day) { last = Number(day.last) || mid; volume = day.volume; }
        }
      }
      return { bid: bidNum, ask: askNum, last, volume24h: Number(volume), timestamp: this.clock(), venue: this.info, pair };
    } catch {
      return null;
    }
  }

  override async fetchTrades(pair: { base: string; quote: string }, _sinceMs?: number): Promise<readonly import('@nova-app/shared').Trade[]> {
    if (!this.tradesPath) return [];
    const symbol = this.toSymbol(pair);
    const url = `${this.baseUrl}${this.tradesPath(symbol)}`;
    const res = await this.fetchImpl(url);
    if (!res || !res.ok) return [];
    const body = await res.json().catch(() => null);
    if (!body) return [];
    const arr = this.extractTrades(body);
    return arr.map((raw: unknown): import('@nova-app/shared').Trade => {
      const rec = raw as Record<string, unknown>;
      const isBuyerMaker = Boolean(rec.isBuyerMaker);
      const side: 'buy' | 'sell' = isBuyerMaker ? 'sell' : 'buy';
      return { id: String(rec.id ?? 0), price: Number(rec.price ?? 0), quantity: Number(rec.qty ?? rec.quantity ?? 0), side, timestamp: Number(rec.time ?? 0) };
    });
  }

  override async fetchMarkets(): Promise<readonly import('@nova-app/shared').Market[]> {
    const url = `${this.baseUrl}${this.marketsPath}`;
    const res = await this.fetchImpl(url);
    if (!res || !res.ok) return [];
    const body = await res.json().catch(() => null);
    if (!body) return [];
    const arr = this.extractMarkets(body);
    const out: (import('@nova-app/shared').Market)[] = [];
    for (const raw of arr) {
      const rec = raw as Record<string, unknown>;
      const symbol = String(rec.symbol ?? '');
      if (!symbol) continue;
      const base = String(rec.baseAsset ?? '');
      const quote = String(rec.quoteAsset ?? '');
      const rawStatus = String(rec.status ?? '');
      if (rawStatus !== 'TRADING') continue;
      const filters = (rec.filters as unknown[]) ?? [];
      const getFilter = (type: string) => (filters.find((f) => (f as Record<string, unknown>).filterType === type) as Record<string, unknown> | undefined);
      const lot = getFilter('LOT_SIZE');
      const price = getFilter('PRICE_FILTER');
      const notional = getFilter('NOTIONAL');
      out.push({ symbol, base, quote, status: 'active', minQty: lot?.minQty != null ? Number(lot.minQty) : null, minPrice: price?.minPrice != null ? Number(price.minPrice) : null, minNotional: notional?.minNotional != null ? Number(notional.minNotional) : null, pricePrecision: null, qtyPrecision: null });
    }
    return out;
  }

  override async health(): Promise<import('@nova-app/shared').ConnectorHealth> {
    try {
      const url = `${this.baseUrl}${this.statusPath}`;
      const started = this.clock();
      const res = await this.fetchImpl(url);
      if (!res) return { status: 'maintenance', latencyMs: this.clock() - started, checkedAt: this.clock(), lastError: 'network unreachable' };
      if (!res.ok) return { status: 'degraded', latencyMs: this.clock() - started, checkedAt: this.clock() };
      return { status: 'active', latencyMs: this.clock() - started, checkedAt: this.clock() };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'network unreachable';
      return { status: 'maintenance', latencyMs: 0, checkedAt: this.clock(), lastError: msg };
    }
  }
}