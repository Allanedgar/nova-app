/**
 * Audit Log — append-only log of all execution attempts.
 * Supports query by opportunity, venue, tier, and time range.
 */
import type { ExecutionLogEntry, ExecutionRequest, ExecutionResult } from './types.js';

export class AuditLog {
  private readonly _entries: ExecutionLogEntry[] = [];
  private _counter = 0;

  get entries(): readonly ExecutionLogEntry[] {
    return Object.freeze([...this._entries]);
  }

  get size(): number {
    return this._entries.length;
  }

  record(request: ExecutionRequest, result: ExecutionResult, startedAt: number, completedAt: number): ExecutionLogEntry {
    const entry: ExecutionLogEntry = {
      id: `exec-${++this._counter}-${startedAt}`,
      request,
      result,
      startedAt,
      completedAt,
      latencyMs: completedAt - startedAt,
    };
    this._entries.push(entry);
    return entry;
  }

  byOpportunity(opportunityId: string): readonly ExecutionLogEntry[] {
    return this._entries.filter((e) => e.request.opportunityId === opportunityId);
  }

  byVenue(venueId: string): readonly ExecutionLogEntry[] {
    return this._entries.filter((e) => e.request.venueId === venueId);
  }

  byTier(tier: string): readonly ExecutionLogEntry[] {
    return this._entries.filter((e) => e.request.tier === tier);
  }

  byTimeRange(from: number, to: number): readonly ExecutionLogEntry[] {
    return this._entries.filter((e) => e.startedAt >= from && e.startedAt <= to);
  }

  get recent(): readonly ExecutionLogEntry[] {
    return this._entries.slice(-100);
  }

  clear(): void {
    this._entries.length = 0;
    this._counter = 0;
  }
}