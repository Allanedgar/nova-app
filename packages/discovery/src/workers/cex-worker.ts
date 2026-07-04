/**
 * CEX Discovery Worker — scans a CEX venue for markets and assets.
 */
import type { Connector, DiscoveredMarket } from '@nova-app/shared';
import type { AssetEntry, DiscoveredPair, DiscoveryWorker } from '../types.js';

export class CexDiscoveryWorker implements DiscoveryWorker {
  readonly id: string;
  private readonly connector: Connector;

  constructor(connector: Connector) {
    this.id = `cex-worker:${connector.id}`;
    this.connector = connector;
  }

  async scanVenue(_venueId: string): Promise<{ assets: AssetEntry[]; pairs: DiscoveredPair[]; error?: string }> {
    try {
      const markets = await this.connector.discoverAssets();
      const now = Date.now();
      const assets = new Map<string, AssetEntry>();
      const pairs: DiscoveredPair[] = [];

      for (const m of markets) {
        const baseId = `${this.connector.info.code}:${m.base}`;
        const quoteId = `${this.connector.info.code}:${m.quote}`;

        if (!assets.has(baseId)) {
          assets.set(baseId, {
            id: baseId, symbol: m.base, name: m.base, decimals: 18,
            firstSeenAt: now, lastObservedAt: now, venues: [this.connector.info.code],
          });
        }
        if (!assets.has(quoteId)) {
          assets.set(quoteId, {
            id: quoteId, symbol: m.quote, name: m.quote, decimals: 18,
            firstSeenAt: now, lastObservedAt: now, venues: [this.connector.info.code],
          });
        }

        pairs.push({
          venueId: this.connector.id,
          baseAssetId: baseId,
          quoteAssetId: quoteId,
          symbol: m.symbol,
          status: m.status === 'active' ? 'active' : 'paused',
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