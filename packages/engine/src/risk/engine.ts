/**
 * Risk Engine — 15-dimensional risk assessment for every opportunity.
 */
import type { ScoredOpportunity } from '../types/opportunity.js';

export interface RiskAssessment {
  overallRiskScore: number;
  counterpartyRisk: number;
  bridgeRisk: number;
  oracleRisk: number;
  chainCongestion: number;
  gasSpikeRisk: number;
  rpcReliability: number;
  historicalFillRate: number;
  priceManipulationRisk: number;
  orderbookDepthRisk: number;
  washTradingRisk: number;
  stablecoinDepegRisk: number;
  fundingRateRisk: number;
  liquidationRisk: number;
  mevExposure: number;
  volatilityRisk: number;
  maxDrawdown: number;
  valueAtRisk95: number;
  sharpeRatio: number;
}

export interface RiskEngine {
  assess(opportunity: ScoredOpportunity): Promise<RiskAssessment>;
}

export class DefaultRiskEngine implements RiskEngine {
  async assess(opportunity: ScoredOpportunity): Promise<RiskAssessment> {
    const dimensions = {
      counterpartyRisk: this.evaluateCounterpartyRisk(opportunity),
      bridgeRisk: this.evaluateBridgeRisk(opportunity),
      oracleRisk: this.evaluateOracleRisk(opportunity),
      chainCongestion: 20,
      gasSpikeRisk: 15,
      rpcReliability: 10,
      historicalFillRate: this.evaluateFillRate(opportunity),
      priceManipulationRisk: this.evaluateManipulationRisk(opportunity),
      orderbookDepthRisk: this.evaluateDepthRisk(opportunity),
      washTradingRisk: 10,
      stablecoinDepegRisk: this.evaluateDepegRisk(opportunity),
      fundingRateRisk: 5,
      liquidationRisk: 5,
      mevExposure: this.evaluateMEVExposure(opportunity),
      volatilityRisk: this.evaluateVolatility(opportunity),
    };

    const weights = {
      counterpartyRisk: 0.15,
      bridgeRisk: 0.15,
      oracleRisk: 0.10,
      chainCongestion: 0.10,
      gasSpikeRisk: 0.05,
      rpcReliability: 0.05,
      historicalFillRate: 0.10,
      priceManipulationRisk: 0.05,
      orderbookDepthRisk: 0.10,
      washTradingRisk: 0.05,
      stablecoinDepegRisk: 0.05,
      fundingRateRisk: 0.05,
      liquidationRisk: 0.05,
      mevExposure: 0.05,
      volatilityRisk: 0.05,
    };

    const weighted = Object.entries(weights) as [keyof typeof weights, number][];
    const overallRiskScore = weighted.reduce(
      (sum, [key, weight]) => sum + (dimensions[key] as number) * weight,
      0
    );

    return {
      ...dimensions,
      overallRiskScore: Math.round(overallRiskScore),
      maxDrawdown: opportunity.netProfitPct * 2,
      valueAtRisk95: opportunity.netProfitPct * 1.65,
      sharpeRatio: opportunity.netProfitPct / (overallRiskScore / 100 + 0.01),
    };
  }

  private evaluateCounterpartyRisk(opp: ScoredOpportunity): number {
    const cexVenues = opp.legs.filter(l => l.venueKind === 'cex').length;
    return Math.max(0, cexVenues > 2 ? 30 : 50);
  }

  private evaluateBridgeRisk(opp: ScoredOpportunity): number {
    const bridgeLegs = opp.legs.filter(l => l.venueKind === 'bridge').length;
    return bridgeLegs > 0 ? 40 : 5;
  }

  private evaluateOracleRisk(opp: ScoredOpportunity): number {
    const dexLegs = opp.legs.filter(l => l.venueKind === 'dex').length;
    return dexLegs > 0 ? 25 : 5;
  }

  private evaluateFillRate(opp: ScoredOpportunity): number {
    return 100 - Math.round(opp.executionProbability * 100);
  }

  private evaluateManipulationRisk(opp: ScoredOpportunity): number {
    return opp.expectedSlippage > 0.5 ? 60 : 15;
  }

  private evaluateDepthRisk(opp: ScoredOpportunity): number {
    return opp.expectedSlippage > 0.3 ? 50 : 10;
  }

  private evaluateDepegRisk(opp: ScoredOpportunity): number {
    const usdtPairs = opp.legs.filter(l =>
      l.asset.includes('USDT') || l.asset.includes('USDC') || l.asset.includes('DAI')
    ).length;
    return usdtPairs > 0 ? 15 : 5;
  }

  private evaluateMEVExposure(opp: ScoredOpportunity): number {
    const dexLegs = opp.legs.filter(l => l.venueKind === 'dex');
    return dexLegs.length > 0 ? 35 : 5;
  }

  private evaluateVolatility(opp: ScoredOpportunity): number {
    const baseDev = opp.expectedSlippage * 100;
    return Math.min(100, Math.round(baseDev * 5));
  }
}