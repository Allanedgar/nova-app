/**
 * @nova-app/shared — pure TypeScript types and constants.
 * Per docs/12_ASSET_NORMALIZATION.md and docs/05_MONOREPO_STRUCTURE.md.
 */

export const NOVA_SHARED_VERSION = '0.1.0';

export type { AssetId, TradingPair, SymbolNormalizationTable } from './assets.js';
export type {
  Connector,
  ConnectorKind,
  ConnectorStatus,
  ConnectorHealth,
  ExchangeInfo,
  PriceSnapshot,
  Market,
  OrderBook,
  OrderBookLevel,
  Trade,
  FeeSchedule,
  NetworkStatus,
  DiscoveredMarket,
} from './connector.js';
