/**
 * Circuit Breaker — prevents cascading failures by halting executions
 * after consecutive failures exceed a threshold.
 */
import type { CircuitBreakerState } from './types.js';

export class CircuitBreaker {
  private readonly _state: Map<string, CircuitBreakerState> = new Map();
  private readonly _threshold: number;
  private readonly _cooldownMs: number;

  constructor(threshold: number = 3, cooldownMs: number = 30_000) {
    this._threshold = threshold;
    this._cooldownMs = cooldownMs;
  }

  isOpen(venueId: string): boolean {
    const state = this._state.get(venueId);
    if (!state) return false;
    if (!state.isOpen) return false;
    const elapsed = Date.now() - state.openedAt;
    if (elapsed >= state.cooldownMs) {
      this._state.delete(venueId);
      return false;
    }
    return true;
  }

  recordSuccess(venueId: string): void {
    const state = this._state.get(venueId);
    if (state) {
      this._state.set(venueId, { ...state, consecutiveFailures: 0 });
    }
  }

  recordFailure(venueId: string): void {
    const now = Date.now();
    const current = this._state.get(venueId) ?? {
      consecutiveFailures: 0, lastFailureAt: 0, isOpen: false, openedAt: 0, cooldownMs: this._cooldownMs,
    };
    const consecutiveFailures = current.consecutiveFailures + 1;
    const isOpen = consecutiveFailures >= this._threshold;
    this._state.set(venueId, {
      consecutiveFailures, lastFailureAt: now, isOpen, openedAt: isOpen ? now : current.openedAt, cooldownMs: this._cooldownMs,
    });
  }

  reset(): void {
    this._state.clear();
  }

  get snapshot(): readonly { venueId: string; state: CircuitBreakerState }[] {
    return Array.from(this._state.entries()).map(([venueId, state]) => ({ venueId, state }));
  }
}