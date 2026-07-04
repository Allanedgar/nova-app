import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'bybit', name: 'Bybit', url: 'https://www.bybit.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class BybitConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'bybit', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.bybit.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v5/market/tickers?category=spot&symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v5/market/trades?category=spot&symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v5/market/orderbook?category=spot&symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v5/market/instruments-info?category=spot`,
      statusPath: `/api/v5/market/time`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: (b) => { const r = b as Record<string, unknown>; const result = r.result as Record<string, unknown> | undefined; return (result?.list as unknown[]) ?? []; },
      extractTicker: (b) => { const r = b as Record<string, unknown>; const result = r.result as Record<string, unknown> | undefined; const list = result?.list as unknown[] | undefined; return list?.[0] ?? b; },
      extractOB: (b) => { const r = b as Record<string, unknown>; return r.result as Record<string, unknown> ?? b; },
      extractTrades: (b) => { const r = b as Record<string, unknown>; const result = r.result as Record<string, unknown> | undefined; return (result?.list as unknown[]) ?? []; },
    });
  }
}