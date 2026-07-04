import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'okx', name: 'OKX', url: 'https://www.okx.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 8 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}-${p.quote}`.toUpperCase();
export const toOkxSymbol = toSymbol;
export function fromOkxSymbol(symbol: string): { base: string; quote: string } | null {
  const parts = symbol.split('-');
  return parts.length === 2 && parts[0] && parts[1] ? { base: parts[0], quote: parts[1] } : null;
}

const extractData = (b: unknown): Record<string, unknown> => { const r = b as Record<string, unknown>; return (r.data as Record<string, unknown>) ?? r; };
const extractDataArray = (b: unknown): unknown[] => { const r = b as Record<string, unknown>; return (r.data as unknown[]) ?? []; };

const okxParseTicker = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  return {
    bid: String(rec.best_bid ?? rec.bid ?? rec.bid1Price ?? rec.bidPrice ?? rec.b ?? 0),
    ask: String(rec.best_ask ?? rec.ask ?? rec.ask1Price ?? rec.askPrice ?? rec.a ?? 0),
    last: String(rec.last ?? rec.lastPrice ?? rec.price ?? rec.c ?? 0),
    volume: String(rec.base_volume ?? rec.volume ?? rec.volume24h ?? rec.vol24h ?? rec.v ?? 0),
  };
};

export class OkxConnector extends BaseCexConnector {
  #sign?: (ts: string, method: string, path: string, body: string) => string;

  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string; sign?: (ts: string, method: string, path: string, body: string) => string }) {
    super({
      id: 'okx', info: INFO, baseUrl: deps?.baseUrl ?? 'https://www.okx.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol, fromSymbol: fromOkxSymbol,
      tickerPath: (s) => `/api/v5/market/ticker?instId=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v5/market/history-trades?instId=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v5/market/books?instId=${encodeURIComponent(s)}&sz=${d}`,
      marketsPath: `/api/v5/public/instruments?instType=SPOT`,
      statusPath: `/api/v5/system/time`,
      parseTicker: okxParseTicker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: extractDataArray,
      extractTicker: (b) => { const arr = extractDataArray(b); return arr[0] ?? b; },
      extractOB: (b) => { const r = extractData(b); const key = (Object.keys(r)[0] ?? 'data') as string; return (r[key] ?? b) as Record<string, unknown>; },
      extractTrades: extractDataArray,
    });
    this.#sign = deps?.sign;
  }

  override async fetchTicker(pair: { base: string; quote: string }): Promise<import('@nova-app/shared').PriceSnapshot | null> {
    try {
      const symbol = this.toSymbol(pair);
      const urlPath = this.tickerPath(symbol);
      const url = this.#sign
        ? `${this.baseUrl}${urlPath}&X-BK-Api-Key=${encodeURIComponent(this.#sign(String(Math.floor(Date.now() / 1000)), 'GET', urlPath, ''))}`
        : `${this.baseUrl}${urlPath}`;
      const res = await this.fetchImpl(url);
      if (!res || !res.ok) return null;
      const body = await res.json().catch(() => null);
      if (!body) return null;
      const code = String((body as Record<string, unknown>).code ?? '0');
      if (code !== '0') return null;
      const p = this.parseTicker(this.extractTicker(body));
      if (!p) return null;
      return { bid: Number(p.bid), ask: Number(p.ask), last: Number(p.last), volume24h: Number(p.volume), timestamp: this.clock(), venue: this.info, pair: { base: pair.base, quote: pair.quote } };
    } catch {
      return null;
    }
  }

  override async fetchOrderBook(pair: { base: string; quote: string }, depth = 20): Promise<import('@nova-app/shared').OrderBook | null> {
    try {
      const symbol = this.toSymbol(pair);
      const url = `${this.baseUrl}${this.obPath(symbol, Math.min(depth, 400))}`;
      const res = await this.fetchImpl(url);
      if (!res || !res.ok) return null;
      const body = await res.json().catch(() => null);
      if (!body) return null;
      const code = String((body as Record<string, unknown>).code ?? '0');
      if (code !== '0') return null;
      const extracted = this.extractOB(body);
      const p = this.parseOB(extracted);
      if (!p) return null;
      const tsRaw = (extracted as Record<string, unknown>).ts;
      const ts = typeof tsRaw === 'string' ? Number(tsRaw) : this.clock();
      const toLevel = (l: [string, string]): import('@nova-app/shared').OrderBookLevel => ({ price: Number(l[0]), quantity: Number(l[1]) });
      return { bids: p.bids.map(toLevel), asks: p.asks.map(toLevel), timestamp: ts, venue: this.info, pair: { base: pair.base, quote: pair.quote } };
    } catch {
      return null;
    }
  }

  override async fetchNetworkStatus(): Promise<import('@nova-app/shared').NetworkStatus> {
    try {
      const url = `${this.baseUrl}${this.statusPath}`;
      const res = await this.fetchImpl(url);
      if (!res || !res.ok) return { status: 'maintenance', message: 'network unreachable', depositsEnabled: false, withdrawalsEnabled: false, tradingEnabled: false, maintenance: true, checkedAt: this.clock(), venue: this.info };
      const body = await res.json().catch(() => null);
      if (!body) return { status: 'maintenance', message: 'empty response', depositsEnabled: false, withdrawalsEnabled: false, tradingEnabled: false, maintenance: true, checkedAt: this.clock(), venue: this.info };
      const dataArr = (body as Record<string, unknown>).data as unknown[] | undefined;
      const state = String((dataArr?.[0] as Record<string, unknown> | undefined)?.state ?? 'normal');
      const isMaintenance = /maintenance/i.test(state);
      return { status: isMaintenance ? 'maintenance' : 'active', message: isMaintenance ? 'state=maintenance' : null, depositsEnabled: !isMaintenance, withdrawalsEnabled: !isMaintenance, tradingEnabled: !isMaintenance, maintenance: isMaintenance, checkedAt: this.clock(), venue: this.info };
    } catch {
      return { status: 'maintenance', message: 'network unreachable', depositsEnabled: false, withdrawalsEnabled: false, tradingEnabled: false, maintenance: true, checkedAt: this.clock(), venue: this.info };
    }
  }

  override async fetchMarkets(): Promise<readonly import('@nova-app/shared').Market[]> {
    try {
      const url = `${this.baseUrl}${this.marketsPath}`;
      const res = await this.fetchImpl(url);
      if (!res || !res.ok) return [];
      const body = await res.json().catch(() => null);
      if (!body) return [];
      const code = String((body as Record<string, unknown>).code ?? '0');
      if (code !== '0') return [];
      const arr = this.extractMarkets(body);
      const out: (import('@nova-app/shared').Market)[] = [];
      for (const raw of arr) {
        const p = this.parseMarket(raw);
        if (!p) continue;
        out.push({ symbol: p.symbol, base: p.base, quote: p.quote, status: p.status === 'live' ? 'active' : 'paused', minQty: null, minPrice: null, minNotional: null, pricePrecision: null, qtyPrecision: null });
      }
      return out;
    } catch {
      return [];
    }
  }
}