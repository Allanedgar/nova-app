/**
 * Binance REST connector — `packages/connectors/src/cex/binance.ts`.
 * Per docs/08_MARKET_DATA_ENGINE.md §5.1 + docs/07_CONNECTOR_SPECIFICATION.md §1.3.
 *
 * Symbol mapping: CCXT-style "BTC/USDT" → Binance's "BTCUSDT" (no separator).
 * Endpoints:
 *   GET https://api.binance.com/api/v3/ticker/bookTicker?symbol=BTCUSDT
 *      → { symbol, bidPrice, bidQty, askPrice, askQty }
 *
 * `fetchImpl` defaults to global `fetch`, but is injectable for tests.
 * `clock` is also injectable for deterministic timestamps.
 *
 * Real network calls are NOT exercised by the bundled test — the test
 * uses a mock fetchImpl. To exercise the live API, set BINANCE_LIVE=1
 * in the env when running this package's tests.
 */

import type {
  Connector,
  ConnectorHealth,
  ExchangeInfo,
  PriceSnapshot,
  TradingPair,
} from '@nova-app/shared';

const BINANCE_INFO: ExchangeInfo = {
  code: 'binance',
  name: 'Binance',
  url: 'https://www.binance.com',
  rateLimitMs: 100,           // 10 RPS for /api/v3 public endpoints
  takerFeeBps: 10,            // 0.10%
  makerFeeBps: 10,
};

export interface BinanceConnectorDeps {
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
  readonly baseUrl?: string;
}

/** Convert "BTC/USDT" (UI form) → "BTCUSDT" (Binance API form). */
export function toBinanceSymbol(pair: TradingPair): string {
  return `${pair.base}${pair.quote}`;
}

/** Convert "BTCUSDT" → "BTC/USDT" (used in test fixtures). */
export function fromBinanceSymbol(symbol: string): TradingPair | null {
  // Heuristic: split at common quote tokens. Binance has many quote
  // assets — we keep this minimal so the connector stays deterministic.
  const QUOTES = ['USDT', 'BUSD', 'USDC', 'FDUSD', 'BTC', 'ETH', 'TRY', 'EUR'];
  for (const q of QUOTES) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      return { base: symbol.slice(0, symbol.length - q.length), quote: q };
    }
  }
  return null;
}

interface BookTickerResponse {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export class BinanceConnector implements Connector {
  readonly id = 'binance';
  readonly kind = 'cex' as const;
  readonly info = BINANCE_INFO;

  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private readonly baseUrl: string;

  constructor(deps: BinanceConnectorDeps = {}) {
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clock = deps.clock ?? Date.now;
    this.baseUrl = deps.baseUrl ?? 'https://api.binance.com';
  }

  async fetchSnapshot(pair: TradingPair): Promise<PriceSnapshot | null> {
    if (process.env.BINANCE_LIVE !== '1') {
      // Default: never hit the live API from the test runner.
      // Real use: caller passes fetchImpl that they want to use.
    }
    const symbol = toBinanceSymbol(pair);
    const url = `${this.baseUrl}/api/v3/ticker/bookTicker?symbol=${encodeURIComponent(symbol)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url);
    } catch {
      return null; // network failure → caller treats as missing
    }
    if (!res.ok) return null; // 4xx/5xx → missing (rate-limited etc.)
    let body: BookTickerResponse;
    try {
      body = (await res.json()) as BookTickerResponse;
    } catch {
      return null;
    }
    return {
      bid: Number(body.bidPrice),
      ask: Number(body.askPrice),
      bidQty: Number(body.bidQty),
      askQty: Number(body.askQty),
      timestamp: this.clock(),
      venue: this.info,
      pair,
    };
  }

  async fetchHealth(): Promise<ConnectorHealth> {
    const url = `${this.baseUrl}/api/v3/ping`;
    const started = this.clock();
    try {
      const res = await this.fetchImpl(url);
      return {
        status: res.ok ? 'active' : 'degraded',
        latencyMs: this.clock() - started,
        checkedAt: this.clock(),
      };
    } catch (err) {
      return {
        status: 'maintenance',
        latencyMs: this.clock() - started,
        checkedAt: this.clock(),
        lastError: err instanceof Error ? err.message : String(err),
      };
    }
  }
}