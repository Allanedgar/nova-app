/**
 * Pipeline Orchestrator — runs registered strategies through the
 * detect → validate → score → rank → risk → publish pipeline.
 */
import type { NormalizedSnapshot } from '../types/snapshot.js';
import type { OpportunityCandidate, ScoredOpportunity, PublishedOpportunity, OpportunityStatus } from '../types/opportunity.js';
import type { ArbitrageStrategy, StrategyRegistry } from '../strategies/interface.js';
import type { PipelineStage, PipelineConfig } from '../types/pipeline.js';

export class PipelineOrchestrator {
  private stages: PipelineStage<any, any>[] = [];
  private config: PipelineConfig;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = {
      maxConcurrency: config?.maxConcurrency ?? 4,
      timeoutMs: config?.timeoutMs ?? 5000,
      retryCount: config?.retryCount ?? 0,
      retryDelayMs: config?.retryDelayMs ?? 100,
    };
  }

  /** Register a pipeline stage */
  addStage<I, O>(stage: PipelineStage<I, O>): void {
    this.stages.push(stage);
  }

  /** Run the full pipeline */
  async run(input: NormalizedSnapshot[]): Promise<PublishedOpportunity[]> {
    let current: any = input;

    for (const stage of this.stages) {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Stage ${stage.id} timed out`)), this.config.timeoutMs)
      );

      try {
        current = await Promise.race([stage.process(current), timeout]);
      } catch (error) {
        await stage.onError(error as Error, current);
        throw error;
      }
    }

    return current as PublishedOpportunity[];
  }

  /** Run pipeline for a single strategy (detect → score → validate) */
  async runStrategy(
    strategy: ArbitrageStrategy,
    snapshots: NormalizedSnapshot[]
  ): Promise<ScoredOpportunity[]> {
    // Detect
    const candidates = await strategy.detect(snapshots);
    if (candidates.length === 0) return [];

    // Score each candidate
    const scored: ScoredOpportunity[] = [];
    for (const candidate of candidates) {
      const s = await strategy.score(candidate, snapshots);
      // Validate
      const validation = await strategy.validate(s);
      if (validation.valid) {
        scored.push(s);
      }
    }

    return scored;
  }
}