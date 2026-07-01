/**
 * Connector types — per docs/07_CONNECTOR_SPECIFICATION.md §1.1.
 *
 * The Connector interface is the single contract every CEX, DEX, and bridge
 * must implement. Pricing data flows through these types unchanged.
 */

import type { TradingPair } from './index.js';

/** A venue: CEX, DEX, or bridge. */
export type ConnectorKind = 'cex' | 'dex' | 'bridge';

/** Health-of-connector status. */
export type ConnectorStatus = 'active' | 'degraded' | 'maintenance';

/** Static venue metadata — taker/maker fees, rate limit, URL. */
export interface ExchangeInfo {
  readonly code: string;            // 'binance'
  readonly name: string;            // 'Binance'
  readonly url: string;             // 'https://binance.com'
  readonly rateLimitMs: number;     // ms between requests
  readonly takerFeeBps: number;     // 10 = 0.10%
  readonly makerFeeBps: number;     // 8  = 0.08%
}

/** Top-of-book quote at one instant in time. */
export interface PriceSnapshot {
  readonly bid: number;
  readonly ask: number;
  readonly bidQty: number;
  readonly askQty: number;
  readonly timestamp: number;       // unix ms
  readonly venue: ExchangeInfo;
  readonly pair: TradingPair;
}

/** Health check snapshot — used by monitoring + load-balancing. */
export interface ConnectorHealth {
  readonly status: ConnectorStatus;
  readonly latencyMs: number;
  readonly lastError?: string;
  readonly checkedAt: number;       // unix ms
}

/**
 * Connector — the single contract every venue must implement.
 * Concrete classes live in `packages/connectors/src/<kind>/<venue>/`.
 */
export interface Connector {
  readonly id: string;                       // 'binance', 'uniswap-v3', 'stargate'
  readonly kind: ConnectorKind;
  readonly info: ExchangeInfo;

  /** Returns null if the snapshot can't be fetched (rate-limited, down, …). */
  fetchSnapshot(pair: TradingPair): Promise<PriceSnapshot | null>;

  /** Fetch the venue's own health — never throws. */
  fetchHealth(): Promise<ConnectorHealth>;
}
