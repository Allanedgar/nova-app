/**
 * Scheduler — orchestrates periodic execution of the detection pipeline.
 */
import type { ArbitrageStrategy, StrategyRegistry } from '../strategies/interface.js';
import type { NormalizedSnapshot } from '../types/snapshot.js';
import type { PublishedOpportunity } from '../types/opportunity.js';
import { PipelineOrchestrator } from '../pipeline/orchestrator.js';
import { Publisher, EventBus } from '../publisher/event-bus.js';

export interface SchedulerConfig {
  cexPollIntervalMs: number;
  dexPollIntervalMs: number;
  bridgePollIntervalMs: number;
  pipelineIntervalMs: number;
  maxConcurrentPipelines: number;
  opportunityTTLMs: number;
  maxPublishedOpportunities: number;
}

export class EngineScheduler {
  private config: SchedulerConfig;
  private orchestrator: PipelineOrchestrator;
  private publisher: Publisher;
  private eventBus: EventBus;
  private running = false;
  private cycleId = 0;

  constructor(
    config?: Partial<SchedulerConfig>,
    orchestrator?: PipelineOrchestrator,
    publisher?: Publisher,
    eventBus?: EventBus
  ) {
    this.config = {
      cexPollIntervalMs: config?.cexPollIntervalMs ?? 500,
      dexPollIntervalMs: config?.dexPollIntervalMs ?? 2000,
      bridgePollIntervalMs: config?.bridgePollIntervalMs ?? 10000,
      pipelineIntervalMs: config?.pipelineIntervalMs ?? 1000,
      maxConcurrentPipelines: config?.maxConcurrentPipelines ?? 4,
      opportunityTTLMs: config?.opportunityTTLMs ?? 3000,
      maxPublishedOpportunities: config?.maxPublishedOpportunities ?? 100,
    };
    this.eventBus = eventBus ?? new EventBus();
    this.publisher = publisher ?? new Publisher(this.eventBus);
    this.orchestrator = orchestrator ?? new PipelineOrchestrator();
  }

  start(): void {
    this.running = true;
    this.runLoop();
  }

  stop(): void {
    this.running = false;
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      const start = Date.now();
      this.cycleId++;

      try {
        const opportunities = await this.orchestrator.run([] as NormalizedSnapshot[]);
        for (const opp of opportunities) {
          await this.publisher.publish(opp);
        }

        this.eventBus.emit({
          type: 'engine.cycle',
          cycleId: `cycle-${this.cycleId}`,
          opportunitiesFound: opportunities.length,
          durationMs: Date.now() - start,
        });
      } catch (error) {
        this.eventBus.emit({
          type: 'engine.error',
          error: (error as Error).message,
        });
      }

      // Expire stale opportunities
      this.expireStale();

      const elapsed = Date.now() - start;
      const delay = Math.max(0, this.config.pipelineIntervalMs - elapsed);
      if (delay > 0 && this.running) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private expireStale(): void {
    const now = Date.now();
    for (const opp of this.publisher.getPublished()) {
      if (opp.expiresAt < now) {
        this.publisher.expire(opp.id);
      }
    }
  }

  getPublisher(): Publisher {
    return this.publisher;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getOrchestrator(): PipelineOrchestrator {
    return this.orchestrator;
  }

  isRunning(): boolean {
    return this.running;
  }
}