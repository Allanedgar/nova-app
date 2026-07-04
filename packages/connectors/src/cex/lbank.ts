import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'lbank', name: 'LBank', url: 'https://www.lbank.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class LbankConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'lbank', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.lbank.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v1/ticker/24hr?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v1/trades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, _depth) => `/api/v1/depth?symbol=${encodeURIComponent(s)}&size=20`,
      marketsPath: `/api/v1/pairs`, statusPath: `/api/v1/ping`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}