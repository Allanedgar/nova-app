/**
 * @nova-app/bridge — Bridge connector system.
 * Provides connectors for the top 20 cross-chain bridge protocols.
 */
export { BaseBridgeConnector } from './base.js';
export type { BaseBridgeDeps } from './base.js';
export type { BridgeInfo, BridgeRoute, BridgeQuote, BridgeConnector } from './types.js';
export { createAllBridgeConnectors } from './adapters.js';
export const NOVA_BRIDGE_VERSION = '0.1.0';