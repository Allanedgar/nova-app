/**
 * Core types for the Execution Engine.
 * Supports 3 tiers: manual, simulation, automated.
 */
export type ExecutionTier = 'manual' | 'simulated' | 'automated';

export interface ExecutionRequest {
  readonly opportunityId: string;
  readonly tier: ExecutionTier;
  readonly venueId: string;
  readonly pair: { base: string; quote: string };
  readonly side: 'buy' | 'sell';
  readonly price: number;
  readonly quantity: number;
  readonly notionalUsd: number;
  readonly maxSlippageBps: number;
  readonly timeoutMs: number;
}

export interface ExecutionResult {
  readonly status: 'filled' | 'partial' | 'rejected' | 'timeout' | 'error' | 'simulated';
  readonly tradeId?: string;
  readonly filledQty: number;
  readonly avgPrice: number;
  readonly feePaid: number;
  readonly timestamp: number;
  readonly error?: string;
}

export interface ExecutionLogEntry {
  readonly id: string;
  readonly request: ExecutionRequest;
  readonly result: ExecutionResult;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly latencyMs: number;
}

export interface CircuitBreakerState {
  readonly consecutiveFailures: number;
  readonly lastFailureAt: number;
  readonly isOpen: boolean;
  readonly openedAt: number;
  readonly cooldownMs: number;
}

export interface ExecutionConfig {
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly circuitBreakerThreshold: number;
  readonly circuitBreakerCooldownMs: number;
  readonly maxConcurrentOrders: number;
  readonly defaultTimeoutMs: number;
}

export interface ExecutionStrategy {
  readonly id: string;
  readonly tier: ExecutionTier;
  readonly canExecute: (req: ExecutionRequest) => boolean;
  readonly execute: (req: ExecutionRequest) => Promise<ExecutionResult>;
}