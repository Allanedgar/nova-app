/**
 * Bridge Discovery Worker - scans a bridge venue for routes and assets.
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
        const venueCode = this.connector.info.code ?? this.connector.id;
        const tokenSymbol = route.tokenSymbol ?? route.originToken ?? route.tokenAddress ?? 'UNKNOWN';
        const tokenAddress = route.tokenAddress ?? route.originToken ?? route.destinationToken;
        const sourceChain = route.sourceChain ?? String(route.originChainId ?? 'source');
        const destinationChain = route.destinationChain ?? String(route.destinationChainId ?? 'destination');
        const assetId = `${venueCode}:${tokenSymbol}`;

        if (!assets.has(assetId)) {
          assets.set(assetId, {
            id: assetId,
            symbol: tokenSymbol,
            name: tokenSymbol,
            decimals: 18,
            contractAddress: tokenAddress,
            firstSeenAt: now,
            lastObservedAt: now,
            venues: [venueCode],
          });
        }

        pairs.push({
          venueId: this.connector.id,
          baseAssetId: assetId,
          quoteAssetId: assetId,
          symbol: `${tokenSymbol}:${sourceChain}->${destinationChain}`,
          status: route.isActive === false ? 'paused' : 'active',
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
