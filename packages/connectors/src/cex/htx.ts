import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'htx', name: 'HTX', url: 'https://www.htx.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toLowerCase();

export class HtxConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'htx', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.htx.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v1/ticker/${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v1/trades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v1/depth?symbol=${encodeURIComponent(s)}&depth=${d}`,
      marketsPath: `/api/v1/common/symbols`, statusPath: `/api/v1/common/timestamp`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}