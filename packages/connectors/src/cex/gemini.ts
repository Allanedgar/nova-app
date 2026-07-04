import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'gemini', name: 'Gemini', url: 'https://www.gemini.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class GeminiConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'gemini', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.gemini.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/v1/pubticker/${encodeURIComponent(s)}`,
      tradesPath: (s) => `/v1/trades/${encodeURIComponent(s)}?limit=50`,
      obPath: (s, d) => `/v1/book/${encodeURIComponent(s)}?limit=${d}`,
      marketsPath: `/v1/symbols`, statusPath: `/v1/pub/status`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}