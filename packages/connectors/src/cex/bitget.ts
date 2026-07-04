import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'bitget', name: 'Bitget', url: 'https://www.bitget.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

const extractData = (b: unknown): Record<string, unknown> => { const r = b as Record<string, unknown>; return (r.data as Record<string, unknown>) ?? r; };
const extractDataArray = (b: unknown): unknown[] => { const r = b as Record<string, unknown>; return (r.data as unknown[]) ?? []; };

export class BitgetConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'bitget', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.bitget.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v2/spot/market/tickers?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v2/spot/market/fills?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v2/spot/market/orderbook?symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v2/spot/public/symbols`, statusPath: `/api/v2/spot/public/time`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: extractDataArray,
      extractTicker: (b) => { const arr = extractDataArray(b); return arr[0] ?? b; },
      extractOB: extractData,
      extractTrades: extractDataArray,
    });
  }
}