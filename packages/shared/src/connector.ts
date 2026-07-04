/**
 * Connector types — per docs/07_CONNECTOR_SPECIFICATION.md §1.1 +
 * docs/PHASE1.5_MARKET_INFRASTRUCTURE.md.
 *
 * The Connector interface is the single contract every CEX, DEX, and bridge
 * must implement. Pricing data flows through these types unchanged.
 */

import type { TradingPair } from './assets.js';

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

/** A single order-book price level. */
export interface OrderBookLevel {
  readonly price: number;
  readonly quantity: number;
}

/** L2 order book snapshot (subset of L2 — top of book per side). */
export interface OrderBook {
  readonly bids: readonly OrderBookLevel[];  // sorted desc by price
  readonly asks: readonly OrderBookLevel[];  // sorted asc by price
  readonly timestamp: number;
  readonly venue: ExchangeInfo;
  readonly pair: TradingPair;
}

/** A single trade/print. */
export interface Trade {
  readonly id: string;
  readonly price: number;
  readonly quantity: number;
  readonly side: 'buy' | 'sell';
  readonly timestamp: number;
}

/** Per-tier fee schedule (maker/taker + withdrawal minimums). */
export interface FeeSchedule {
  readonly makerFeeBps: number;
  readonly takerFeeBps: number;
  readonly withdrawalFees: Readonly<Record<string, number>>;
  readonly venue: ExchangeInfo;
  readonly asOf: number;
}

/** Network-wide status (deposits paused, withdrawals paused, maintenance). */
export interface NetworkStatus {
  readonly status: ConnectorStatus;
  readonly message: string | null;
  readonly depositsEnabled: boolean;
  readonly withdrawalsEnabled: boolean;
  readonly tradingEnabled: boolean;
  readonly maintenance: boolean;
  readonly checkedAt: number;
  readonly venue: ExchangeInfo;
}

/** A single market on a venue (symbol, base/quote, listing status). */
export interface Market {
  readonly symbol: string;            // venue-specific form, e.g. 'BTCUSDT' or 'BTC-USDT'
  readonly base: string;              // 'BTC'
  readonly quote: string;             // 'USDT'
  readonly status: 'active' | 'paused' | 'delisted';
  readonly minQty: number | null;
  readonly minPrice: number | null;
  readonly minNotional: number | null;
  readonly pricePrecision: number | null;
  readonly qtyPrecision: number | null;
}

/** Top-of-book quote at one instant in time. */
export interface PriceSnapshot {
  readonly bid: number;
  readonly ask: number;
  readonly last: number;             // last trade price; never used for arb comparison
  readonly volume24h: number;        // 24h base-volume
  readonly timestamp: number;        // unix ms
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

/** Discovery result — pair discovered on a venue. */
export interface DiscoveredMarket {
  readonly venue: ExchangeInfo;
  readonly symbol: string;
  readonly base: string;
  readonly quote: string;
  readonly status: 'active' | 'paused' | 'delisted';
  readonly firstSeenAt: number;
  readonly lastObservedAt: number;
}

/**
 * Connector — the single contract every venue must implement.
 * Concrete classes live in `packages/connectors/src/<kind>/<venue>/`.
 *
 * Phase 1.5 expanded the surface from 2 methods (fetchSnapshot +
 * fetchHealth) to 9. Phase 1.3 (Binance) was updated to implement all 9
 * with mocked fetchImpl. Each new venue follows the same pattern.
 */
export interface Connector {
  readonly id: string;
  readonly kind: ConnectorKind;
  readonly info: ExchangeInfo;

  // ── Discovery (1) ──────────────────────────────────────────────
  /** All currently-listed markets on this venue. */
  fetchMarkets(): Promise<readonly Market[]>;
  /** Per-venue asset discovery: pairs observed on this venue. */
  discoverAssets(): Promise<readonly DiscoveredMarket[]>;

  // ── Pricing (3) ────────────────────────────────────────────────
  /** Top-of-book + last + 24h volume. Returns null if unavailable. */
  fetchTicker(pair: TradingPair): Promise<PriceSnapshot | null>;
  /** L2 order book (or top-of-book AMM reserves for DEX). */
  fetchOrderBook(pair: TradingPair, depth?: number): Promise<OrderBook | null>;
  /** Recent trades. */
  fetchTrades(pair: TradingPair, sinceMs?: number): Promise<readonly Trade[]>;

  // ── Cost (2) ───────────────────────────────────────────────────
  /** Per-tier fee schedule (maker/taker + withdrawal). */
  fetchFees(): Promise<FeeSchedule>;
  /** Static venue metadata. */
  fetchExchangeInfo(): Promise<ExchangeInfo>;

  // ── Health (2) ─────────────────────────────────────────────────
  /** Network-wide status (deposits/withdrawals/maintenance). */
  fetchNetworkStatus(): Promise<NetworkStatus>;
  /** Per-connector health (latency, last error, status). */
  health(): Promise<ConnectorHealth>;
}
