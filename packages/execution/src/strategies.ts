/**
 * Execution Strategies — one per tier (manual, simulated, automated).
 * Manual: validates and queues for user approval.
 * Simulated: runs with paper trading, never touches real capital.
 * Automated: executes via connector API (future: real order placement).
 */
import type { ExecutionRequest, ExecutionResult, ExecutionStrategy } from './types.js';

export function createManualStrategy(): ExecutionStrategy {
  return {
    id: 'manual',
    tier: 'manual',
    canExecute: (_req: ExecutionRequest) => true,
    execute: async (req: ExecutionRequest): Promise<ExecutionResult> => {
      return {
        status: 'rejected',
        filledQty: 0, avgPrice: 0, feePaid: 0,
        timestamp: Date.now(),
        error: 'manual execution requires human approval',
      };
    },
  };
}

export function createSimulatedStrategy(): ExecutionStrategy {
  let simulationCounter = 0;
  return {
    id: 'simulated',
    tier: 'simulated',
    canExecute: () => true,
    execute: async (req: ExecutionRequest): Promise<ExecutionResult> => {
      simulationCounter++;
      const slippage = req.price * (req.maxSlippageBps / 10_000) * (Math.random() * 0.5);
      const simulatedPrice = req.side === 'buy' ? req.price + slippage : req.price - slippage;
      const simulatedFee = req.notionalUsd * 0.001; // 10bps simulated fee
      return {
        status: 'simulated',
        tradeId: `sim-${simulationCounter}-${Date.now()}`,
        filledQty: req.quantity,
        avgPrice: simulatedPrice,
        feePaid: simulatedFee,
        timestamp: Date.now(),
      };
    },
  };
}

export function createAutomatedStrategy(
  canExecuteFn?: (req: ExecutionRequest) => boolean,
  executeFn?: (req: ExecutionRequest) => Promise<ExecutionResult>,
): ExecutionStrategy {
  return {
    id: 'automated',
    tier: 'automated',
    canExecute: canExecuteFn ?? (() => true),
    execute: executeFn ?? (async (req: ExecutionRequest) => ({
      status: 'rejected',
      filledQty: 0, avgPrice: 0, feePaid: 0,
      timestamp: Date.now(),
      error: 'no automated execution handler configured',
    })),
  };
}