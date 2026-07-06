import type { ApiState, AssetOpportunityRow, ConnectorSummary, OpportunitySummary } from './types.js';

export interface ApiRouteContext {
  readonly state: ApiState;
  readonly getOpportunities?: () => readonly OpportunitySummary[] | Promise<readonly OpportunitySummary[]>;
  readonly getOpportunityRows?: () => readonly AssetOpportunityRow[] | Promise<readonly AssetOpportunityRow[]>;
  readonly getConnectors?: () => readonly ConnectorSummary[] | Promise<readonly ConnectorSummary[]>;
}

export type ApiHandler = (request: Request) => Promise<Response>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export function createRouter(context: ApiRouteContext): ApiHandler {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({
        ok: !context.state.error,
        state: context.state,
        checkedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === '/connectors') {
      const connectors = await context.getConnectors?.();
      return json({
        connectors: connectors ?? [],
        count: connectors?.length ?? 0,
        checkedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === '/opportunities') {
      const opportunities = await context.getOpportunities?.();
      return json({
        opportunities: opportunities ?? [],
        count: opportunities?.length ?? 0,
        checkedAt: new Date().toISOString(),
      });
    }

    if (url.pathname === '/opportunities/table') {
      const rows = await context.getOpportunityRows?.();
      return json({
        rows: rows ?? [],
        count: rows?.length ?? 0,
        checkedAt: new Date().toISOString(),
      });
    }

    return json({ error: 'not found', path: url.pathname }, 404);
  };
}
