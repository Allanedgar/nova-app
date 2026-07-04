import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'bitfinex', name: 'Bitfinex', url: 'https://www.bitfinex.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `t${p.base}${p.quote}`.toUpperCase();

export class BitfinexConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'bitfinex', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.bitfinex.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/v2/ticker/t?symbols=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/v2/trades/t${encodeURIComponent(s)}/hist?limit=50`,
      obPath: (s, d) => `/v2/book/t${encodeURIComponent(s)}/P0?len=${d}`,
      marketsPath: `/v1/symbols/details`, statusPath: `/v2/platform/status`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}