import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'bitstamp', name: 'Bitstamp', url: 'https://www.bitstamp.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toLowerCase();

export class BitstampConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'bitstamp', info: INFO, baseUrl: deps?.baseUrl ?? 'https://www.bitstamp.net',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v2/ticker/${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v2/transactions/${encodeURIComponent(s)}/?limit=50`,
      obPath: (s, d) => `/api/v2/order_book/${encodeURIComponent(s)}/?step=${d}`,
      marketsPath: `/api/v2/trading-pairs-info`, statusPath: `/api/v2/health`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}