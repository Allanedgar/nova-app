/**
 * Venue Registry — manages all registered venues (CEX, DEX, bridge).
 */
import type { Connector } from '@nova-app/shared';
import type { DexConnector } from '@nova-app/dex';
import type { BridgeConnector } from '@nova-app/bridge';
import type { VenueEntry, VenueKind } from './types.js';

export class VenueRegistry {
  private readonly _venues = new Map<string, VenueEntry>();

  get venues(): readonly VenueEntry[] {
    return Array.from(this._venues.values());
  }

  get(id: string): VenueEntry | undefined {
    return this._venues.get(id);
  }

  byKind(kind: VenueKind): readonly VenueEntry[] {
    return this.venues.filter((v) => v.kind === kind);
  }

  registerCex(connector: Connector): void {
    this._venues.set(connector.id, {
      id: connector.id,
      kind: 'cex',
      name: connector.info.name,
      code: connector.info.code,
      connector,
      registeredAt: Date.now(),
      lastHealthCheck: 0,
      isHealthy: true,
    });
  }

  registerDex(connector: DexConnector): void {
    this._venues.set(connector.id, {
      id: connector.id,
      kind: 'dex',
      name: connector.info.name,
      code: connector.info.code ?? connector.id,
      connector,
      registeredAt: Date.now(),
      lastHealthCheck: 0,
      isHealthy: true,
    });
  }

  registerBridge(connector: BridgeConnector): void {
    this._venues.set(connector.id, {
      id: connector.id,
      kind: 'bridge',
      name: connector.info.name,
      code: connector.info.code ?? connector.id,
      connector,
      registeredAt: Date.now(),
      lastHealthCheck: 0,
      isHealthy: true,
    });
  }

  unregister(id: string): boolean {
    return this._venues.delete(id);
  }

  markHealth(id: string, isHealthy: boolean, checkedAt: number): void {
    const entry = this._venues.get(id);
    if (entry) {
      this._venues.set(id, { ...entry, isHealthy, lastHealthCheck: checkedAt });
    }
  }

  get size(): number {
    return this._venues.size;
  }
}
