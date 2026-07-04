export interface Metric {
  readonly name: string;
  readonly value: number;
  readonly labels: Record<string, string>;
  readonly timestamp: number;
}

export interface TraceSpan {
  readonly id: string;
  readonly parentId?: string;
  readonly operation: string;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly attributes: Record<string, unknown>;
}

export function createMetric(name: string, value: number, labels: Record<string, string> = {}): Metric {
  return { name, value, labels, timestamp: Date.now() };
}

export function startSpan(operation: string, parentId?: string): TraceSpan {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, parentId, operation, startedAt: Date.now(), attributes: {} };
}

export function endSpan(span: TraceSpan): TraceSpan {
  return { ...span, endedAt: Date.now() };
}