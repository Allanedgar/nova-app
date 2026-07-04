/**
 * Kraken REST connector.
 * Kraken wraps responses in { result: { ... }, error: [] }.
 */
import type { ExchangeInfo } from '@nova-app/shared';
import { BaseCexConnector, parsers } from './base.js';

const KRAKEN_INFO: ExchangeInfo = {
  code: 'kraken', name: 'Kraken', url: 'https://www.kraken.com', rateLimitMs: 200, takerFeeBps: 26, makerFeeBps: 16,
};

const toSymbol = (p: { base: string; quote: string }) => {
  const base = p.base.toUpperCase() === 'BTC' ? 'XBT' : p.base.toUpperCase();
  const quote = p.quote.toUpperCase() === 'BTC' ? 'XBT' : p.quote.toUpperCase();
  return `${base}${quote}`;
};
export function fromKrakenSymbol(symbol: string): { base: string; quote: string } | null {
  const KNOWN_QUOTES = ['USDT', 'USD', 'EUR', 'GBP', 'XBT', 'ETH'];
  for (const q of KNOWN_QUOTES) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      let base = symbol.slice(0, symbol.length - q.length);
      if (base === 'XBT') base = 'BTC';
      return { base, quote: q };
    }
  }
  return null;
}

const krakenResult = (b: unknown): Record<string, unknown> => {
  const r = b as Record<string, unknown>; return (r.result as Record<string, unknown>) ?? {};
};
const krakenValues = (b: unknown): unknown[] => Object.values(krakenResult(b));

const krakenExtractTicker = (b: unknown): unknown => {
  const vals = krakenValues(b);
  if (vals.length === 0) return b;
  const first = vals[0] as Record<string, unknown> | undefined;
  if (!first) return b;
  const askArr = first.a as unknown[] | undefined;
  const bidArr = first.b as unknown[] | undefined;
  const lastArr = first.c as unknown[] | undefined;
  const volArr = first.v as unknown[] | undefined;
  return {
    askPrice: askArr?.[0] ?? 0,
    bidPrice: bidArr?.[0] ?? 0,
    lastPrice: lastArr?.[0] ?? 0,
    volume: volArr?.[0] ?? 0,
  };
};

export class KrakenConnector extends BaseCexConnector {
  constructor(deps?: { fetchImpl?: typeof fetch; clock?: () => number; baseUrl?: string }) {
    super({
      id: 'kraken', info: KRAKEN_INFO, baseUrl: deps?.baseUrl ?? 'https://api.kraken.com',
      fetchImpl: deps?.fetchImpl, clock: deps?.clock,
      toSymbol, fromSymbol: fromKrakenSymbol,
      tickerPath: (s) => `/api/0/public/Ticker?pair=${encodeURIComponent(s)}`,
      tradesPath: (s) => `/api/0/public/Trades?pair=${encodeURIComponent(s)}`,
      obPath: (s, d) => `/api/0/public/Depth?pair=${encodeURIComponent(s)}&count=${d}`,
      marketsPath: `/api/0/public/AssetPairs`, statusPath: `/api/0/public/Time`,
      parseTicker: parsers.ticker, parseOB: parsers.ob, parseTrade: parsers.trade, parseMarket: parsers.market,
      extractMarkets: krakenValues,
      extractTicker: krakenExtractTicker,
      extractOB: krakenResult,
      extractTrades: (b) => { const result = krakenResult(b); const keys = Object.values(result); return (keys[0] as unknown[]) ?? []; },
    });
  }
}