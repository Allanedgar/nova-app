import type { BridgeConnector, BridgeQuote, BridgeRoute } from '@nova-app/bridge';

export interface BridgeRouteWithQuote {
  readonly connectorId: string;
  readonly route: BridgeRoute;
  readonly quote: BridgeQuote | null;
}

export interface BridgeRpcResult {
  readonly routes: readonly BridgeRoute[];
  readonly quotes: readonly BridgeRouteWithQuote[];
  readonly errors: readonly string[];
}

export class BridgeRpcSource {
  async fetchRoutesAndQuotes(
    connectors: readonly BridgeConnector[],
    amount: string,
    maxRoutesPerConnector = 10,
  ): Promise<BridgeRpcResult> {
    const routes: BridgeRoute[] = [];
    const quotes: BridgeRouteWithQuote[] = [];
    const errors: string[] = [];

    for (const connector of connectors) {
      try {
        const discovered = await connector.fetchRoutes();
        const selected = discovered.slice(0, maxRoutesPerConnector);
        routes.push(...selected);

        for (const route of selected) {
          const quote = await connector.getQuote(route.id ?? route, amount);
          quotes.push({ connectorId: connector.id, route, quote });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${connector.id}: ${message}`);
      }
    }

    return { routes, quotes, errors };
  }
}
