/**
 * Market snapshot types for the arbitrage engine.
 */
import type { VenueKind } from './opportunity.js';

export interface PriceSnapshot {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  bid: string;
  ask: string;
  last: string;
  volume24h: string;
  bidDepth: string;
  askDepth: string;
}

export interface MarketSnapshot {
  venueId: string;
  venueKind: VenueKind;
  timestamp: number;
  pairs: PriceSnapshot[];
}

export interface NormalizedSnapshot {
  venueId: string;
  venueKind: VenueKind;
  timestamp: number;
  pairs: NormalizedPair[];
}

export interface NormalizedPair {
  venueId: string;
  normalizedSymbol: string;
  baseAsset: string;
  baseAddress?: string;
  quoteAsset: string;
  quoteAddress?: string;
  chainId?: number;
  bid: string;
  ask: string;
  last: string;
  volume24h: string;
  bidDepth: string;
  askDepth: string;
}

export interface SnapshotDiff {
  venueId: string;
  timestamp: number;
  changed: NormalizedPair[];
  added: NormalizedPair[];
  removed: NormalizedPair[];
}