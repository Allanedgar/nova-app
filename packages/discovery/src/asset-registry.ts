/**
 * Asset Registry — manages discovered assets and trading pairs.
 * Never hardcodes assets. Everything is discovered dynamically.
 */
import type { AssetEntry, DiscoveredPair } from './types.js';

export class AssetRegistry {
  private readonly _assets = new Map<string, AssetEntry>();
  private readonly _pairs = new Map<string, DiscoveredPair>();

  get assets(): readonly AssetEntry[] {
    return Array.from(this._assets.values());
  }

  get pairs(): readonly DiscoveredPair[] {
    return Array.from(this._pairs.values());
  }

  getAsset(id: string): AssetEntry | undefined {
    return this._assets.get(id);
  }

  getPair(key: string): DiscoveredPair | undefined {
    return this._pairs.get(key);
  }

  registerAsset(entry: AssetEntry): void {
    const existing = this._assets.get(entry.id);
    if (existing) {
      this._assets.set(entry.id, {
        ...existing,
        lastObservedAt: Math.max(existing.lastObservedAt, entry.lastObservedAt),
        venues: [...new Set([...existing.venues, ...entry.venues])],
        metadata: { ...existing.metadata, ...entry.metadata },
      });
    } else {
      this._assets.set(entry.id, entry);
    }
  }

  registerPair(pair: DiscoveredPair): void {
    const key = `${pair.venueId}:${pair.symbol}`;
    const existing = this._pairs.get(key);
    if (existing) {
      this._pairs.set(key, { ...existing, lastObservedAt: pair.lastObservedAt, status: pair.status });
    } else {
      this._pairs.set(key, pair);
    }
  }

  markStale(thresholdMs: number, now: number): { staleAssets: string[]; stalePairs: string[] } {
    const staleAssets: string[] = [];
    const stalePairs: string[] = [];
    for (const [id, asset] of this._assets) {
      if (now - asset.lastObservedAt > thresholdMs) {
        staleAssets.push(id);
        this._assets.delete(id);
      }
    }
    for (const [key, pair] of this._pairs) {
      if (now - pair.lastObservedAt > thresholdMs) {
        stalePairs.push(key);
        this._pairs.delete(key);
      }
    }
    return { staleAssets, stalePairs };
  }

  clear(): void {
    this._assets.clear();
    this._pairs.clear();
  }

  get size(): { assets: number; pairs: number } {
    return { assets: this._assets.size, pairs: this._pairs.size };
  }
}