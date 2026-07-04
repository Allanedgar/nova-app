import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const INFO: ExchangeInfo = { code: 'coinbase', name: 'Coinbase Advanced', url: 'https://www.coinbase.com/advanced', rateLimitMs: 100, takerFeeBps: 12, makerFeeBps: 10 };
const toSymbol = (p: { base: string; quote: string }) => `${p.base}-${p.quote}`.toUpperCase();

export class CoinbaseConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'coinbase', info: INFO, baseUrl: deps?.baseUrl ?? 'https://api.coinbase.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol,
      tickerPath: (s) => `/api/v3/brokerage/market/products/${encodeURIComponent(s)}/ticker`,
      tradesPath: (s) => `/api/v3/brokerage/market/products/${encodeURIComponent(s)}/trades?limit=50`,
      obPath: (s, _depth) => `/api/v3/brokerage/market/products/${encodeURIComponent(s)}/book?level=1`,
      marketsPath: `/api/v3/brokerage/market/products`,
      statusPath: `/api/v3/brokerage/health`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: (b) => { const r = b as Record<string, unknown>; return (r.products as unknown[]) ?? []; },
      extractTicker: (b) => { const r = b as Record<string, unknown>; return r as Record<string, unknown>; },
      extractOB: (b) => { const r = b as Record<string, unknown>; const book = r.pricebook as Record<string, unknown> | undefined; return book ?? r; },
      extractTrades: (b) => { const r = b as Record<string, unknown>; return (r.trades as unknown[]) ?? []; },
    });
  }
}