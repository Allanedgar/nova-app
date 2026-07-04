/**
 * @nova-app/execution — 3-tier execution engine with circuit breakers,
 * retry with backoff, kill switch, and full audit log.
 *
 * Tiers:
 *   manual     — requires human approval
 *   simulated  — paper trading with simulated slippage and fees
 *   automated  — executes via configured strategy (connector API)
 */
export { ExecutionEngine } from './engine.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { AuditLog } from './audit-log.js';
export { createManualStrategy, createSimulatedStrategy, createAutomatedStrategy } from './strategies.js';
export type {
  ExecutionTier, ExecutionRequest, ExecutionResult, ExecutionLogEntry,
  CircuitBreakerState, ExecutionConfig, ExecutionStrategy,
} from './types.js';
export const NOVA_EXECUTION_VERSION = '0.2.0';