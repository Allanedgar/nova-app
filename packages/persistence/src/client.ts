/**
 * @nova-app/persistence — Supabase writer/reader via PostgREST.
 * Per docs/14_DATABASE_SCHEMA.md (Phase 1 subset) + docs/02_PHASED_ROADMAP.md
 * Task 1.8.
 *
 * Transport: PostgREST. We POST rows as JSON and return the resulting rows.
 *
 * Errors:
 * - 4xx → rejected promise (programmer error: malformed row)
 * - 5xx → caught and returned as `{ ok: false }` so the detector can
 *   continue a tick even if persistence is degraded
 * - network failure → caught and returned as `{ ok: false }`
 */

export interface OpportunityRow {
  readonly pair: string;
  readonly sourceExchange: string;
  readonly targetExchange: string;
  readonly buyPrice: number;
  readonly sellPrice: number;
  readonly grossProfitBps: number;
  readonly netProfitBps: number;
  readonly liquidityUsd: number;
  readonly riskScore: number;
  readonly confidenceScore: number;
  readonly detectedAtIso: string;
  readonly expiresAtIso: string;
}

export interface DiscoveredPairRow {
  readonly connectorId: string;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly symbol: string;
  readonly chain: string | null;
  readonly status: string;
  readonly firstSeenAtIso?: string;
  readonly lastObservedAtIso?: string;
}

export interface PriceSnapshotRow {
  readonly connectorId: string;
  readonly pair: string;
  readonly bid: number;
  readonly ask: number;
  readonly observedAtIso: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SupabasePersistenceDeps {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
  readonly fetchImpl?: typeof fetch;
}

const buildHeaders = (key: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`,
});

const toOpportunitySnake = (o: OpportunityRow): Record<string, unknown> => ({
  pair: o.pair,
  source_exchange: o.sourceExchange,
  target_exchange: o.targetExchange,
  buy_price: o.buyPrice,
  sell_price: o.sellPrice,
  gross_profit_bps: o.grossProfitBps,
  net_profit_bps: o.netProfitBps,
  liquidity_usd: o.liquidityUsd,
  risk_score: o.riskScore,
  confidence_score: o.confidenceScore,
  detected_at: o.detectedAtIso,
  expires_at: o.expiresAtIso,
});

const toPairSnake = (p: DiscoveredPairRow): Record<string, unknown> => ({
  connector_id: p.connectorId,
  base_asset: p.baseAsset,
  quote_asset: p.quoteAsset,
  symbol: p.symbol,
  chain: p.chain,
  status: p.status,
  first_seen_at: p.firstSeenAtIso ?? null,
  last_observed_at: p.lastObservedAtIso ?? null,
});

const toSnapshotSnake = (s: PriceSnapshotRow): Record<string, unknown> => ({
  connector_id: s.connectorId,
  pair: s.pair,
  bid: s.bid,
  ask: s.ask,
  observed_at: s.observedAtIso,
});

async function postgRestPost<T>(
  deps: SupabasePersistenceDeps,
  table: string,
  rows: readonly Record<string, unknown>[],
): Promise<Result<T[]>> {
  if (rows.length === 0) return { ok: true, value: [] };
  const url = `${deps.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
  const f = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST',
      headers: { ...buildHeaders(deps.supabaseKey), Prefer: 'return=representation' },
      body: JSON.stringify(rows),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (res.status >= 500) return { ok: false, error: `Supabase 5xx: ${res.status}` };
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase 4xx (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as T[];
  return { ok: true, value: data };
}

async function postgRestGet<T>(
  deps: SupabasePersistenceDeps,
  path: string,
): Promise<Result<T[]>> {
  const url = `${deps.supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`;
  const f = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let res: Response;
  try {
    res = await f(url, {
      method: 'GET',
      headers: buildHeaders(deps.supabaseKey),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) throw new Error(`Supabase 5xx/4xx (${res.status}) on GET ${path}`);
  const data = (await res.json()) as T[];
  return { ok: true, value: data };
}

export class SupabasePersistence {
  readonly deps: SupabasePersistenceDeps;

  constructor(deps: SupabasePersistenceDeps) {
    this.deps = deps;
  }

  async upsertOpportunities(
    opps: readonly OpportunityRow[],
  ): Promise<Result<readonly { id: string }[]>> {
    if (opps.length === 0) return { ok: true, value: [] };
    const r = await postgRestPost<{ id: string }>(
      this.deps,
      'opportunities',
      opps.map(toOpportunitySnake),
    );
    if (r.ok) return { ok: true, value: r.value.map((row) => ({ id: row.id })) };
    return r;
  }

  async getRecentOpportunities(limit: number): Promise<Result<readonly OpportunityRow[]>> {
    const r: Result<Record<string, unknown>[]> = await postgRestGet(
      this.deps,
      `opportunities?order=detected_at.desc&limit=${limit}`,
    );
    if (!r.ok) return r;
    const mapped: OpportunityRow[] = r.value.map(
      (row): OpportunityRow => ({
        pair: String(row.pair),
        sourceExchange: String(row.source_exchange),
        targetExchange: String(row.target_exchange),
        buyPrice: Number(row.buy_price),
        sellPrice: Number(row.sell_price),
        grossProfitBps: Number(row.gross_profit_bps),
        netProfitBps: Number(row.net_profit_bps),
        liquidityUsd: Number(row.liquidity_usd ?? 0),
        riskScore: Number(row.risk_score ?? 0),
        confidenceScore: Number(row.confidence_score ?? 0),
        detectedAtIso: String(row.detected_at),
        expiresAtIso: String(row.expires_at),
      }),
    );
    return { ok: true, value: mapped };
  }

  async upsertDiscoveredPairs(
    rows: readonly DiscoveredPairRow[],
  ): Promise<Result<readonly { symbol: string; connector_id: string }[]>> {
    if (rows.length === 0) return { ok: true, value: [] };
    const r = await postgRestPost<{ symbol: string; connector_id: string }>(
      this.deps,
      'discovered_pairs',
      rows.map(toPairSnake),
    );
    return r;
  }

  async insertPriceSnapshots(
    rows: readonly PriceSnapshotRow[],
  ): Promise<Result<readonly { id: string }[]>> {
    if (rows.length === 0) return { ok: true, value: [] };
    const r = await postgRestPost<{ id: string }>(
      this.deps,
      'price_snapshots',
      rows.map(toSnapshotSnake),
    );
    if (r.ok) return { ok: true, value: r.value.map((row) => ({ id: row.id })) };
    return r;
  }
}

/** Factory — reads env, returns a SupabasePersistence instance. */
export function createSupabasePersistence(env: {
  SUPABASE_URL?: string;
  SUPABASE_KEY?: string;
}): SupabasePersistence {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      'createSupabasePersistence: SUPABASE_URL and SUPABASE_KEY are required',
    );
  }
  return new SupabasePersistence({ supabaseUrl: url, supabaseKey: key });
}
