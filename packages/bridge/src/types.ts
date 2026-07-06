/**
 * Core types for the bridge connector system.
 */
export interface BridgeInfo {
  readonly id?: string;
  readonly name: string;
  readonly code?: string;
  readonly url?: string;
  readonly website?: string;
  readonly supportedChains: readonly (string | number)[];
  readonly feeStructure?: string;
  readonly avgTransferTimeMs?: number;
  readonly hasNativeToken?: boolean;
}

export interface BridgeRoute {
  readonly id?: string;
  readonly bridgeId?: string;
  readonly sourceChain?: string;
  readonly destinationChain?: string;
  readonly originChainId?: number;
  readonly destinationChainId?: number;
  readonly tokenSymbol?: string;
  readonly tokenAddress?: string;
  readonly originToken?: string;
  readonly destinationToken?: string;
  readonly estimatedFee?: string;
  readonly estimatedFeeUsd?: number;
  readonly estimatedTimeMs?: number;
  readonly minAmount?: string;
  readonly maxAmount?: string;
  readonly liquidity?: string;
  readonly isActive?: boolean;
}

export interface BridgeQuote {
  readonly routeId?: string;
  readonly bridgeId?: string;
  readonly originChainId?: number;
  readonly destinationChainId?: number;
  readonly originToken?: string;
  readonly destinationToken?: string;
  readonly amount: string;
  readonly estimatedFee?: string;
  readonly estimatedFeeUsd?: number;
  readonly estimatedTimeMs: number;
  readonly maxSlippage?: number;
  readonly bridgeFee?: string;
  readonly gasFee?: string;
  readonly totalFee?: string;
  readonly feePct?: string;
  readonly relayGasFeePct?: string;
  readonly lpFeePct?: string;
  readonly expiresAt?: number;
}

export interface BridgeConnector {
  readonly id: string;
  readonly kind: 'bridge';
  readonly info: BridgeInfo;
  fetchRoutes(): Promise<readonly BridgeRoute[]>;
  getQuote(route: BridgeRoute | string, amount: string): Promise<BridgeQuote | null>;
  health(): Promise<{ status: 'active' | 'degraded' | 'maintenance'; latencyMs: number; checkedAt: number }>;
}
