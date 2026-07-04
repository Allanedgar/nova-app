# Phase 2: Production Arbitrage Detection Engine

## Engineering Specification

### Objective

> Build the Production Arbitrage Detection Engine capable of continuously discovering, validating, ranking, and publishing executable arbitrage opportunities across all supported markets.

### Architecture Principle

**20% Engine Infrastructure → 80% Strategy Plugins**

The engine is a reusable platform. Strategies are interchangeable plugins implementing a common interface. Adding a new strategy requires implementing the interface — never modifying the engine.

---

## Current State (End of Phase 1)

| Capability | Status | Details |
|---|---|---|
| CEX Connectivity | ✅ 20/20 | Binance, Coinbase, OKX, Bybit, Kraken, Bitget, Gate, KuCoin, MEXC, HTX, Bitfinex, Bitstamp, Crypto.com, WhiteBIT, BingX, Phemex, LBank, Poloniex, Backpack, Gemini |
| DEX Connectivity | ✅ 8/20 | Hyperliquid (930 pools), Uniswap V3, SushiSwap, Balancer v3, Raydium, 1inch, PancakeSwap, Curve, Trader Joe, Orca |
| Bridge Connectivity | ✅ 3 connectors | Li.Fi aggregator (20 bridges, 74 chains), Across (1,486 routes), Wormhole |
| Discovery Engine | ✅ | Dynamic asset/pair discovery, zero hardcoded values |
| API Keys | ✅ | The Graph, Jupiter, Uniswap, Li.Fi, Across, Alchemy, Infura, dRPC |
| Arbitrage Scanner | ✅ v2 | Direct HTTP, 14 CEX venues, 20 pairs |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ARBITRAGE ENGINE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PIPELINE                                   │   │
│  │                                                               │   │
│  │  Snapshot Queue → Aggregator → Detector → Validator →        │   │
│  │  Scorer → Ranker → Risk Check → Publisher → Persist          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  Scheduler  │  │  Strategy  │  │  Bridge    │  │  Risk      │   │
│  │             │  │  Registry  │  │  Manager   │  │  Engine    │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    STRATEGY PLUGINS                           │   │
│  │                                                               │   │
│  │  CEX↔CEX  │  CEX↔DEX  │  Cross-Chain  │  Graph Arb          │   │
│  │  Funding  │  Statistical  │  Bridge Arb  │  (future)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sprint 0 — Engine Foundation (Week 1)

**Goal:** Create the engine infrastructure that every future arbitrage strategy plugs into. No strategy code. Only infrastructure.

### 0.1 Package Structure

```
packages/engine/
├── aggregator/          # Market data aggregation
│   ├── cex-aggregator.ts
│   ├── dex-aggregator.ts
│   └── bridge-aggregator.ts
├── detector/            # Opportunity detection pipeline
│   ├── pipeline.ts
│   ├── snapshot-queue.ts
│   └── candidate-generator.ts
├── validator/           # Opportunity validation
│   ├── price-validator.ts
│   ├── liquidity-validator.ts
│   ├── depth-validator.ts
│   └── fee-validator.ts
├── scorer/              # Scoring and ranking
│   ├── confidence-scorer.ts
│   ├── ranker.ts
│   └── scoring-formula.ts
├── publisher/           # Opportunity publishing
│   ├── event-bus.ts
│   ├── websocket-publisher.ts
│   └── file-publisher.ts
├── scheduler/           # Scheduling and orchestration
│   ├── scheduler.ts
│   ├── worker-pool.ts
│   └── circuit-breaker.ts
├── strategies/          # Strategy plugin directory
│   ├── interface.ts     # ← THE KEY INTERFACE
│   └── registry.ts
├── types/               # Core type definitions
│   ├── opportunity.ts
│   ├── snapshot.ts
│   ├── pipeline.ts
│   └── lifecycle.ts
└── pipeline/            # Pipeline orchestration
    ├── orchestrator.ts
    └── stages.ts
```

### 0.2 Core Interfaces

#### ArbitrageStrategy Interface

```typescript
interface ArbitrageStrategy {
  readonly id: string;
  readonly kind: 'cex-cex' | 'cex-dex' | 'cross-chain' | 'graph' | 'funding' | 'statistical';
  readonly version: string;

  /** Detect potential opportunities from current market snapshots */
  detect(snapshots: MarketSnapshot[]): Promise<OpportunityCandidate[]>;

  /** Score a candidate opportunity */
  score(candidate: OpportunityCandidate): Promise<ScoredOpportunity>;

  /** Validate a scored opportunity against current market conditions */
  validate(opportunity: ScoredOpportunity): Promise<ValidationResult>;
}
```

#### Opportunity Lifecycle

```typescript
type OpportunityStatus =
  | 'detected'      // Raw candidate found
  | 'validated'     // Passed validation checks
  | 'scored'        // Risk and confidence computed
  | 'ranked'        // Position in priority queue
  | 'published'     // Available for execution
  | 'reserved'      // Locked by execution engine
  | 'executing'     // Order placement in progress
  | 'executed'      // All legs filled
  | 'settled'       // Funds received on destination
  | 'expired'       // Time window passed
  | 'failed'        // Execution failed
  | 'archived';     // Stored for analysis
```

#### Opportunity Pipeline Stage

```typescript
interface PipelineStage<I, O> {
  readonly id: string;
  process(input: I): Promise<O>;
  onError(error: Error, input: I): Promise<void>;
}
```

### 0.3 Pipeline Definition

```
Snapshots (MarketSnapshot[])
  │
  ▼
Stage 1: Aggregator
  │  Normalize all venue data to common format
  │  Resolve asset identities across venues
  │  Output: NormalizedSnapshot[]
  ▼
Stage 2: Detector
  │  Run all registered strategies
  │  Generate OpportunityCandidate[]
  │  Output: OpportunityCandidate[]
  ▼
Stage 3: Validator
  │  Price sanity checks
  │  Liquidity depth validation
  │  Fee calculation
  │  Gas estimation
  │  Bridge cost estimation
  │  Output: ValidatedOpportunity[]
  ▼
Stage 4: Scorer
  │  Compute confidence score (0-100)
  │  Compute risk score (0-100)
  │  Compute ranking score
  │  Output: ScoredOpportunity[]
  ▼
Stage 5: Ranker
  │  Sort by ranking score descending
  │  Apply threshold filters
  │  Deduplicate
  │  Output: RankedOpportunity[]
  ▼
Stage 6: Risk Check
  │  Counterparty risk
  │  Bridge risk
  │  Chain congestion
  │  MEV exposure
  │  Output: RiskCheckedOpportunity[]
  ▼
Stage 7: Publisher
  │  Publish to event bus
  │  Push to WebSocket
  │  Log to file
  │  Persist to database
  │  Output: PublishedOpportunity[]
```

### 0.4 Core Types

```typescript
interface MarketSnapshot {
  venueId: string;
  venueKind: 'cex' | 'dex' | 'bridge';
  timestamp: number;
  pairs: PriceSnapshot[];
}

interface PriceSnapshot {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  bid: string;
  ask: string;
  last: string;
  volume24h: string;
  bidDepth: string;    // Total size at bid × 5 levels
  askDepth: string;    // Total size at ask × 5 levels
}

interface OpportunityCandidate {
  id: string;
  strategyId: string;
  kind: string;
  detectedAt: number;
  legs: OpportunityLeg[];
  grossProfitPct: number;
  estimatedFeesPct: number;
  netProfitPct: number;
}

interface OpportunityLeg {
  venueId: string;
  venueKind: 'cex' | 'dex' | 'bridge';
  action: 'buy' | 'sell';
  asset: string;
  amount: string;
  expectedPrice: string;
  chainId?: number;
}

interface ScoredOpportunity extends OpportunityCandidate {
  confidenceScore: number;     // 0-100
  riskScore: number;           // 0-100
  rankingScore: number;        // Composite
  executionProbability: number; // 0-1
  expectedSlippage: number;
  expectedLatencyMs: number;
  expiresAt: number;
}

interface ValidationResult {
  valid: boolean;
  reasons: string[];
  adjustedProfitPct?: number;
  expectedFillPct?: number;
}
```

### 0.5 Ranking Formula

```
rankingScore =
  netProfitPct ×
  (confidenceScore / 100) ×
  executionProbability ×
  (1 - riskScore / 100) ×
  freshnessMultiplier ×
  liquidityMultiplier
```

Where:
- `netProfitPct`: Expected profit after all fees
- `confidenceScore`: 0-100 from freshness, liquidity, spread, venue reliability
- `executionProbability`: 0-1 probability of successful fill
- `riskScore`: 0-100 composite risk
- `freshnessMultiplier`: Decays over time (1.0 at t=0 → 0.0 at expiry)
- `liquidityMultiplier`: 0-1 based on depth vs trade size

### 0.6 Confidence Score Formula

```
confidenceScore = weighted average of:

  freshness (30%):
    age < 100ms → 100
    age < 500ms → 80
    age < 1s    → 60
    age < 5s    → 30
    age > 5s    → 0

  liquidity (25%):
    depth / tradeSize > 10x → 100
    depth / tradeSize > 5x  → 80
    depth / tradeSize > 2x  → 50
    depth / tradeSize > 1x  → 20
    depth / tradeSize < 1x  → 0

  spread (15%):
    spread < 0.01% → 100
    spread < 0.05% → 80
    spread < 0.10% → 60
    spread < 0.50% → 40
    spread > 0.50% → 20

  venue reliability (15%):
    uptime > 99.9% → 100
    uptime > 99.5% → 80
    uptime > 99.0% → 60
    uptime > 95.0% → 40
    uptime < 95.0% → 0

  volume (10%):
    24h volume > $100M → 100
    24h volume > $10M  → 80
    24h volume > $1M   → 60
    24h volume > $100K → 40
    24h volume < $100K → 20

  orderbook depth (5%):
    top 10 levels > 10x trade → 100
    top 10 levels > 5x trade  → 80
    top 10 levels > 2x trade  → 50
    top 10 levels > 1x trade  → 20
    top 10 levels < 1x trade  → 0
```

### 0.7 Execution Probability

```typescript
function computeExecutionProbability(opportunity: ScoredOpportunity): number {
  const factors = {
    // Can we actually fill at the expected price?
    fillProbability: estimateFillProbability(opportunity),

    // Expected slippage given current depth
    slippageImpact: estimateSlippage(opportunity),

    // Expected latency for all legs
    totalLatencyMs: estimateTotalLatency(opportunity),

    // Bridge delay if cross-chain
    bridgeDelayMs: opportunity.legs
      .filter(l => l.venueKind === 'bridge')
      .reduce((max, l) => Math.max(max, estimateBridgeDelay(l)), 0),

    // Venue reliability factor
    venueReliability: computeVenueReliability(opportunity.legs),
  };

  // If any leg has < 50% fill probability, discard
  if (factors.fillProbability < 0.5) return 0;

  // If total latency exceeds opportunity expiry, discard
  if (factors.totalLatencyMs + factors.bridgeDelayMs > opportunity.expiresAt - Date.now()) return 0;

  // Composite probability
  return factors.fillProbability * factors.venueReliability * (1 - factors.slippageImpact);
}
```

### 0.8 Bridge Manager

```typescript
interface BridgeManager {
  /** Get quote for bridging token from source to destination chain */
  getQuote(params: BridgeQuoteParams): Promise<BridgeQuote>;

  /** Get all available routes */
  getRoutes(): Promise<BridgeRoute[]>;

  /** Get bridge status */
  getStatus(bridgeId: string): Promise<BridgeStatus>;

  /** Estimate bridge time */
  estimateTime(bridgeId: string, sourceChain: number, destChain: number): Promise<number>;
}

// Implementations:
// - LiFiBridgeManager (covers 20 bridges)
// - AcrossBridgeManager
// - WormholeBridgeManager
// - SocketBridgeManager (future)
// - LayerZeroBridgeManager (future)
// - StargateBridgeManager (future)
```

### 0.9 Risk Engine

```typescript
interface RiskEngine {
  assess(opportunity: ScoredOpportunity): Promise<RiskAssessment>;
}

interface RiskAssessment {
  overallRiskScore: number;  // 0-100

  // Individual risk dimensions
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

  // Aggregated
  maxDrawdown: number;
  valueAtRisk95: number;
  sharpeRatio: number;
}
```

### 0.10 Scheduler

```typescript
interface SchedulerConfig {
  // Polling intervals per venue kind
  cexPollIntervalMs: number;      // 100-1000ms
  dexPollIntervalMs: number;      // 1000-5000ms
  bridgePollIntervalMs: number;   // 5000-30000ms

  // Pipeline execution
  pipelineIntervalMs: number;     // 200-1000ms
  maxConcurrentPipelines: number; // 1-10

  // Opportunity lifecycle
  opportunityTTLMs: number;       // 500-5000ms
  maxPublishedOpportunities: number;

  // Circuit breakers
  maxLossPerTrade: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  cooldownAfterLossMs: number;
}
```

---

## Sprint 1 — Strategy Plugin: CEX↔CEX (Week 2)

**Goal:** Implement the first strategy plugin using the engine infrastructure.

### Deliverables

```
packages/engine/strategies/
├── cex-cross-exchange.ts    # Strategy implementation
└── __tests__/
    └── cex-cross-exchange.test.ts
```

### Strategy: CEX Cross-Exchange Arbitrage

```typescript
class CexCrossExchangeStrategy implements ArbitrageStrategy {
  readonly id = 'cex-cross-exchange';
  readonly kind = 'cex-cex';
  readonly version = '1.0.0';

  async detect(snapshots: MarketSnapshot[]): Promise<OpportunityCandidate[]> {
    // 1. Group snapshots by asset pair
    // 2. For each pair, find lowest ask and highest bid across venues
    // 3. If spread > threshold, generate candidate
    // 4. Calculate gross profit, fees, net profit
    // 5. Return candidates sorted by net profit
  }

  async score(candidate: OpportunityCandidate): Promise<ScoredOpportunity> {
    // 1. Compute confidence score (freshness, liquidity, venue reliability)
    // 2. Compute execution probability
    // 3. Compute ranking score
    // 4. Return scored opportunity
  }

  async validate(opportunity: ScoredOpportunity): Promise<ValidationResult> {
    // 1. Re-fetch current prices
    // 2. Verify spread still exists
    // 3. Check depth at both venues
    // 4. Return validation result
  }
}
```

### Supported Venues

All 20 CEX from Phase 1:
Binance, Coinbase, OKX, Bybit, Kraken, Bitget, Gate, KuCoin, MEXC, HTX, Bitfinex, Bitstamp, Crypto.com, WhiteBIT, BingX, Phemex, LBank, Poloniex, Backpack, Gemini

### Pair Coverage

- Top 100 pairs by volume (BTC, ETH, SOL, XRP, ADA, DOGE, etc.)
- Mid-cap pairs (100-500 by volume)
- Exotic pairs (500+ by volume) — higher spreads, more opportunities

### Acceptance Criteria

- [ ] Detects opportunities across 20 CEX venues
- [ ] Correctly computes fees per venue
- [ ] Validates depth before publishing
- [ ] Finds at least 5 opportunities > 0.05% net profit on exotic pairs
- [ ] Pipeline processes 100+ pairs per second
- [ ] Opportunities expire correctly after TTL

---

## Sprint 2 — Strategy Plugin: Cross-Venue (CEX↔DEX) (Week 3)

**Goal:** Compare prices between CEX and DEX venues.

### Deliverables

```
packages/engine/strategies/
├── cross-venue.ts
└── __tests__/
    └── cross-venue.test.ts
```

### Supported Venues

| CEX | DEX |
|---|---|
| Binance | Hyperliquid (930 pools) |
| Coinbase | Uniswap V3 (50 pools) |
| OKX | SushiSwap (50 pools) |
| Bybit | Balancer v3 |
| Kraken | Raydium |
| (all 20) | PancakeSwap, Curve, Trader Joe, Orca |

### Key Challenges

1. **Asset identity resolution**: WETH on DEX = ETH on CEX
2. **Price conversion**: USDC/USDT/DAI prices need normalization
3. **Gas cost estimation**: DEX trades require gas on L1/L2
4. **Slippage estimation**: DEX pools have different depth profiles

### Gas Estimator

```typescript
interface GasEstimator {
  estimateSwapGas(chainId: number, dexId: string): Promise<number>;
  estimateGasPrice(chainId: number): Promise<string>;
  estimateTotalGasCost(chainId: number, dexId: string, tradeSize: string): Promise<string>;
}
```

### Acceptance Criteria

- [ ] Detects CEX↔DEX opportunities across all connected DEX
- [ ] Correctly converts WETH↔ETH, USDC↔USDT
- [ ] Gas costs properly deducted from profit
- [ ] Slippage estimated from pool depth
- [ ] Finds at least 3 opportunities > 0.1% net profit

---

## Sprint 3 — Bridge Manager & Cross-Chain Strategy (Week 4)

**Goal:** Abstract bridge connectivity behind a Bridge Manager interface. Implement cross-chain arbitrage strategy.

### Deliverables

```
packages/engine/
├── bridge/
│   ├── manager.ts           # Bridge Manager interface
│   ├── lifi-adapter.ts      # Li.Fi implementation
│   ├── across-adapter.ts    # Across implementation
│   ├── wormhole-adapter.ts  # Wormhole implementation
│   └── __tests__/
└── strategies/
    ├── cross-chain.ts
    └── __tests__/
        └── cross-chain.test.ts
```

### Bridge Manager Architecture

```
Bridge Manager (interface)
  │
  ├── Li.Fi Adapter (20 bridges, 74 chains)
  │     ├── Stargate
  │     ├── LayerZero
  │     ├── Wormhole
  │     ├── Hyperlane
  │     ├── Axelar
  │     ├── deBridge
  │     ├── Hop
  │     ├── Across
  │     ├── CCIP
  │     ├── Mayan
  │     ├── CCTP
  │     ├── Polygon Bridge
  │     ├── Arbitrum Bridge
  │     ├── Optimism Bridge
  │     ├── Base Bridge
  │     ├── Relay
  │     ├── Rhino
  │     ├── Symbiosis
  │     ├── USDT0
  │     └── Butter
  │
  ├── Across Adapter (dedicated)
  │
  └── Wormhole Adapter (dedicated)
```

### Cross-Chain Strategy

```typescript
class CrossChainStrategy implements ArbitrageStrategy {
  readonly id = 'cross-chain';
  readonly kind = 'cross-chain';
  readonly version = '1.0.0';

  async detect(snapshots: MarketSnapshot[]): Promise<OpportunityCandidate[]> {
    // 1. Group prices by asset across chains
    // 2. For each asset, find cheapest chain to buy and most expensive to sell
    // 3. Query Bridge Manager for available routes
    // 4. Calculate: profit = sellPrice - buyPrice - bridgeFee - gasSource - gasDest
    // 5. Generate candidates
  }
}
```

### Cross-Chain Profit Formula

```
netProfit = (sellPrice_dest - buyPrice_source) / buyPrice_source
            - buyFee - sellFee
            - bridgeFee
            - gasCost_source
            - gasCost_dest
            - bridgeTimeCost  (opportunity cost during bridge delay)
```

### Acceptance Criteria

- [ ] Bridge Manager returns quotes from all 3 adapters
- [ ] Cross-chain strategy detects ETH price differences across chains
- [ ] Bridge fees correctly deducted
- [ ] Bridge time correctly estimated
- [ ] Finds at least 2 cross-chain opportunities > 0.2% net profit

---

## Sprint 4 — Graph Arbitrage Strategy (Week 5)

**Goal:** Model exchanges as directed graphs. Use Bellman-Ford and DFS to find ANY profitable cycle — not just triangles.

### Deliverables

```
packages/engine/
├── graph/
│   ├── graph.ts              # Graph data structure
│   ├── bellman-ford.ts       # Negative cycle detection
│   ├── dfs-cycle.ts          # DFS cycle enumeration
│   └── __tests__/
└── strategies/
    ├── graph-arbitrage.ts
    └── __tests__/
        └── graph-arbitrage.test.ts
```

### Graph Model

```
Nodes: Assets (BTC, ETH, SOL, USDT, USDC, BNB, XRP, ADA, ...)
Edges: Trading pairs with exchange rates

Example:
  BTC ──→ ETH (rate: 28.5 BTC/ETH)
  ETH ──→ USDT (rate: 1,750 ETH/USDT)
  USDT ──→ BTC (rate: 0.000016 USDT/BTC)

  Product = 28.5 × 1,750 × 0.000016 = 0.798
  If product > 1, arbitrage exists.
```

### Bellman-Ford Algorithm

```typescript
function findArbitrageCycles(
  graph: WeightedGraph,
  minProfitPct: number
): ArbitrageCycle[] {
  // 1. Convert exchange rates to negative log weights
  //    weight = -ln(rate)
  //    This transforms "product > 1" into "sum of weights < 0"

  // 2. Run Bellman-Ford to detect negative cycles
  //    O(V × E) where V = assets, E = pairs

  // 3. Extract cycles from predecessor matrix

  // 4. Filter by minimum profit threshold

  // 5. Return ranked cycles
}
```

### Cycle Types

| Length | Name | Example |
|---|---|---|
| 3 | Triangle | BTC → ETH → USDT → BTC |
| 4 | Quad | BTC → ETH → SOL → USDT → BTC |
| 5+ | N-cycle | BTC → ETH → LINK → AAVE → USDT → BTC |

### Acceptance Criteria

- [ ] Graph builds correctly from market snapshots
- [ ] Bellman-Ford detects negative cycles in < 100ms for 100 assets
- [ ] DFS enumerates all cycles up to length 5
- [ ] Finds at least 3 profitable cycles > 0.1% net profit
- [ ] Handles 500+ assets and 3,000+ pairs

---

## Sprint 5 — Real-Time Engine (Week 6)

**Goal:** Continuous real-time opportunity detection with WebSocket feeds.

### Deliverables

```
packages/engine/
├── realtime/
│   ├── engine.ts             # Real-time engine orchestrator
│   ├── snapshot-queue.ts     # Bounded priority queue
│   ├── aggregator-loop.ts    # Continuous aggregation
│   └── __tests__/
├── marketdata/
│   ├── ws-feed.ts            # WebSocket feed manager
│   ├── binance-ws.ts
│   ├── coinbase-ws.ts
│   ├── okx-ws.ts
│   ├── bybit-ws.ts
│   ├── kraken-ws.ts
│   └── __tests__/
└── publisher/
    ├── event-bus.ts
    ├── websocket-publisher.ts
    └── file-publisher.ts
```

### Real-Time Engine Architecture

```
WebSocket Feeds (Binance, Coinbase, OKX, Bybit, Kraken)
  │
  ▼
Snapshot Queue (bounded, priority-ordered by freshness)
  │
  ▼
Aggregator Loop (runs every 100ms)
  │
  ▼
Opportunity Pipeline (detect → validate → score → rank → risk → publish)
  │
  ▼
Publisher (event bus → WebSocket → file → database)
  │
  ▼
Execution Engine (Sprint 6)
```

### WebSocket Feed Manager

```typescript
interface WsFeedManager {
  connect(venues: string[]): Promise<void>;
  subscribe(pairs: string[]): Promise<void>;
  onSnapshot(callback: (snapshot: PriceSnapshot) => void): void;
  getLatestSnapshots(): Map<string, PriceSnapshot>;
  health(): Map<string, { connected: boolean; latencyMs: number; messagesPerSec: number }>;
}
```

### Acceptance Criteria

- [ ] WebSocket feeds maintain connection to 5+ CEX venues
- [ ] Snapshot queue processes 10,000+ updates/second
- [ ] Pipeline runs every 200ms with fresh data
- [ ] Opportunities published within 500ms of detection
- [ ] Circuit breaker triggers on data quality degradation

---

## Sprint 6 — Execution Engine (Week 7)

**Goal:** Simulate and execute arbitrage trades with full simulation pipeline.

### Deliverables

```
packages/engine/
├── execution/
│   ├── simulator/
│   │   ├── order-simulator.ts
│   │   ├── fee-simulator.ts
│   │   ├── slippage-simulator.ts
│   │   ├── latency-simulator.ts
│   │   └── bridge-simulator.ts
│   ├── executor/
│   │   ├── cex-executor.ts
│   │   ├── dex-executor.ts
│   │   └── bridge-executor.ts
│   ├── circuit-breaker.ts
│   ├── retry.ts
│   └── audit.ts
└── __tests__/
```

### Simulation Pipeline

```
Opportunity
  │
  ▼
Order Simulator
  │  Simulate order placement at each venue
  │  Account for order book depth
  ▼
Fee Simulator
  │  Apply venue-specific fee schedules
  │  Account for tier-based discounts
  ▼
Slippage Simulator
  │  Estimate price impact based on depth
  │  Apply to each leg
  ▼
Latency Simulator
  │  Add venue-specific latency
  │  Account for network conditions
  ▼
Bridge Simulator
  │  Add bridge confirmation time
  │  Account for bridge congestion
  ▼
Net Profit (simulated)
```

### Circuit Breakers

```typescript
interface CircuitBreakerConfig {
  maxLossPerTrade: number;        // $1,000
  maxDailyLoss: number;           // $10,000
  maxPositionSize: number;        // $100,000
  maxConcurrentTrades: number;    // 5
  cooldownAfterLossMs: number;    // 60,000
  minConfidenceScore: number;     // 70
  minExecutionProbability: number; // 0.8
  maxSlippagePct: number;         // 0.5
  maxLatencyMs: number;           // 2,000
}
```

### Acceptance Criteria

- [ ] Simulator runs 100+ simulated trades
- [ ] Simulator accurately models fees, slippage, latency
- [ ] Circuit breakers trigger correctly on threshold violations
- [ ] Audit log records every trade attempt
- [ ] Retry logic handles transient failures

---

## Sprint 7 — Risk Engine (Week 8)

**Goal:** Institutional-grade risk assessment for every opportunity.

### Deliverables

```
packages/engine/
├── risk/
│   ├── engine.ts
│   ├── dimensions/
│   │   ├── counterparty.ts
│   │   ├── bridge.ts
│   │   ├── oracle.ts
│   │   ├── congestion.ts
│   │   ├── gas-spike.ts
│   │   ├── rpc-reliability.ts
│   │   ├── fill-rate.ts
│   │   ├── manipulation.ts
│   │   ├── depth.ts
│   │   ├── wash-trading.ts
│   │   ├── depeg.ts
│   │   ├── funding-rate.ts
│   │   ├── liquidation.ts
│   │   ├── mev.ts
│   │   └── volatility.ts
│   └── __tests__/
└── types/
    └── risk.ts
```

### Risk Dimensions

| Dimension | Description | Weight | Data Source |
|---|---|---|---|
| Counterparty Risk | Exchange solvency, regulatory status | 15% | Venue uptime, news, audits |
| Bridge Risk | Bridge security, TVL, hacks | 15% | Bridge TVL, audit history |
| Oracle Risk | Price feed reliability | 10% | Oracle type, deviation threshold |
| Chain Congestion | Network gas price vs baseline | 10% | Gas price percentile |
| Gas Spike Risk | Sudden gas price increase | 5% | Gas price volatility |
| RPC Reliability | RPC endpoint uptime | 5% | RPC health checks |
| Historical Fill Rate | % of orders filled at expected price | 10% | Venue fill statistics |
| Price Manipulation | Wash trading, spoofing detection | 5% | Trade pattern analysis |
| Orderbook Depth | Depth at 1%, 2%, 5% levels | 10% | Order book snapshots |
| Wash Trading | Suspicious volume patterns | 5% | Volume analysis |
| Stablecoin Depeg | USDT/USDC/DAI peg deviation | 5% | Oracle price vs DEX price |
| Funding Rate | Perp funding rate deviation | 5% | Funding rate data |
| Liquidation Risk | Cascading liquidation potential | 5% | Open interest, leverage |
| MEV Exposure | Sandwich risk for DEX trades | 5% | Mempool analysis |
| Volatility | 5m/1h/24h price volatility | 5% | Price history |

### Acceptance Criteria

- [ ] All 15 risk dimensions computed for every opportunity
- [ ] Composite risk score (0-100) available
- [ ] Risk assessment completes in < 50ms
- [ ] Historical data stored for trend analysis
- [ ] Risk alerts trigger on threshold breaches

---

## Sprint 8 — Dashboard & API (Week 9)

**Goal:** Web dashboard and REST API for monitoring and control.

### Deliverables

```
packages/
├── api/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── opportunities.ts
│   │   │   ├── execution.ts
│   │   │   ├── venues.ts
│   │   │   ├── bridges.ts
│   │   │   ├── risk.ts
│   │   │   ├── analytics.ts
│   │   │   └── settings.ts
│   │   ├── ws/
│   │   │   ├── events.ts
│   │   │   └── subscriptions.ts
│   │   └── index.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── OpportunityFeed.tsx
│   │   │   ├── OpportunityDetail.tsx
│   │   │   ├── ExecutionStatus.tsx
│   │   │   ├── VenueHealth.tsx
│   │   │   ├── BridgeHealth.tsx
│   │   │   ├── RpcHealth.tsx
│   │   │   ├── LatencyDashboard.tsx
│   │   │   ├── FeeDashboard.tsx
│   │   │   ├── SpreadDashboard.tsx
│   │   │   ├── RiskDashboard.tsx
│   │   │   ├── ExecutionQueue.tsx
│   │   │   ├── OrderHistory.tsx
│   │   │   ├── SimulationReplay.tsx
│   │   │   ├── SystemLogs.tsx
│   │   │   ├── Metrics.tsx
│   │   │   └── Alerts.tsx
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
└── mobile/
    ├── src/
    │   ├── screens/
    │   │   ├── Dashboard.tsx
    │   │   ├── Opportunities.tsx
    │   │   ├── Portfolio.tsx
    │   │   ├── Automation.tsx
    │   │   ├── Settings.tsx
    │   │   └── Notifications.tsx
    │   └── App.tsx
    └── package.json
```

### API Endpoints

```
GET    /api/v1/opportunities          # Live opportunity feed
GET    /api/v1/opportunities/:id      # Opportunity detail
POST   /api/v1/opportunities/:id/execute  # Execute opportunity
GET    /api/v1/execution/status       # Current execution status
GET    /api/v1/execution/history      # Order history
GET    /api/v1/venues                 # Venue health
GET    /api/v1/bridges                # Bridge health
GET    /api/v1/rpc                    # RPC health
GET    /api/v1/risk                   # Risk dashboard
GET    /api/v1/analytics              # Performance metrics
GET    /api/v1/settings               # System settings
PUT    /api/v1/settings               # Update settings

WS     /api/v1/ws/opportunities       # Real-time opportunity stream
WS     /api/v1/ws/execution           # Execution status updates
WS     /api/v1/ws/health              # System health updates
```

### Dashboard Views

| View | Components |
|---|---|
| Live Feed | OpportunityFeed, Alerts |
| Opportunity Detail | OpportunityDetail, RiskDashboard, SpreadDashboard |
| Execution | ExecutionStatus, ExecutionQueue, OrderHistory |
| Health | VenueHealth, BridgeHealth, RpcHealth |
| Analytics | LatencyDashboard, FeeDashboard, Metrics |
| Simulation | SimulationReplay, SystemLogs |
| Settings | Automation config, Risk thresholds |

### Mobile Features

- Real-time opportunity notifications
- Biometric authentication
- Portfolio tracking
- Automation on/off
- Widget for quick glance

### Acceptance Criteria

- [ ] API returns live opportunities with < 100ms latency
- [ ] WebSocket pushes updates within 50ms of detection
- [ ] Dashboard renders 100+ opportunities without lag
- [ ] Mobile app receives push notifications
- [ ] All 15 dashboard views render correctly

---

## Summary: 9 Sprints, 9 Weeks

| Sprint | Focus | Deliverables |
|---|---|---|
| **0** | Engine Foundation | Pipeline, types, interfaces, scheduler, bridge manager, risk engine |
| **1** | Strategy: CEX↔CEX | First strategy plugin, 20 CEX venues, exotic pairs |
| **2** | Strategy: Cross-Venue | CEX↔DEX comparison, gas estimator, price conversion |
| **3** | Bridge Manager + Cross-Chain | Bridge abstraction, 3 adapters, cross-chain strategy |
| **4** | Graph Arbitrage | Bellman-Ford, DFS, N-cycle detection |
| **5** | Real-Time Engine | WebSocket feeds, snapshot queue, continuous pipeline |
| **6** | Execution Engine | Full simulation pipeline, circuit breakers, audit |
| **7** | Risk Engine | 15 risk dimensions, composite scoring |
| **8** | Dashboard & API | REST API, WebSocket, React dashboard, mobile app |

### Architecture Principle

**20% Engine (Sprint 0) → 80% Strategy Plugins (Sprints 1-4)**

Every future strategy implements the `ArbitrageStrategy` interface. The engine never changes.

### Key Interfaces

| Interface | File | Purpose |
|---|---|---|
| `ArbitrageStrategy` | `strategies/interface.ts` | Plugin contract |
| `PipelineStage` | `pipeline/stages.ts` | Pipeline processing |
| `BridgeManager` | `bridge/manager.ts` | Bridge abstraction |
| `RiskEngine` | `risk/engine.ts` | Risk assessment |
| `GasEstimator` | `validator/gas-estimator.ts` | Gas cost estimation |
| `WsFeedManager` | `marketdata/ws-feed.ts` | Real-time data |
| `CircuitBreaker` | `execution/circuit-breaker.ts` | Safety controls |

### Key Formulas

| Formula | Purpose |
|---|---|
| `rankingScore = netProfit × confidence × executionProb × (1-risk) × freshness × liquidity` | Opportunity ranking |
| `confidenceScore = weighted(freshness, liquidity, spread, reliability, volume, depth)` | Confidence scoring |
| `executionProbability = fillProb × venueReliability × (1 - slippageImpact)` | Execution likelihood |
| `netProfit = sellPrice - buyPrice - fees - gas - bridgeCost` | Profit calculation |
| `bellmanFord(weight = -ln(rate))` | Graph cycle detection |