/**
 * @nova-app/engine — single-cycle detector.
 * Per docs/02_PHASED_ROADMAP.md Task 1.10 + docs/08_MARKET_DATA_ENGINE.md §3.
 *
 * One tick:
 *   for each pair in `pairs`:
 *     fetch snapshot from every registered CEX connector (parallel)
 *     if any snapshot is missing → log and skip (fault-tolerant)
 *     if one or more snapshots come back → write them to the cache (Phase 2)
 *     — opportunity detection is Phase-1.5 scope; this stub returns the count
 *
 * Phase 5 will wrap this in a 5s cron.
 */

import type { Connector, PriceSnapshot, TradingPair } from '@nova-app/shared';

export interface DetectorTickResult {
  readonly pair: TradingPair;
  readonly snapshots: readonly PriceSnapshot[];
  readonly connectorsQueried: number;
  readonly connectorsReturned: number;
  readonly elapsedMs: number;
  readonly errors: readonly string[];
}

export interface DetectorDeps {
  readonly fetchAll: (pair: TradingPair) => Promise<readonly PriceSnapshot[]>;
  readonly clock?: () => number;
}

/**
 * Fan-out a single pair across every connector and collect what comes back.
 * Empty results are tolerated (one bad venue must not break a tick).
 */
export async function runTick(
  pair: TradingPair,
  connectors: readonly Connector[],
  deps: DetectorDeps,
  errors: string[] = [],
): Promise<DetectorTickResult> {
  const started = deps.clock ? deps.clock() : Date.now();
  const snapshots: PriceSnapshot[] = [];
  for (const c of connectors) {
    try {
      const snap = await c.fetchSnapshot(pair);
      if (snap !== null) snapshots.push(snap);
    } catch (err) {
      errors.push(
        `${c.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  const elapsed = (deps.clock ? deps.clock() : Date.now()) - started;
  return {
    pair,
    snapshots,
    connectorsQueried: connectors.length,
    connectorsReturned: snapshots.length,
    elapsedMs: elapsed,
    errors,
  };
}
