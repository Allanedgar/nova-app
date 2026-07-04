import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'whitebit', name: 'WhiteBIT', url: 'https://whitebit.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class WhitebitConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'whitebit', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.whitebit.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v1/ticker?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v1/trades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v1/orderbook/${encodeURIComponent(s)}?limit=${d}`,
      marketsPath: `/api/v1/public/symbols`, statusPath: `/api/v1/public/ping`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}