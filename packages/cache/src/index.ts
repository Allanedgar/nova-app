/**
 * @nova-app/cache — Redis sliding-window cache.
 * Stub for Phase 0 — see docs/05_MONOREPO_STRUCTURE.md §"Backend" for context.
 */

export const NOVA_CACHE_VERSION = '0.1.0';

export class StubCache {
  async get(_k: string): Promise<string | null> {
    return null;
  }
  async set(_k: string, _v: string, _ttlSec: number): Promise<void> {}
}
