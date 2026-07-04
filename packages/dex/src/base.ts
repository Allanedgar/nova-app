/**
 * BaseDexConnector — shared interface for all DEX connectors.
 * Each DEX connector wraps a Subgraph (GraphQL) or on-chain RPC endpoint
 * to discover pools, fetch liquidity, TVL, fee tiers, and metadata.
 */
import type { DexInfo, DexPool, DexPoolSnapshot, DexConnector } from './types.js';

export interface BaseDexDeps {
  readonly info: DexInfo;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
  readonly subgraphUrl: string;
  readonly factoryAddress?: string;
  readonly poolQuery: string;
  readonly parsePool: (raw: unknown) => DexPool | null;
  readonly parseSnapshot: (raw: unknown) => DexPoolSnapshot | null;
  readonly extractPools?: (body: unknown) => unknown[];
  readonly extractSnapshot?: (body: unknown) => unknown;
}

const safeJson = async <T>(res: Response): Promise<T | null> => {
  if (!res.ok) return null;
  try { return (await res.json()) as T; } catch { return null; }
};

const defaultExtractPools = (body: unknown): unknown[] => {
  const r = body as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  if (!data) return [];
  const pools = data.pools as unknown[] | undefined;
  return pools ?? [];
};

const defaultExtractSnapshot = (body: unknown): unknown => {
  const r = body as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  return data ?? body;
};

export class BaseDexConnector implements DexConnector {
  readonly id: string;
  readonly kind = 'dex' as const;
  readonly info: DexInfo;

  protected readonly fetchImpl: typeof fetch;
  protected readonly clock: () => number;
  protected readonly subgraphUrl: string;
  protected readonly factoryAddress?: string;
  protected readonly poolQuery: string;
  protected readonly parsePool: (raw: unknown) => DexPool | null;
  protected readonly parseSnapshot: (raw: unknown) => DexPoolSnapshot | null;
  protected readonly extractPools: (body: unknown) => unknown[];
  protected readonly extractSnapshot: (body: unknown) => unknown;

  constructor(deps: BaseDexDeps & { id: string }) {
    this.id = deps.id;
    this.info = deps.info;
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clock = deps.clock ?? Date.now;
    this.subgraphUrl = deps.subgraphUrl;
    this.factoryAddress = deps.factoryAddress;
    this.poolQuery = deps.poolQuery;
    this.parsePool = deps.parsePool;
    this.parseSnapshot = deps.parseSnapshot;
    this.extractPools = deps.extractPools ?? defaultExtractPools;
    this.extractSnapshot = deps.extractSnapshot ?? defaultExtractSnapshot;
  }

  async discoverPools(): Promise<readonly DexPool[]> {
    const res = await this.fetchImpl(this.subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: this.poolQuery }),
    });
    const body = await safeJson<unknown>(res);
    if (!body) return [];
    const arr = this.extractPools(body);
    return arr.map((raw) => this.parsePool(raw)).filter((p): p is DexPool => p !== null);
  }

  async fetchPoolSnapshot(poolId: string): Promise<DexPoolSnapshot | null> {
    const query = `{ pool(id: "${poolId}") { id liquidity volumeUSD feeTier token0 { id symbol } token1 { id symbol } } }`;
    const res = await this.fetchImpl(this.subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const body = await safeJson<unknown>(res);
    if (!body) return null;
    const extracted = this.extractSnapshot(body);
    return this.parseSnapshot(extracted);
  }

  async health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }> {
    const started = this.clock();
    try {
      const res = await this.fetchImpl(this.subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
      });
      if (!res || !res.ok) return { status: 'degraded', latencyMs: this.clock() - started, checkedAt: this.clock() };
      return { status: 'active', latencyMs: this.clock() - started, checkedAt: this.clock() };
    } catch {
      return { status: 'maintenance', latencyMs: this.clock() - started, checkedAt: this.clock() };
    }
  }
}