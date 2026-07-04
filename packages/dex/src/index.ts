/**
 * @nova-app/dex — DEX connector system.
 * Provides connectors for the top 20 DEX protocols via subgraph queries.
 */
export { BaseDexConnector } from './base.js';
export type { BaseDexDeps } from './base.js';
export type { DexInfo, DexPool, DexPoolSnapshot, DexConnector, DexRegistry } from './types.js';
export { createAllDexConnectors } from './adapters.js';
export const NOVA_DEX_VERSION = '0.1.0';