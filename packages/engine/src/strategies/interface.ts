/**
 * ArbitrageStrategy — the plugin contract for every arbitrage strategy.
 *
 * Every strategy (CEX↔CEX, CEX↔DEX, Cross-Chain, Graph, etc.)
 * implements this interface. The engine dispatches to all registered
 * strategies through the Detector pipeline stage.
 */
import type { MarketSnapshot, NormalizedSnapshot } from '../types/snapshot.js';
import type { OpportunityCandidate, ScoredOpportunity, ValidationResult, OpportunityKind } from '../types/opportunity.js';

export interface ArbitrageStrategy {
  /** Unique strategy identifier */
  readonly id: string;

  /** Strategy classification */
  readonly kind: OpportunityKind;

  /** Semver version string */
  readonly version: string;

  /** Human-readable name */
  readonly displayName: string;

  /** Detect potential opportunities from current market snapshots */
  detect(snapshots: NormalizedSnapshot[]): Promise<OpportunityCandidate[]>;

  /** Score a candidate opportunity (confidence, risk, ranking) */
  score(candidate: OpportunityCandidate, marketSnapshots: NormalizedSnapshot[]): Promise<ScoredOpportunity>;

  /** Validate a scored opportunity against current market conditions */
  validate(opportunity: ScoredOpportunity): Promise<ValidationResult>;

  /** Called when strategy is registered with the engine */
  onRegister?(): Promise<void>;

  /** Called when strategy is unregistered */
  onUnregister?(): Promise<void>;
}

export interface StrategyRegistry {
  /** Register a strategy plugin */
  register(strategy: ArbitrageStrategy): void;

  /** Unregister a strategy */
  unregister(strategyId: string): void;

  /** Get all registered strategies */
  getAll(): ArbitrageStrategy[];

  /** Get a specific strategy by ID */
  get(id: string): ArbitrageStrategy | undefined;

  /** Get strategies by kind */
  getByKind(kind: OpportunityKind): ArbitrageStrategy[];
}