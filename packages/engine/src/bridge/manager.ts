/**
 * Bridge Manager — abstract interface for all bridge providers.
 * Implementations: Li.Fi, Across, Wormhole, Socket, LayerZero, Stargate.
 */
export interface BridgeQuoteParams {
  sourceChainId: number;
  destinationChainId: number;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  user?: string;
  slippage?: number;
}

export interface BridgeQuote {
  bridgeId: string;
  sourceChainId: number;
  destinationChainId: number;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  estimatedAmount: string;
  feePct: string;
  feeAmount: string;
  estimatedTimeMs: number;
  gasCost: string;
  expiresAt: number;
}

export interface BridgeRoute {
  bridgeId: string;
  sourceChainId: number;
  destinationChainId: number;
  sourceToken: string;
  destinationToken: string;
  estimatedTimeMs: number;
  maxAmount?: string;
}

export interface BridgeStatus {
  bridgeId: string;
  active: boolean;
  supportedChains: number[];
  tvl?: string;
  totalVolume?: string;
  uptimePct?: number;
  lastIncident?: number;
}

export interface BridgeManager {
  /** Get quote for bridging tokens */
  getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null>;

  /** Get all available routes */
  getRoutes(): Promise<BridgeRoute[]>;

  /** Get bridge status */
  getStatus(bridgeId: string): Promise<BridgeStatus>;

  /** Estimate bridge time */
  estimateTime(sourceChainId: number, destinationChainId: number): Promise<number>;

  /** Get supported chains */
  getSupportedChains(): Promise<number[]>;
}

export class CompositeBridgeManager implements BridgeManager {
  private adapters: Map<string, BridgeManager> = new Map();

  register(bridgeId: string, adapter: BridgeManager): void {
    this.adapters.set(bridgeId, adapter);
  }

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    let best: BridgeQuote | null = null;
    for (const adapter of this.adapters.values()) {
      try {
        const quote = await adapter.getQuote(params);
        if (quote && (!best || Number(quote.feePct) < Number(best.feePct))) {
          best = quote;
        }
      } catch { /* skip failed adapter */ }
    }
    return best;
  }

  async getRoutes(): Promise<BridgeRoute[]> {
    const all: BridgeRoute[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const routes = await adapter.getRoutes();
        all.push(...routes);
      } catch { /* skip */ }
    }
    return all;
  }

  async getStatus(bridgeId: string): Promise<BridgeStatus> {
    const adapter = this.adapters.get(bridgeId);
    if (!adapter) throw new Error(`Bridge adapter not found: ${bridgeId}`);
    return adapter.getStatus(bridgeId);
  }

  async estimateTime(sourceChainId: number, destinationChainId: number): Promise<number> {
    let minTime = Infinity;
    for (const adapter of this.adapters.values()) {
      try {
        const time = await adapter.estimateTime(sourceChainId, destinationChainId);
        if (time < minTime) minTime = time;
      } catch { /* skip */ }
    }
    return minTime === Infinity ? 120_000 : minTime;
  }

  async getSupportedChains(): Promise<number[]> {
    const chains = new Set<number>();
    for (const adapter of this.adapters.values()) {
      try {
        const c = await adapter.getSupportedChains();
        c.forEach(id => chains.add(id));
      } catch { /* skip */ }
    }
    return Array.from(chains);
  }
}