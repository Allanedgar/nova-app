/**
 * BaseBridgeConnector — shared implementation for all bridge connectors.
 * Each bridge connector wraps a REST API or SDK to discover routes and fetch quotes.
 */
import type { BridgeInfo, BridgeRoute, BridgeQuote, BridgeConnector } from './types.js';

export interface BaseBridgeDeps {
  readonly info: BridgeInfo;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
  readonly baseUrl: string;
  readonly routesPath: string;
  readonly quotePath: string;
  readonly parseRoute: (raw: unknown) => BridgeRoute | null;
  readonly parseQuote: (raw: unknown) => BridgeQuote | null;
  readonly extractRoutes?: (body: unknown) => unknown[];
  readonly extractQuote?: (body: unknown) => unknown;
}

const safeJson = async <T>(res: Response): Promise<T | null> => {
  if (!res.ok) return null;
  try { return (await res.json()) as T; } catch { return null; }
};

const defaultExtractArray = (body: unknown): unknown[] => {
  if (Array.isArray(body)) return body;
  const r = body as Record<string, unknown>;
  return (r.routes as unknown[]) ?? (r.data as unknown[]) ?? (r.result as unknown[]) ?? [];
};

const defaultExtractSingle = (body: unknown): unknown => {
  const r = body as Record<string, unknown>;
  return (r.quote as Record<string, unknown>) ?? (r.data as Record<string, unknown>) ?? r;
};

export class BaseBridgeConnector implements BridgeConnector {
  readonly id: string;
  readonly kind = 'bridge' as const;
  readonly info: BridgeInfo;

  protected readonly fetchImpl: typeof fetch;
  protected readonly clock: () => number;
  protected readonly baseUrl: string;
  protected readonly routesPath: string;
  protected readonly quotePath: string;
  protected readonly parseRoute: (raw: unknown) => BridgeRoute | null;
  protected readonly parseQuote: (raw: unknown) => BridgeQuote | null;
  protected readonly extractRoutes: (body: unknown) => unknown[];
  protected readonly extractQuote: (body: unknown) => unknown;

  constructor(deps: BaseBridgeDeps & { id: string }) {
    this.id = deps.id;
    this.info = deps.info;
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.clock = deps.clock ?? Date.now;
    this.baseUrl = deps.baseUrl;
    this.routesPath = deps.routesPath;
    this.quotePath = deps.quotePath;
    this.parseRoute = deps.parseRoute;
    this.parseQuote = deps.parseQuote;
    this.extractRoutes = deps.extractRoutes ?? defaultExtractArray;
    this.extractQuote = deps.extractQuote ?? defaultExtractSingle;
  }

  async fetchRoutes(): Promise<readonly BridgeRoute[]> {
    const url = `${this.baseUrl}${this.routesPath}`;
    const res = await this.fetchImpl(url);
    const body = await safeJson<unknown>(res);
    if (!body) return [];
    const arr = this.extractRoutes(body);
    return arr.map((raw) => this.parseRoute(raw)).filter((r): r is BridgeRoute => r !== null);
  }

  async getQuote(routeId: string, amount: string): Promise<BridgeQuote | null> {
    const url = `${this.baseUrl}${this.quotePath.replace('{routeId}', encodeURIComponent(routeId)).replace('{amount}', encodeURIComponent(amount))}`;
    const res = await this.fetchImpl(url);
    const body = await safeJson<unknown>(res);
    if (!body) return null;
    const extracted = this.extractQuote(body);
    return this.parseQuote(extracted);
  }

  async health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }> {
    const started = this.clock();
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/health`);
      if (!res || !res.ok) return { status: 'degraded', latencyMs: this.clock() - started, checkedAt: this.clock() };
      return { status: 'active', latencyMs: this.clock() - started, checkedAt: this.clock() };
    } catch {
      return { status: 'maintenance', latencyMs: this.clock() - started, checkedAt: this.clock() };
    }
  }
}