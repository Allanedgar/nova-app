import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'phemex', name: 'Phemex', url: 'https://www.phemex.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class PhemexConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'phemex', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.phemex.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/md/ticker/24hr?symbol=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/exchange/md/orderbook?symbol=${encodeURIComponent(s)}`,
      obPath: (s, d) => `/exchange/md/orderbook?symbol=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/exchange/public/products`, statusPath: `/api/md/timestamp`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}