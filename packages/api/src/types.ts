/**
 * API types for Nova backend.
 */
export interface ApiConfig {
  readonly port: number;
  readonly host: string;
  readonly pipeline: {
    readonly cronIntervalMs: number;
    readonly defaultNotionalUsd: number;
    readonly minProfitBps: number;
  };
}

export interface ApiState {
  readonly isRunning: boolean;
  readonly startedAt?: number;
  readonly lastCycle?: number;
  readonly error?: string;
}