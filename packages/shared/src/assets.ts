/**
 * Asset identity types — per docs/12_ASSET_NORMALIZATION.md.
 */

/** Canonical asset identity: which asset (across chains) this represents. */
export interface AssetId {
  readonly chain: string;          // 'ethereum', 'bitcoin', 'solana', …
  readonly contract: string | null; // null for native assets
}

/** Trading pair: a base asset priced in a quote asset. */
export interface TradingPair {
  readonly base: string;           // 'BTC'
  readonly quote: string;          // 'USDT'
}

/**
 * Sym → canonical AssetId lookup. Populated by @tokeniq, read by every
 * connector for symbol normalization (XBT↔BTC, WBTC→BTC, …).
 */
export type SymbolNormalizationTable = Readonly<Record<string, AssetId>>;
