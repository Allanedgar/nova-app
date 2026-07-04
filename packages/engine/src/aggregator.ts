/**
 * Market Snapshot Aggregator — single source of truth for price data.
 *
 * Per docs/10_ARBITRAGE_ENGINE.md §2 and docs/08_MARKET_DATA_ENGINE.md.
 *
 * Responsibilities:
 *   - Fan-out fetchTicker across all registered connectors for a set of pairs
 *   - Filter stale snapshots (>5s old)
 *   - Group by pair for downstream detection
 *   - Fault-tolerant: one bad connector never breaks a cycle
 */

import type { Connector, PriceSnapshot, TradingPair, PairSnapshotSet } from '@nova-app/shared';

export interface AggregatorDeps {
  readonly clock?: () => number;
}

export interface AggregatorResult {
  readonly pairSets: readonly PairSnapshotSet[];
  readonly totalSnapshots: number;
  readonly errors: readonly string[];
  readonly elapsedMs: number;
}

const DEFAULT_MAX_AGE_MS = 5_000; // 5 seconds

/**
 * Fetch snapshots for every pair from every connector.
 * Returns grouped, fresh snapshots only.
 */
export async function aggregateSnapshots(
  pairs: readonly TradingPair[],
  connectors: readonly Connector[],
  deps: AggregatorDeps = {},
): Promise<AggregatorResult> {
  const started = deps.clock ? deps.clock() : Date.now();
  const errors: string[] = [];
  const now = deps.clock ? deps.clock() : Date.now();

  // Build a map: pair key -> PriceSnapshot[]
  const snapshotMap = new Map<string, PriceSnapshot[]>();

  for (const pair of pairs) {
    const key = symbolKey(pair);
    const pairSnapshots: PriceSnapshot[] = [];

    for (const c of connectors) {
      try {
        const snap = await c.fetchTicker(pair);
        if (snap === null) continue;

        // Reject stale snapshots
        if (now - snap.timestamp > DEFAULT_MAX_AGE_MS) continue;

        pairSnapshots.push(snap);
      } catch (err) {
        errors.push(`${c.id}/${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (pairSnapshots.length > 0) {
      snapshotMap.set(key, pairSnapshots);
    }
  }

  const elapsedMs = (deps.clock ? deps.clock() : Date.now()) - started;

  const pairSets: PairSnapshotSet[] = [];
  let totalSnapshots = 0;

  for (const [key, snapshots] of snapshotMap) {
    const [base, quote] = key.split('/') as [string, string];
    pairSets.push({
      pair: { base, quote },
      symbol: key,
      snapshots,
      fetchedAt: now,
    });
    totalSnapshots += snapshots.length;
  }

  return { pairSets, totalSnapshots, errors, elapsedMs };
}

/** Canonical pair key: "BTC/USDT" */
export function symbolKey(pair: TradingPair): string {
  return `${pair.base}/${pair.quote}`;
}

/** Filter snapshots to only those within maxAgeMs. */
export function filterFresh(
  snapshots: readonly PriceSnapshot[],
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
  now?: number,
): PriceSnapshot[] {
  const t = now ?? Date.now();
  return snapshots.filter((s) => t - s.timestamp <= maxAgeMs);
}