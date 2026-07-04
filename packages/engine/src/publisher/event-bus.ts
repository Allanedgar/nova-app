/**
 * Event Bus — pub/sub for opportunity lifecycle events.
 */
import type { PublishedOpportunity, OpportunityStatus } from '../types/opportunity.js';

export type OpportunityEvent =
  | { type: 'opportunity.detected'; opportunity: PublishedOpportunity }
  | { type: 'opportunity.validated'; opportunity: PublishedOpportunity }
  | { type: 'opportunity.published'; opportunity: PublishedOpportunity }
  | { type: 'opportunity.expired'; opportunity: PublishedOpportunity }
  | { type: 'opportunity.executed'; opportunity: PublishedOpportunity }
  | { type: 'opportunity.failed'; opportunity: PublishedOpportunity; error: string }
  | { type: 'engine.cycle'; cycleId: string; opportunitiesFound: number; durationMs: number }
  | { type: 'engine.error'; error: string };

export type EventHandler = (event: OpportunityEvent) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  emit(event: OpportunityEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(event); } catch { /* handler error */ }
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export class Publisher {
  private eventBus: EventBus;
  private published: Map<string, PublishedOpportunity> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async publish(opportunity: PublishedOpportunity): Promise<void> {
    this.published.set(opportunity.id, opportunity);
    this.eventBus.emit({ type: 'opportunity.published', opportunity });
  }

  async expire(opportunityId: string): Promise<void> {
    const opp = this.published.get(opportunityId);
    if (opp) {
      opp.status = 'expired';
      this.eventBus.emit({ type: 'opportunity.expired', opportunity: opp });
      this.published.delete(opportunityId);
    }
  }

  getPublished(): PublishedOpportunity[] {
    return Array.from(this.published.values());
  }

  getPublishedCount(): number {
    return this.published.size;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }
}