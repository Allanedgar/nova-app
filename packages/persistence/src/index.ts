/**
 * @nova-app/persistence — public API surface.
 *
 * @nova-app/persistence is the Supabase writer/reader. Per
 * docs/14_DATABASE_SCHEMA.md + docs/02_PHASED_ROADMAP.md Task 1.8.
 */

export { NOVA_PERSISTENCE_VERSION } from './version.js';
export { SupabasePersistence, createSupabasePersistence } from './client.js';
export { StubPersistence } from './stub.js';
export type {
  OpportunityRow,
  DiscoveredPairRow,
  PriceSnapshotRow,
  Result,
  SupabasePersistenceDeps,
} from './client.js';
