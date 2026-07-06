import type { DexConnector, DexPool, DexPoolSnapshot } from '@nova-app/dex';

export interface DexSubgraphResult {
  readonly pools: readonly DexPool[];
  readonly snapshots: readonly DexPoolSnapshot[];
  readonly errors: readonly string[];
}

export class DexSubgraphSource {
  async discover(
    connectors: readonly DexConnector[],
    maxPoolsPerConnector = 25,
  ): Promise<DexSubgraphResult> {
    const pools: DexPool[] = [];
    const snapshots: DexPoolSnapshot[] = [];
    const errors: string[] = [];

    for (const connector of connectors) {
      try {
        const discovered = await connector.discoverPools();
        const selected = discovered.slice(0, maxPoolsPerConnector);
        pools.push(...selected);

        for (const pool of selected) {
          const snapshot = await connector.fetchPoolSnapshot(pool.id);
          if (snapshot) snapshots.push(snapshot);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${connector.id}: ${message}`);
      }
    }

    return { pools, snapshots, errors };
  }
}
