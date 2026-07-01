/**
 * @nova-app/engine — pure arbitrage detection logic.
 * Per docs/10_ARBITRAGE_ENGINE.md. Phase 0 stub, Phase 1+ detector lives in
 * src/detector/.
 */

export const NOVA_ENGINE_VERSION = '0.2.0';

export function findOpportunities(): readonly unknown[] {
  return [];
}

export { runTick } from './detector/noop.js';
export type { DetectorTickResult, DetectorDeps } from './detector/noop.js';
