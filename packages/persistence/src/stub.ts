/**
 * StubPersistence — original Phase-0 API, kept for backwards compat.
 * Any new caller should use `SupabasePersistence` from `./index.js`.
 */

export class StubPersistence {
  async upsertOpportunities(_opps: readonly unknown[]): Promise<void> {}
  async getRecentOpportunities(_limit: number): Promise<readonly unknown[]> {
    return [];
  }
}
