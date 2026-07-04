import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'bingx', name: 'BingX', url: 'https://www.bingx.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}-${p.quote}`.toUpperCase();

const extractData = (b: unknown): Record<string, unknown> => { const r = b as Record<string, unknown>; return (r.data as Record<string, unknown>) ?? r; };
const extractDataArray = (b: unknown): unknown[] => { const r = b as Record<string, unknown>; return (r.data as unknown[]) ?? []; };

export class BingxConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'bingx', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.bingx.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v1/market/getTicker?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v1/market/getRecentTrades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v1/market/depth?symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v1/market/symbols`, statusPath: `/api/v1/market/ping`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: extractDataArray,
      extractTicker: (b) => { const arr = extractDataArray(b); return arr[0] ?? b; },
      extractOB: extractData,
      extractTrades: extractDataArray,
    });
  }
}