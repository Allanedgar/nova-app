import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'backpack', name: 'Backpack Exchange', url: 'https://backpack.exchange', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}_${p.quote}`.toUpperCase();

export class BackpackConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'backpack', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.backpack.exchange',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v1/ticker?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v1/trades?symbol=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v1/orderbook?symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v1/symbols`, statusPath: `/api/v1/health`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}