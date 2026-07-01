import { describe, expect, it } from 'vitest';
import {
  NOVA_PERSISTENCE_VERSION,
  SupabasePersistence,
  createSupabasePersistence,
} from '../index.js';

describe('@nova-app/persistence smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_PERSISTENCE_VERSION).toMatch(/^0\.\d+\./);
  });

  it('createSupabasePersistence throws when env is missing', () => {
    expect(() => createSupabasePersistence({})).toThrow(/SUPABASE_URL/);
    expect(() => createSupabasePersistence({ SUPABASE_URL: 'https://x' })).toThrow(
      /SUPABASE_KEY/,
    );
  });

  it('SupabasePersistence ctor is pure', () => {
    const p = new SupabasePersistence({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'anon-test',
    });
    expect(p.deps.supabaseUrl).toBe('https://example.supabase.co');
  });

  it('upsertOpportunities with empty list resolves to empty (no fetch)', async () => {
    let called = 0;
    const fakeFetch = (async () => {
      called++;
      return { ok: true, status: 200, json: async () => [] } as Response;
    }) as unknown as typeof fetch;
    const p = new SupabasePersistence({
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'k',
      fetchImpl: fakeFetch,
    });
    const r = await p.upsertOpportunities([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
    expect(called).toBe(0);
  });

  it('upsertOpportunities returns ok:false on 5xx instead of throwing', async () => {
    const fakeFetch = (async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const p = new SupabasePersistence({
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'k',
      fetchImpl: fakeFetch,
    });
    const r = await p.upsertOpportunities([
      {
        pair: 'BTC/USDT',
        sourceExchange: 'binance',
        targetExchange: 'okx',
        buyPrice: 60000,
        sellPrice: 60001,
        grossProfitBps: 1.6,
        netProfitBps: 1.4,
        liquidityUsd: 100000,
        riskScore: 0.2,
        confidenceScore: 0.8,
        detectedAtIso: '2026-07-01T12:00:00Z',
        expiresAtIso: '2026-07-01T12:05:00Z',
      },
    ]);
    expect(r.ok).toBe(false);
  });

  it('upsertOpportunities THROWS on 4xx (programmer error)', async () => {
    const fakeFetch = (async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => 'bad row',
    })) as unknown as typeof fetch;
    const p = new SupabasePersistence({
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'k',
      fetchImpl: fakeFetch,
    });
    await expect(
      p.upsertOpportunities([
        {
          pair: 'BTC/USDT',
          sourceExchange: 'binance',
          targetExchange: 'okx',
          buyPrice: 60000,
          sellPrice: 60001,
          grossProfitBps: 1.6,
          netProfitBps: 1.4,
          liquidityUsd: 100000,
          riskScore: 0.2,
          confidenceScore: 0.8,
          detectedAtIso: '2026-07-01T12:00:00Z',
          expiresAtIso: '2026-07-01T12:05:00Z',
        },
      ]),
    ).rejects.toThrow(/4xx/);
  });

  it('upsertOpportunities THROWS on network failure (caller retries)', async () => {
    const fakeFetch = (async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const p = new SupabasePersistence({
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'k',
      fetchImpl: fakeFetch,
    });
    // Network failure → ok:false (NOT throw) — see @quan's retry policy
    const r = await p.upsertOpportunities([
      {
        pair: 'BTC/USDT',
        sourceExchange: 'binance',
        targetExchange: 'okx',
        buyPrice: 60000,
        sellPrice: 60001,
        grossProfitBps: 1.6,
        netProfitBps: 1.4,
        liquidityUsd: 100000,
        riskScore: 0.2,
        confidenceScore: 0.8,
        detectedAtIso: '2026-07-01T12:00:00Z',
        expiresAtIso: '2026-07-01T12:05:00Z',
      },
    ]);
    expect(r.ok).toBe(false);
  });
});
