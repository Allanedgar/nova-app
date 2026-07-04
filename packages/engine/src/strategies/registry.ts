/**
 * Strategy Registry — manages registration and discovery of strategy plugins.
 */
import type { ArbitrageStrategy, StrategyRegistry } from './interface.js';
import type { OpportunityKind } from '../types/opportunity.js';

export class DefaultStrategyRegistry implements StrategyRegistry {
  private strategies: Map<string, ArbitrageStrategy> = new Map();

  register(strategy: ArbitrageStrategy): void {
    if (this.strategies.has(strategy.id)) {
      throw new Error(`Strategy already registered: ${strategy.id}`);
    }
    this.strategies.set(strategy.id, strategy);
    strategy.onRegister?.();
  }

  unregister(strategyId: string): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.onUnregister?.();
      this.strategies.delete(strategyId);
    }
  }

  getAll(): ArbitrageStrategy[] {
    return Array.from(this.strategies.values());
  }

  get(id: string): ArbitrageStrategy | undefined {
    return this.strategies.get(id);
  }

  getByKind(kind: OpportunityKind): ArbitrageStrategy[] {
    return this.getAll().filter(s => s.kind === kind);
  }

  count(): number {
    return this.strategies.size;
  }

  clear(): void {
    for (const id of this.strategies.keys()) {
      this.unregister(id);
    }
  }
}