/**
 * Discovery Scheduler — orchestrates periodic discovery cycles across all venues.
 * Runs CEX, DEX, and bridge scans at configurable intervals.
 */
import type { Connector } from '@nova-app/shared';
import type { DexConnector } from '@nova-app/dex';
import type { BridgeConnector } from '@nova-app/bridge';
import { VenueRegistry } from './venue-registry.js';
import { AssetRegistry } from './asset-registry.js';
import { CexDiscoveryWorker } from './workers/cex-worker.js';
import { DexDiscoveryWorker } from './workers/dex-worker.js';
import { BridgeDiscoveryWorker } from './workers/bridge-worker.js';
import type { DiscoveryResult, DiscoverySchedulerConfig, DiscoveryWorker } from './types.js';

const DEFAULT_CONFIG: DiscoverySchedulerConfig = {
  cexIntervalMs: 60_000,
  dexIntervalMs: 120_000,
  bridgeIntervalMs: 300_000,
  fullScanIntervalMs: 3_600_000,
  staleAssetThresholdMs: 86_400_000,
  maxConcurrentWorkers: 5,
};

export class DiscoveryScheduler {
  private readonly venueRegistry: VenueRegistry;
  private readonly assetRegistry: AssetRegistry;
  private readonly config: DiscoverySchedulerConfig;
  private readonly workers = new Map<string, DiscoveryWorker>();
  private cycleCounter = 0;
  private _isRunning = false;
  private _lastFullScan = 0;

  constructor(
    venueRegistry: VenueRegistry,
    assetRegistry: AssetRegistry,
    config?: Partial<DiscoverySchedulerConfig>,
  ) {
    this.venueRegistry = venueRegistry;
    this.assetRegistry = assetRegistry;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  registerCexConnectors(connectors: readonly Connector[]): void {
    for (const c of connectors) {
      this.venueRegistry.registerCex(c);
      this.workers.set(c.id, new CexDiscoveryWorker(c));
    }
  }

  registerDexConnectors(connectors: readonly DexConnector[]): void {
    for (const c of connectors) {
      this.venueRegistry.registerDex(c);
      this.workers.set(c.id, new DexDiscoveryWorker(c));
    }
  }

  registerBridgeConnectors(connectors: readonly BridgeConnector[]): void {
    for (const c of connectors) {
      this.venueRegistry.registerBridge(c);
      this.workers.set(c.id, new BridgeDiscoveryWorker(c));
    }
  }

  async runCycle(): Promise<DiscoveryResult> {
    const cycleId = `cycle-${++this.cycleCounter}-${Date.now()}`;
    const startedAt = Date.now();
    const venues = this.venueRegistry.venues;
    const errors: string[] = [];
    let venuesSucceeded = 0;
    let venuesFailed = 0;
    let assetsDiscovered = 0;
    let pairsDiscovered = 0;

    const now = Date.now();
    const isFullScan = now - this._lastFullScan > this.config.fullScanIntervalMs;

    for (const venue of venues) {
      const worker = this.workers.get(venue.id);
      if (!worker) continue;

      try {
        const result = await worker.scanVenue(venue.id);
        if (result.error) {
          errors.push(result.error);
          venuesFailed++;
          this.venueRegistry.markHealth(venue.id, false, Date.now());
        } else {
          venuesSucceeded++;
          this.venueRegistry.markHealth(venue.id, true, Date.now());
          for (const asset of result.assets) {
            this.assetRegistry.registerAsset(asset);
            assetsDiscovered++;
          }
          for (const pair of result.pairs) {
            this.assetRegistry.registerPair(pair);
            pairsDiscovered++;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        venuesFailed++;
        this.venueRegistry.markHealth(venue.id, false, Date.now());
      }
    }

    if (isFullScan) {
      this._lastFullScan = now;
      const stale = this.assetRegistry.markStale(this.config.staleAssetThresholdMs, now);
      if (stale.staleAssets.length > 0 || stale.stalePairs.length > 0) {
        errors.push(`GC: removed ${stale.staleAssets.length} stale assets, ${stale.stalePairs.length} stale pairs`);
      }
    }

    return {
      cycleId,
      startedAt,
      completedAt: Date.now(),
      venuesScanned: venues.length,
      venuesSucceeded,
      venuesFailed,
      assetsDiscovered,
      pairsDiscovered,
      errors,
    };
  }

  async runFullScan(): Promise<DiscoveryResult> {
    this._lastFullScan = 0;
    return this.runCycle();
  }

  start(): void {
    this._isRunning = true;
  }

  stop(): void {
    this._isRunning = false;
  }
}