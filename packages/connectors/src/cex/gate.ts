import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'gate', name: 'Gate.io', url: 'https://www.gate.io', rateLimitMs: 100, takerFeeBps: 10, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}_${p.quote}`.toUpperCase();
const fromSymbol = (s: string): { base: string; quote: string } | null => {
  const p = s.toUpperCase().split('_');
  return p.length === 2 && p[0] && p[1] ? { base: p[0], quote: p[1] } : null;
};

export class GateConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'gate', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.gateio.ws',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol, fromSymbol,
      tickerPath: (s) => `/api/v4/spot/ticker?currency_pair=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/v4/spot/trades?currency_pair=${encodeURIComponent(s)}&limit=50`,
      obPath: (s, d) => `/api/v4/spot/order_book?currency_pair=${encodeURIComponent(s)}&limit=${d}`,
      marketsPath: `/api/v4/spot/currency_pairs`, statusPath: `/api/v4/system/status`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
    });
  }
}