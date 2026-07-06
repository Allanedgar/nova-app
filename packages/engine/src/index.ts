/**
 * @nova-app/engine — Production Arbitrage Detection Engine v1.0.0
 *
 * Architecture: Engine Infrastructure (20%) + Strategy Plugins (80%)
 *
 * Engine Components:
 *   - Core types (opportunity, snapshot, pipeline)
 *   - Strategy plugin interface + registry
 *   - Pipeline orchestrator
 *   - Bridge Manager (Composite pattern)
 *   - Risk Engine (15 dimensions)
 *   - Event Bus + Publisher
 *   - Scheduler
 *
 * Strategy Plugins (implement ArbitrageStrategy):
 *   - CEX↔CEX, CEX↔DEX, Cross-Chain, Graph Arbitrage
 */

export const ENGINE_VERSION = '1.0.0';
export const NOVA_ENGINE_VERSION = ENGINE_VERSION;

// Types
export type {
  OpportunityKind, VenueKind, OpportunityStatus,
  OpportunityLeg, OpportunityCandidate, ScoredOpportunity,
  ValidationResult, PublishedOpportunity,
} from './types/opportunity.js';

export type {
  PriceSnapshot, MarketSnapshot, NormalizedSnapshot, NormalizedPair,
} from './types/snapshot.js';

export type { PipelineStage, PipelineConfig } from './types/pipeline.js';

// Strategy Plugin System
export type { ArbitrageStrategy, StrategyRegistry } from './strategies/interface.js';
export { DefaultStrategyRegistry } from './strategies/registry.js';
export { CexCrossExchangeStrategy } from './strategies/cex-cross-exchange.js';
export { CrossVenueStrategy } from './strategies/cross-venue.js';
export { GraphArbitrageStrategy } from './strategies/graph-arbitrage.js';
export { CrossChainStrategy } from './strategies/cross-chain.js';

// Pipeline
export { PipelineOrchestrator } from './pipeline/orchestrator.js';

// Bridge Manager
export type {
  BridgeQuoteParams, BridgeQuote, BridgeRoute, BridgeStatus, BridgeManager,
} from './bridge/manager.js';
export { CompositeBridgeManager } from './bridge/manager.js';

// Risk Engine
export type { RiskAssessment, RiskEngine } from './risk/engine.js';
export { DefaultRiskEngine } from './risk/engine.js';

// Event Bus & Publisher
export type { OpportunityEvent, EventHandler } from './publisher/event-bus.js';
export { EventBus, Publisher } from './publisher/event-bus.js';

// Scheduler
export type { SchedulerConfig } from './scheduler/scheduler.js';
export { EngineScheduler } from './scheduler/scheduler.js';

// Market Data
export type { WsFeedConfig, WsFeedHealth, PriceUpdate, PriceUpdateHandler, WsFeedManager } from './marketdata/ws-feed.js';
export { DefaultWsFeedManager } from './marketdata/ws-feed.js';

// Execution
export type { SimulatedFill, SimulationResult, CircuitBreakerConfig } from './execution/simulator.js';
export { ExecutionSimulator } from './execution/simulator.js';

// Direct detector utilities
export { aggregateSnapshots, filterFresh, symbolKey } from './aggregator.js';
export { detectSpatial, runDetectionCycle } from './spatial.js';
