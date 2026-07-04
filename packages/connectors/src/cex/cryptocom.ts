import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'cryptocom', name: 'Crypto.com', url: 'https://www.crypto.com', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}${p.quote}`.toUpperCase();

export class CryptocomConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'cryptocom', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.crypto.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/exchange-api/v1/ticker/24hr?instrument_name=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/exchange-api/v1/trades?instrument_name=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/exchange-api/v1/orderbook/${encodeURIComponent(s)}?depth=${d}`,
      marketsPath: `/exchange-api/v1/instruments`, statusPath: `/exchange-api/v1/system-status`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}