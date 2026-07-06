import type { ApiConfig, ApiState } from './types.js';
import { createRouter, type ApiHandler, type ApiRouteContext } from './router.js';
import { getCachedLiveAssetOpportunities, toOpportunitySummary } from './live-scanner.js';

export interface NovaApiApp {
  readonly config: ApiConfig;
  readonly state: ApiState;
  readonly fetch: ApiHandler;
}

const DEFAULT_CONFIG: ApiConfig = {
  port: 3000,
  host: '0.0.0.0',
  corsOrigin: '*',
  pipeline: {
    cronIntervalMs: 60_000,
    defaultNotionalUsd: 1_000,
    minProfitBps: 50,
  },
};

export function createApp(
  config: Partial<ApiConfig> = {},
  context: Partial<ApiRouteContext> = {},
): NovaApiApp {
  const state: ApiState = {
    isRunning: false,
    startedAt: Date.now(),
  };
  const mergedConfig: ApiConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    pipeline: {
      ...DEFAULT_CONFIG.pipeline,
      ...config.pipeline,
    },
  };

  return {
    config: mergedConfig,
    state,
    fetch: createRouter({
      ...context,
      getOpportunities: context.getOpportunities ?? (async () =>
        (await getCachedLiveAssetOpportunities()).map(toOpportunitySummary)
      ),
      getOpportunityRows: context.getOpportunityRows ?? (() => getCachedLiveAssetOpportunities()),
      state,
    }),
  };
}
