import type { Connector, PriceSnapshot, TradingPair } from '@nova-app/shared';

export interface RestMarketDataResult {
  readonly snapshots: readonly PriceSnapshot[];
  readonly errors: readonly string[];
}

export class RestMarketDataSource {
  async fetchTickers(
    pairs: readonly TradingPair[],
    connectors: readonly Connector[],
  ): Promise<RestMarketDataResult> {
    const snapshots: PriceSnapshot[] = [];
    const errors: string[] = [];

    for (const connector of connectors) {
      for (const pair of pairs) {
        try {
          const snapshot = await connector.fetchTicker(pair);
          if (snapshot) snapshots.push(snapshot);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${connector.id}:${pair.base}/${pair.quote}: ${message}`);
        }
      }
    }

    return { snapshots, errors };
  }
}
