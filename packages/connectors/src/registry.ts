/**
 * In-memory Connector registry.
 * Per docs/07_CONNECTOR_SPECIFICATION.md §1.2.
 *
 * Keep it simple — `Map<id, Connector>`. The full persistence of registry
 * state lives in @nova-app/persistence; this is just the in-process lookup.
 */

import type { Connector } from '@nova-app/shared';

export interface RegistryHealthReport {
  readonly total: number;
  readonly cex: number;
  readonly dex: number;
  readonly bridge: number;
}

export class ConnectorRegistry {
  private readonly connectors: Map<string, Connector> = new Map();

  /** Register or replace a connector by id. Idempotent. */
  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
  }

  /** Bulk-register; later ids win on collision. */
  registerAll(list: readonly Connector[]): void {
    for (const c of list) this.register(c);
  }

  /** Lookup by id; returns undefined if not present. */
  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  /** Remove a connector by id; returns true if it existed. */
  unregister(id: string): boolean {
    return this.connectors.delete(id);
  }

  /** Every registered connector. */
  all(): readonly Connector[] {
    return Array.from(this.connectors.values());
  }

  /** Snapshot of how many connectors of each kind are registered. */
  healthSnapshot(): RegistryHealthReport {
    const all = this.all();
    let cex = 0, dex = 0, bridge = 0;
    for (const c of all) {
      if (c.kind === 'cex') cex++;
      else if (c.kind === 'dex') dex++;
      else if (c.kind === 'bridge') bridge++;
    }
    return { total: all.length, cex, dex, bridge };
  }

  /** True iff every registered id is in the allowed list. */
  hasOnly(allowed: readonly string[]): boolean {
    const set = new Set(allowed);
    return this.all().every((c) => set.has(c.id));
  }
}
