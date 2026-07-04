import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'kucoin', name: 'KuCoin', url: 'https://www.kucoin.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}-${p.quote}`.toUpperCase();

const extractData = (b: unknown): Record<string, unknown> => { const r = b as Record<string, unknown>; return (r.data as Record<string, unknown>) ?? r; };
const extractDataArray = (b: unknown): unknown[] => { const r = b as Record<string, unknown>; return (r.data as unknown[]) ?? []; };

export class KucoinConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'kucoin', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.kucoin.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v1/market/orderbook/level1?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v1/market/hist/trades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, _depth) => `/api/v1/market/orderbook/level2_20?symbol=${encodeURIComponent(s)}`,
      marketsPath: `/api/v1/symbols`, statusPath: `/api/v1/status/public`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: extractDataArray,
      extractTicker: extractData,
      extractOB: extractData,
      extractTrades: extractDataArray,
    });
  }
}