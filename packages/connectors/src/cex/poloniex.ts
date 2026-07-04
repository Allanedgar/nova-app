import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'poloniex', name: 'Poloniex', url: 'https://poloniex.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}_${p.quote}`.toUpperCase();

export class PoloniexConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'poloniex', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.poloniex.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/markets/${encodeURIComponent(s)}`,
      tradesPath: (s) => `/markets/${encodeURIComponent(s)}/trades`,
      obPath: (s, d) => `/markets/${encodeURIComponent(s)}/orderBook?limit=${d}`,
      marketsPath: `/markets`, statusPath: `/ping`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}