# Risk Engine

**Document:** Phase 2 — Detection v2
**Cross-References:** [10_ARBITRAGE_ENGINE.md](10_ARBITRAGE_ENGINE.md), [21_EXECUTION_ENGINE.md](21_EXECUTION_ENGINE.md), [22_GUARDRAILS.md](22_GUARDRAILS.md)

---

## 1. Overview

The Risk Engine scores arbitrage opportunities across 5 factors to estimate execution risk. It prevents the system from executing opportunities that are likely to fail or lose money.

**Key Properties:**
- 5-factor scoring — Reliability, volume, age, spread, liquidity
- 0-100 scale — Lower is better
- Configurable thresholds — Per-user risk tolerance
- Real-time updates — Recalculates on each detection cycle

---

## 2. Risk Factors

### 2.1 Factor Definitions

```typescript
// packages/risk/src/score.ts
export interface RiskFactor {
  readonly name: string;
  readonly score: number;      // 0-100
  readonly weight: number;     // 0-1
  readonly details: string;
}

export interface RiskBreakdown {
  readonly factors: RiskFactor[];
  readonly totalScore: number; // 0-100
  readonly level: 'low' | 'medium' | 'high' | 'extreme';
}

export function scoreRisk(
  snapshots: PriceSnapshot[],
  opportunity: ArbitrageOpportunity
): RiskBreakdown {
  const factors = [
    scoreReliability(snapshots, opportunity),
    scoreVolume(snapshots, opportunity),
    scoreAge(snapshots, opportunity),
    scoreSpread(snapshots, opportunity),
    scoreLiquidity(snapshots, opportunity)
  ];
  
  const totalScore = weightedSum(
    factors.map(f => f.score),
    factors.map(f => f.weight)
  );
  
  return {
    factors,
    totalScore,
    level: getRiskLevel(totalScore)
  };
}
```

### 2.2 Reliability Score (30% weight)

Measures exchange reliability based on:
- Historical uptime
- API error rate
- Latency variance
- Withdrawal/deposit status

```typescript
function scoreReliability(
  snapshots: PriceSnapshot[],
  opp: ArbitrageOpportunity
): RiskFactor {
  const exchanges = [opp.sourceExchange, opp.targetExchange];
  const scores: number[] = [];
  
  for (const exchange of exchanges) {
    const health = getConnectorHealth(exchange);
    
    // Uptime score (0-100)
    const uptimeScore = health.uptime24h * 100;
    
    // Error rate score (0-100, lower errors = higher score)
    const errorRateScore = Math.max(0, 100 - (health.errorRate24h * 1000));
    
    // Latency score (0-100, lower latency = higher score)
    const latencyScore = Math.max(0, 100 - (health.avgLatencyMs / 10));
    
    const exchangeScore = average([uptimeScore, errorRateScore, latencyScore]);
    scores.push(exchangeScore);
  }
  
  const avgScore = average(scores);
  
  return {
    name: 'reliability',
    score: avgScore,
    weight: 0.30,
    details: `Uptime: ${scores[0].toFixed(1)}%, Errors: ${scores[1].toFixed(1)}%, Latency: ${scores[2].toFixed(1)}ms`
  };
}
```

**Reliability Thresholds:**

| Uptime (24h) | Error Rate | Avg Latency | Score |
|---|---|---|---|
| >99.9% | <0.1% | <100ms | 90-100 |
| 99.5-99.9% | 0.1-0.5% | 100-500ms | 70-90 |
| 99-99.5% | 0.5-1% | 500-1000ms | 50-70 |
| 95-99% | 1-5% | 1000-2000ms | 30-50 |
| <95% | >5% | >2000ms | 0-30 |

### 2.3 Volume Score (20% weight)

Measures trading volume liquidity:

```typescript
function scoreVolume(
  snapshots: PriceSnapshot[],
  opp: ArbitrageOpportunity
): RiskFactor {
  const buyVolume = opp.buySnapshot.bidQty * opp.buySnapshot.bid;
  const sellVolume = opp.sellSnapshot.bidQty * opp.sellSnapshot.bid;
  const minVolume = Math.min(buyVolume, sellVolume);
  
  // Score based on minimum volume
  // $10k+ = 100, $1k = 50, <$1k = 0
  const score = Math.min(100, (minVolume / 10000) * 100);
  
  return {
    name: 'volume',
    score,
    weight: 0.20,
    details: `Min volume: $${minVolume.toFixed(2)}`
  };
}
```

**Volume Thresholds:**

| Min Volume (USD) | Score |
|---|---|
| >$10,000 | 90-100 |
| $5,000-$10,000 | 70-90 |
| $1,000-$5,000 | 50-70 |
| $500-$1,000 | 30-50 |
| <$500 | 0-30 |

### 2.4 Age Score (15% weight)

Measures snapshot freshness:

```typescript
function scoreAge(
  snapshots: PriceSnapshot[],
  opp: ArbitrageOpportunity
): RiskFactor {
  const now = Date.now();
  const buyAge = now - opp.buySnapshot.timestamp;
  const sellAge = now - opp.sellSnapshot.timestamp;
  const maxAge = Math.max(buyAge, sellAge);
  
  // Score based on age
  // <1s = 100, 5s = 50, >10s = 0
  const score = Math.max(0, 100 - (maxAge / 100)); // 1ms = 1 point
  
  return {
    name: 'age',
    score,
    weight: 0.15,
    details: `Max age: ${maxAge}ms`
  };
}
```

**Age Thresholds:**

| Age | Score |
|---|---|
| <1s | 90-100 |
| 1-3s | 70-90 |
| 3-5s | 50-70 |
| 5-10s | 30-50 |
| >10s | 0-30 |

### 2.5 Spread Score (20% weight)

Measures spread tightness (tighter = better):

```typescript
function scoreSpread(
  snapshots: PriceSnapshot[],
  opp: ArbitrageOpportunity
): RiskFactor {
  const spreadBps = ((opp.sellPrice - opp.buyPrice) / opp.buyPrice) * 10000;
  
  // Tighter spread = higher score
  // <10 bps = 100, 50 bps = 50, >100 bps = 0
  const score = Math.max(0, 100 - (spreadBps * 2));
  
  return {
    name: 'spread',
    score,
    weight: 0.20,
    details: `Spread: ${spreadBps.toFixed(2)} bps`
  };
}
```

**Spread Thresholds:**

| Spread (bps) | Score |
|---|---|
| <10 | 90-100 |
| 10-30 | 70-90 |
| 30-50 | 50-70 |
| 50-100 | 30-50 |
| >100 | 0-30 |

### 2.6 Liquidity Score (15% weight)

Measures available liquidity at requested price:

```typescript
function scoreLiquidity(
  snapshots: PriceSnapshot[],
  opp: ArbitrageOpportunity
): RiskFactor {
  const buyLiquidity = opp.buySnapshot.askQty * opp.buySnapshot.ask;
  const sellLiquidity = opp.sellSnapshot.bidQty * opp.sellSnapshot.bid;
  const minLiquidity = Math.min(buyLiquidity, sellLiquidity);
  
  // Score based on liquidity
  // $50k+ = 100, $10k = 70, $1k = 30, <$1k = 0
  const score = Math.min(100, (minLiquidity / 500) * 100);
  
  return {
    name: 'liquidity',
    score,
    weight: 0.15,
    details: `Min liquidity: $${minLiquidity.toFixed(2)}`
  };
}
```

**Liquidity Thresholds:**

| Liquidity (USD) | Score |
|---|---|
| >$50,000 | 90-100 |
| $10,000-$50,000 | 70-90 |
| $1,000-$10,000 | 50-70 |
| $500-$1,000 | 30-50 |
| <$500 | 0-30 |

---

## 3. Risk Levels

### 3.1 Level Definitions

```typescript
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'extreme';
}
```

| Level | Score Range | Action |
|---|---|---|
| Low | 80-100 | Execute normally |
| Medium | 60-79 | Execute with caution |
| High | 40-59 | Require manual approval |
| Extreme | 0-39 | Block execution |

### 3.2 Threshold Configuration

```typescript
// packages/risk/src/config.ts
export interface RiskConfig {
  readonly minScore: number;           // Minimum total score (default: 50)
  readonly maxNotionalUsd: number;     // Max trade size (default: 10000)
  readonly minProfitBps: number;       // Min profit (default: 50)
  readonly maxSlippageBps: number;     // Max slippage (default: 20)
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  minScore: 50,
  maxNotionalUsd: 10000,
  minProfitBps: 50,
  maxSlippageBps: 20
};
```

---

## 4. Profitability Scoring

### 4.1 Profitability Analysis

```typescript
// packages/risk/src/profitability.ts
export interface ProfitabilityAnalysis {
  readonly grossProfitUsd: number;
  readonly totalFeesUsd: number;
  readonly netProfitUsd: number;
  readonly netProfitBps: number;
  readonly roi: number;                // Return on investment %
  readonly breakEvenNotional: number;  // Minimum notional to profit
}

export function scoreProfitability(
  opp: ArbitrageOpportunity,
  notionalUsd: number
): ProfitabilityAnalysis {
  // 1. Gross profit
  const grossProfitUsd = notionalUsd * (opp.netProfitBps / 10000);
  
  // 2. Fees
  const fees = calculateFees(opp, notionalUsd);
  
  // 3. Gas costs
  const gas = estimateGas(opp);
  
  // 4. Net profit
  const totalFeesUsd = fees + gas;
  const netProfitUsd = grossProfitUsd - totalFeesUsd;
  const netProfitBps = (netProfitUsd / notionalUsd) * 10000;
  
  // 5. ROI
  const roi = (netProfitUsd / notionalUsd) * 100;
  
  // 6. Break-even notional
  const breakEvenNotional = totalFeesUsd / (opp.netProfitBps / 10000);
  
  return {
    grossProfitUsd,
    totalFeesUsd,
    netProfitUsd,
    netProfitBps,
    roi,
    breakEvenNotional
  };
}
```

### 4.2 Fee Calculation

```typescript
export function calculateFees(
  opp: ArbitrageOpportunity,
  notionalUsd: number
): number {
  const buyFeeRate = opp.buySnapshot.exchange.takerFee;
  const sellFeeRate = opp.sellSnapshot.exchange.takerFee;
  
  const buyFee = notionalUsd * buyFeeRate;
  const sellFee = notionalUsd * sellFeeRate;
  
  return buyFee + sellFee;
}
```

### 4.3 Gas Estimation

```typescript
export function estimateGas(opp: ArbitrageOpportunity): number {
  switch (opp.type) {
    case 'spatial':
      // Two trades: buy + sell
      return estimateGasCost('cex');
    case 'triangular':
      // Three trades on same exchange
      return estimateGasCost('cex') * 3;
    case 'cross-chain':
      // Bridge fee + gas on both chains
      return opp.bridgeFeeUsd + estimateGasCost('bridge');
    default:
      return 0;
  }
}

function estimateGasCost(type: 'cex' | 'dex' | 'bridge'): number {
  // Estimated gas costs in USD
  const GAS_ESTIMATES = {
    cex: 0.50,        // Withdrawal fees
    dex: 2.00,        // Ethereum gas
    bridge: 5.00      // Bridge gas
  };
  
  return GAS_ESTIMATES[type];
}
```

---

## 5. Slippage Calculation

### 5.1 Slippage Model

```typescript
export function estimateSlippage(
  opp: ArbitrageOpportunity,
  notionalUsd: number
): number {
  const buyLiquidity = opp.buySnapshot.askQty * opp.buySnapshot.ask;
  const sellLiquidity = opp.sellSnapshot.bidQty * opp.sellSnapshot.bid;
  
  // Slippage increases with order size
  const buySlippage = calculateSlippageForOrder(notionalUsd, buyLiquidity, opp.buyPrice);
  const sellSlippage = calculateSlippageForOrder(notionalUsd, sellLiquidity, opp.sellPrice);
  
  return buySlippage + sellSlippage;
}

function calculateSlippageForOrder(
  orderSize: number,
  liquidity: number,
  price: number
): number {
  // Linear slippage model
  if (orderSize >= liquidity) return 100; // 100% slippage (can't fill)
  
  const slippageRatio = orderSize / liquidity;
  const slippageBps = slippageRatio * 50; // 50 bps per unit of liquidity
  
  return slippageBps;
}
```

---

## 6. Expected Value

### 6.1 EV Calculation

```typescript
export function calculateExpectedValue(
  opp: ArbitrageOpportunity,
  notionalUsd: number
): number {
  const profitability = scoreProfitability(opp, notionalUsd);
  const confidence = opp.confidence; // 0-1
  const riskScore = opp.riskScore;   // 0-100
  
  // Probability of success based on risk score
  const successProbability = (100 - riskScore) / 100;
  
  // Expected profit
  const expectedProfit = profitability.netProfitUsd * successProbability;
  
  // Expected loss (if execution fails, lose slippage + fees)
  const maxLoss = profitability.totalFeesUsd;
  const expectedLoss = maxLoss * (1 - successProbability);
  
  return expectedProfit - expectedLoss;
}
```

---

## 7. Configuration

### 7.1 Risk Profiles

```typescript
export const RISK_PROFILES = {
  conservative: {
    minRiskScore: 80,
    maxNotionalUsd: 1000,
    minProfitBps: 100,
    maxSlippageBps: 10
  },
  moderate: {
    minRiskScore: 60,
    maxNotionalUsd: 5000,
    minProfitBps: 50,
    maxSlippageBps: 20
  },
  aggressive: {
    minRiskScore: 40,
    maxNotionalUsd: 10000,
    minProfitBps: 30,
    maxSlippageBps: 50
  }
};
```

---

## 8. Testing

### 8.1 Unit Tests

```typescript
describe('RiskEngine', () => {
  it('scores high-reliability opportunity', () => {
    const snapshots = createSnapshots([
      { exchange: 'binance', latency: 50, uptime: 99.99 },
      { exchange: 'coinbase', latency: 60, uptime: 99.95 }
    ]);
    
    const opp = createOpportunity({ netProfitBps: 100 });
    const risk = scoreRisk(snapshots, opp);
    
    expect(risk.totalScore).toBeGreaterThan(80);
    expect(risk.level).toBe('low');
  });
  
  it('blocks extreme risk', () => {
    const snapshots = createSnapshots([
      { exchange: 'unknown', latency: 5000, uptime: 90 }
    ]);
    
    const opp = createOpportunity({ netProfitBps: 10 });
    const risk = scoreRisk(snapshots, opp);
    
    expect(risk.totalScore).toBeLessThan(40);
    expect(risk.level).toBe('extreme');
  });
});
```

---

## 9. Acceptance Criteria

- [ ] 5-factor scoring implemented
- [ ] Risk levels defined (low/medium/high/extreme)
- [ ] Profitability analysis accurate
- [ ] Slippage estimation reasonable
- [ ] Expected value calculation correct
- [ ] Configurable risk profiles
- [ ] Unit tests cover edge cases
- [ ] Integration with execution engine

## Engineering Notes

- Risk score is recalculated every detection cycle
- Conservative profile recommended for production
- Aggressive profile only for testing
- Monitor false positives (high risk opps that succeed)
- Calibrate weights based on historical data