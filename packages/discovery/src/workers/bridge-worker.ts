/**
 * Bridge Discovery Worker — scans a bridge venue for routes and assets.
 */
import type { BridgeConnector } from '@nova-app/bridge';
import type { AssetEntry, DiscoveredPair, DiscoveryWorker } from '../types.js';

export class BridgeDiscoveryWorker implements DiscoveryWorker {
  readonly id: string;
  private readonly connector: BridgeConnector;

  constructor(connector: BridgeConnector) {
    this.id = `bridge-worker:${connector.id}`;
    this.connector = connector;
  }

  async scanVenue(_venueId: string): Promise<{ assets: AssetEntry[]; pairs: DiscoveredPair[]; error?: string }> {
    try {
      const routes = await this.connector.fetchRoutes();
      const now = Date.now();
      const assets = new Map<string, AssetEntry>();
      const pairs: DiscoveredPair[] = [];

      for (const route of routes) {
        const assetId = `${this.connector.info.code}:${route.tokenSymbol}`;

        if (!assets.has(assetId)) {
          assets.set(assetId, {
            id: assetId, symbol: route.tokenSymbol, name: route.tokenSymbol, decimals: 18,
            contractAddress: route.tokenAddress,
            firstSeenAt: now, lastObservedAt: now, venues: [this.connector.info.code],
          });
        }

        pairs.push({
          venueId: this.connector.id,
          baseAssetId: assetId,
          quoteAssetId: assetId,
          symbol: `${route.tokenSymbol}:${route.sourceChain}→${route.destinationChain}`,
          status: route.isActive ? 'active' : 'paused',
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