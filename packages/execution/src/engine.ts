/**
 * ExecutionEngine — institutional-grade order execution with:
 *   - 3 tiers: manual, simulated, automated
 *   - Circuit breakers per venue
 *   - Retry with backoff
 *   - Kill switch (global halt)
 *   - Full audit log
 */
import type { ExecutionRequest, ExecutionResult, ExecutionConfig, ExecutionStrategy } from './types.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { AuditLog } from './audit-log.js';
import { createManualStrategy, createSimulatedStrategy, createAutomatedStrategy } from './strategies.js';

const DEFAULT_CONFIG: ExecutionConfig = {
  maxRetries: 3,
  retryDelayMs: 1_000,
  circuitBreakerThreshold: 3,
  circuitBreakerCooldownMs: 30_000,
  maxConcurrentOrders: 10,
  defaultTimeoutMs: 30_000,
};

export class ExecutionEngine {
  private readonly config: ExecutionConfig;
  readonly circuitBreaker: CircuitBreaker;
  readonly auditLog: AuditLog;
  private readonly strategies: Map<string, ExecutionStrategy> = new Map();
  private _isKillSwitchActive = false;
  private _activeOrders = 0;

  constructor(config?: Partial<ExecutionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerCooldownMs,
    );
    this.auditLog = new AuditLog();

    // Register default strategies
    this.strategies.set('manual', createManualStrategy());
    this.strategies.set('simulated', createSimulatedStrategy());
    this.strategies.set('automated', createAutomatedStrategy());
  }

  get isKillSwitchActive(): boolean {
    return this._isKillSwitchActive;
  }

  get activeOrders(): number {
    return this._activeOrders;
  }

  registerCustomStrategy(strategy: ExecutionStrategy): void {
    this.strategies.set(strategy.tier, strategy);
  }

  activateKillSwitch(): void {
    this._isKillSwitchActive = true;
  }

  deactivateKillSwitch(): void {
    this._isKillSwitchActive = false;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = Date.now();

    // 1. Kill switch check
    if (this._isKillSwitchActive) {
      const result: ExecutionResult = {
        status: 'rejected', filledQty: 0, avgPrice: 0, feePaid: 0,
        timestamp: Date.now(), error: 'kill switch active',
      };
      this.auditLog.record(request, result, startedAt, Date.now());
      return result;
    }

    // 2. Circuit breaker check
    if (this.circuitBreaker.isOpen(request.venueId)) {
      const result: ExecutionResult = {
        status: 'rejected', filledQty: 0, avgPrice: 0, feePaid: 0,
        timestamp: Date.now(), error: `circuit breaker open for venue ${request.venueId}`,
      };
      this.auditLog.record(request, result, startedAt, Date.now());
      return result;
    }

    // 3. Find strategy
    const strategy = this.strategies.get(request.tier);
    if (!strategy) {
      const result: ExecutionResult = {
        status: 'rejected', filledQty: 0, avgPrice: 0, feePaid: 0,
        timestamp: Date.now(), error: `no strategy for tier ${request.tier}`,
      };
      this.auditLog.record(request, result, startedAt, Date.now());
      return result;
    }

    // 4. Capacity check
    if (this._activeOrders >= this.config.maxConcurrentOrders) {
      const result: ExecutionResult = {
        status: 'rejected', filledQty: 0, avgPrice: 0, feePaid: 0,
        timestamp: Date.now(), error: 'max concurrent orders reached',
      };
      this.auditLog.record(request, result, startedAt, Date.now());
      return result;
    }

    // 5. Strategy pre-check
    if (!strategy.canExecute(request)) {
      const result: ExecutionResult = {
        status: 'rejected', filledQty: 0, avgPrice: 0, feePaid: 0,
        timestamp: Date.now(), error: 'strategy pre-check failed',
      };
      this.auditLog.record(request, result, startedAt, Date.now());
      return result;
    }

    // 6. Execute with retries
    this._activeOrders++;
    try {
      return await this.#executeWithRetries(request, strategy, startedAt);
    } finally {
      this._activeOrders--;
    }
  }

  async #executeWithRetries(
    request: ExecutionRequest,
    strategy: ExecutionStrategy,
    startedAt: number,
  ): Promise<ExecutionResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const timeoutMs = request.timeoutMs || this.config.defaultTimeoutMs;
        const result = await this.#executeWithTimeout(strategy, request, timeoutMs);

        if (result.status === 'filled' || result.status === 'simulated' || result.status === 'partial') {
          this.circuitBreaker.recordSuccess(request.venueId);
          this.auditLog.record(request, result, startedAt, Date.now());
          return result;
        }

        lastError = result.error ?? 'execution failed';
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
      }

      if (attempt < this.config.maxRetries) {
        await this.#sleep(this.config.retryDelayMs * (attempt + 1));
      }
    }

    this.circuitBreaker.recordFailure(request.venueId);
    const result: ExecutionResult = {
      status: 'error', filledQty: 0, avgPrice: 0, feePaid: 0,
      timestamp: Date.now(), error: lastError ?? 'max retries exceeded',
    };
    this.auditLog.record(request, result, startedAt, Date.now());
    return result;
  }

  async #executeWithTimeout(
    strategy: ExecutionStrategy,
    request: ExecutionRequest,
    timeoutMs: number,
  ): Promise<ExecutionResult> {
    return Promise.race([
      strategy.execute(request),
      new Promise<ExecutionResult>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      ),
    ]);
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}