/**
 * @nova-app/shared — pure TypeScript types and constants.
 * Per docs/12_ASSET_NORMALIZATION.md and docs/05_MONOREPO_STRUCTURE.md.
 */

export const NOVA_SHARED_VERSION = '0.1.0';

/** Canonical asset identifier — see docs/12_ASSET_NORMALIZATION.md. */
export interface AssetId {
  readonly chain: string;
  readonly contract: string | null; // null for native assets
}

/** Trading pair — `BTC/USDT` → symbol="BTCUSDT" on a CEX, pair="BTC/USDT" on a DEX. */
export interface TradingPair {
  readonly base: string;
  readonly quote: string;
}
