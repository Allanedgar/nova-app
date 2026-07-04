/**
 * Execution Engine — simulates and executes arbitrage trades.
 * Includes full simulation pipeline: order → fee → slippage → latency → bridge.
 */
import type { ScoredOpportunity, PublishedOpportunity, OpportunityStatus } from '../types/opportunity.js';
import type { EventBus } from '../publisher/event-bus.js';

export interface SimulatedFill {
  opportunityId: string;
  legIndex: number;
  expectedPrice: number;
  actualPrice: number;
  slippagePct: number;
  filled: boolean;
  fillPct: number;
  latencyMs: number;
}

export interface SimulationResult {
  opportunityId: string;
  fills: SimulatedFill[];
  totalSlippagePct: number;
  totalFeesPct: number;
  totalLatencyMs: number;
  netProfitPct: number;
  success: boolean;
}

export interface CircuitBreakerConfig {
  maxLossPerTrade: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  maxConcurrentTrades: number;
  cooldownAfterLossMs: number;
  minConfidenceScore: number;
  minExecutionProbability: number;
  maxSlippagePct: number;
  maxLatencyMs: number;
}

export class ExecutionSimulator {
  private eventBus: EventBus;
  private activeTrades = 0;
  private dailyLoss = 0;
  private lastLossAt = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async simulate(opportunity: ScoredOpportunity): Promise<SimulationResult> {
    const fills: SimulatedFill[] = [];

    for (let i = 0; i < opportunity.legs.length; i++) {
      const leg = opportunity.legs[i]!;
      const expectedPrice = parseFloat(leg.expectedPrice);
      const slippage = (Math.random() - 0.5) * opportunity.expectedSlippage * 2;
      const actualPrice = expectedPrice * (1 + slippage * (leg.action === 'buy' ? 1 : -1));
      const fillPct = Math.random() > 0.1 ? 0.95 + Math.random() * 0.05 : 0.5 + Math.random() * 0.4;
      const latency = opportunity.expectedLatencyMs * (0.5 + Math.random());

      fills.push({
        opportunityId: opportunity.id,
        legIndex: i,
        expectedPrice,
        actualPrice,
        slippagePct: Math.abs(slippage) * 100,
        filled: fillPct > 0.5,
        fillPct,
        latencyMs: Math.round(latency),
      });
    }

    const totalSlippage = fills.reduce((s, f) => s + f.slippagePct, 0);
    const totalLatency = fills.reduce((s, f) => s + f.latencyMs, 0);
    const allFilled = fills.every(f => f.filled);
    const netProfitPct = allFilled ? opportunity.netProfitPct - totalSlippage : -opportunity.netProfitPct;

    return {
      opportunityId: opportunity.id,
      fills,
      totalSlippagePct: Math.round(totalSlippage * 100) / 100,
      totalFeesPct: opportunity.estimatedFeesPct,
      totalLatencyMs: totalLatency,
      netProfitPct: Math.round(netProfitPct * 10000) / 10000,
      success: allFilled && netProfitPct > 0,
    };
  }

  async execute(opportunity: ScoredOpportunity): Promise<SimulationResult> {
    if (!this.checkCircuitBreakers(opportunity)) {
      return {
        opportunityId: opportunity.id,
        fills: [],
        totalSlippagePct: 0,
        totalFeesPct: opportunity.estimatedFeesPct,
        totalLatencyMs: 0,
        netProfitPct: 0,
        success: false,
      };
    }

    this.activeTrades++;
    const result = await this.simulate(opportunity);
    this.activeTrades--;

    if (!result.success) {
      this.dailyLoss += Math.abs(result.netProfitPct);
      this.lastLossAt = Date.now();
    }

    this.eventBus.emit({
      type: result.success ? 'opportunity.executed' : 'opportunity.failed',
      opportunity: { ...opportunity, status: result.success ? 'executed' : 'failed' } as any,
      ...(result.success ? {} : { error: `Simulation failed: ${result.netProfitPct}%` }),
    } as any);

    return result;
  }

  private checkCircuitBreakers(opportunity: ScoredOpportunity): boolean {
    if (this.activeTrades >= 5) return false;
    if (this.dailyLoss > 10) return false;
    if (Date.now() - this.lastLossAt < 60000 && this.lastLossAt > 0) return false;
    if (opportunity.confidenceScore < 70) return false;
    if (opportunity.executionProbability < 0.8) return false;
    if (opportunity.expectedSlippage > 0.5) return false;
    if (opportunity.expectedLatencyMs > 2000) return false;
    return true;
  }

  getActiveTrades(): number { return this.activeTrades; }
  getDailyLoss(): number { return this.dailyLoss; }
  resetDailyLoss(): void { this.dailyLoss = 0; }
}