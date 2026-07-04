import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'mexc', name: 'MEXC', url: 'https://www.mexc.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class MexcConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'mexc', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.mexc.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v3/trades?symbol=${encodeURIComponent(s)}`,
      obPath: (s, d) => `/api/v3/depth?symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v3/exchangeInfo`, statusPath: `/api/v3/ping`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}