/**
 * @nova-app/persistence — Supabase writer/reader.
 * Stub for Phase 0 — see docs/14_DATABASE_SCHEMA.md for the real schema.
 */

export const NOVA_PERSISTENCE_VERSION = '0.1.0';

export class StubPersistence {
  async upsertOpportunities(_opps: readonly unknown[]): Promise<void> {}
  async getRecentOpportunities(_limit: number): Promise<readonly unknown[]> {
    return [];
  }
}
