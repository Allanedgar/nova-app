import { describe, expect, it } from 'vitest';
import { createApp, createRouter, NOVA_API_VERSION } from '../index.js';
import type { ApiState, AssetOpportunityRow, OpportunitySummary } from '../types.js';

const opportunity: OpportunitySummary = {
  id: 'opp-1',
  symbol: 'BTC/USDT',
  type: 'spatial',
  route: 'Binance -> OKX',
  buyVenue: 'Binance',
  sellVenue: 'OKX',
  netProfitBps: 72.5,
  netProfitUsd: 7.25,
  confidenceScore: 0.82,
  riskScore: 24,
  detectedAt: 1_720_000_000_000,
  expiresAt: 1_720_000_030_000,
  status: 'valid',
};

const row: AssetOpportunityRow = {
  index: 0,
  baseAsset: 'ETH',
  buyHereName: 'Binance',
  buyHerePrice: 1762,
  sellHereName: 'OKX',
  sellHerePrice: 1764,
  arbitrage: 0.1135,
  grossSpreadBps: 11.35,
  estimatedFeeBps: 20,
  netSpreadBps: -8.65,
  routeType: 'cex-cex',
  buyQuoteAsset: 'USDT',
  sellQuoteAsset: 'USDT',
  detectedAt: 1_720_000_000_000,
};

describe('@nova-app/api router', () => {
  it('exports the API version and creates an app', () => {
    const app = createApp({ port: 8787 });

    expect(NOVA_API_VERSION).toBe('0.1.0');
    expect(app.config.port).toBe(8787);
    expect(app.state.isRunning).toBe(false);
  });

  it('serves health and opportunity summaries', async () => {
    const state: ApiState = { isRunning: true, startedAt: 1 };
    const router = createRouter({
      state,
      getOpportunities: () => [opportunity],
    });

    const health = await router(new Request('https://nova.local/health'));
    const healthBody = await health.json() as { ok: boolean; state: ApiState };

    const response = await router(new Request('https://nova.local/opportunities'));
    const body = await response.json() as { count: number; opportunities: OpportunitySummary[] };

    expect(healthBody.ok).toBe(true);
    expect(healthBody.state.isRunning).toBe(true);
    expect(body.count).toBe(1);
    expect(body.opportunities[0]).toEqual(opportunity);
  });

  it('returns 404 for unknown routes', async () => {
    const router = createRouter({ state: { isRunning: false } });
    const response = await router(new Request('https://nova.local/missing'));

    expect(response.status).toBe(404);
  });

  it('serves asset-first opportunity table rows', async () => {
    const router = createRouter({
      state: { isRunning: true },
      getOpportunityRows: () => [row],
    });

    const response = await router(new Request('https://nova.local/opportunities/table'));
    const body = await response.json() as { count: number; rows: AssetOpportunityRow[] };

    expect(body.count).toBe(1);
    expect(body.rows[0]).toEqual(row);
  });
});
