/**
 * @nova-app/api — backend entrypoints for Nova.
 * Minimal typed API surface: app bootstrap, health, discovery, opportunities.
 */

export const NOVA_API_VERSION = '0.1.0';

export type {
  ApiConfig, ApiState, AssetOpportunityRow, ConnectorSummary, OpportunityRouteType,
  OpportunitySummary, PipelineResult, PipelineStats
} from './types.js';

export { createApp } from './app.js';
export { createRouter } from './router.js';
export { getCachedLiveAssetOpportunities, scanLiveAssetOpportunities, toOpportunitySummary } from './live-scanner.js';
export { startServer } from './server.js';
