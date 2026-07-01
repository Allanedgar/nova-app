/**
 * @nova-app/connectors — registry of all venue connectors.
 * Per docs/07_CONNECTOR_SPECIFICATION.md §1.2 + docs/05_MONOREPO_STRUCTURE.md.
 */

import type { Connector, ConnectorKind, ConnectorStatus } from '@nova-app/shared';
import { ConnectorRegistry } from './registry.js';

export { NOVA_CONNECTORS_VERSION } from './version.js';
export { ConnectorRegistry } from './registry.js';
export type { RegistryHealthReport } from './registry.js';

/**
 * Build a Connector from the env-driven config `ENABLED_CONNECTORS=binance,okx`.
 * Phase 1: parses a comma-separated list. Phase 1.x will add per-venue keys.
 */
export function parseEnabledConnectors(env: string | undefined): readonly string[] {
  if (!env) return [];
  return env
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/** Filter helper — common query used by @apollo's opportunity finder. */
export function activeConnectorsOfKind(
  registry: ConnectorRegistry,
  kind: ConnectorKind,
): readonly Connector[] {
  const all = registry.all();
  return all.filter((c) => c.kind === kind && c.info.rateLimitMs >= 0);
}

/** Aggregate status across all registered connectors. */
export function overallStatus(
  registry: ConnectorRegistry,
): ConnectorStatus {
  const all = registry.all();
  if (all.length === 0) return 'maintenance';
  if (all.some((c) => c.info.code === '')) return 'degraded';
  return 'active';
}
