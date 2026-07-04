/**
 * Pipeline stage types for the arbitrage engine.
 */
export interface PipelineStage<I, O> {
  readonly id: string;
  process(input: I): Promise<O>;
  onError(error: Error, input: I): Promise<void>;
}

export interface PipelineConfig {
  maxConcurrency: number;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
}

export type PipelineInput = unknown;
export type PipelineOutput = unknown;