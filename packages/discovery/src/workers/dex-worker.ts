/**
 * DEX Discovery Worker — scans a DEX venue for pools and assets.
 */
import type { DexConnector } from '@nova-app/dex';
import type { AssetEntry, DiscoveredPair, DiscoveryWorker } from '../types.js';

export class DexDiscoveryWorker implements DiscoveryWorker {
  readonly id: string;
  private readonly connector: DexConnector;

  constructor(connector: DexConnector) {
    this.id = `dex-worker:${connector.id}`;
    this.connector = connector;
  }

  async scanVenue(_venueId: string): Promise<{ assets: AssetEntry[]; pairs: DiscoveredPair[]; error?: string }> {
    try {
      const pools = await this.connector.discoverPools();
      const now = Date.now();
      const assets = new Map<string, AssetEntry>();
      const pairs: DiscoveredPair[] = [];

      for (const pool of pools) {
        const venueCode = this.connector.info.code ?? this.connector.id;
        const baseId = `${venueCode}:${pool.token0.symbol}`;
        const quoteId = `${venueCode}:${pool.token1.symbol}`;

        if (!assets.has(baseId)) {
          assets.set(baseId, {
            id: baseId, symbol: pool.token0.symbol, name: pool.token0.name ?? pool.token0.symbol, decimals: pool.token0.decimals,
            contractAddress: pool.token0.id, chainId: undefined,
            firstSeenAt: now, lastObservedAt: now, venues: [venueCode],
          });
        }
        if (!assets.has(quoteId)) {
          assets.set(quoteId, {
            id: quoteId, symbol: pool.token1.symbol, name: pool.token1.name ?? pool.token1.symbol, decimals: pool.token1.decimals,
            contractAddress: pool.token1.id, chainId: undefined,
            firstSeenAt: now, lastObservedAt: now, venues: [venueCode],
          });
        }

        pairs.push({
          venueId: this.connector.id,
          baseAssetId: baseId,
          quoteAssetId: quoteId,
          symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
          status: 'active',
          firstSeenAt: now,
          lastObservedAt: now,
        });
      }

      return { assets: Array.from(assets.values()), pairs };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { assets: [], pairs: [], error: msg };
    }
  }
}
