import { describe, expect, it } from 'vitest';
import { NOVA_PERSISTENCE_VERSION, StubPersistence } from '../index.js';

describe('@nova-app/persistence smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_PERSISTENCE_VERSION).toBe('0.1.0');
  });
  it('StubPersistence.upsertOpportunities resolves', async () => {
    const p = new StubPersistence();
    await expect(p.upsertOpportunities([])).resolves.toBeUndefined();
  });
  it('StubPersistence.getRecentOpportunities returns []', async () => {
    const p = new StubPersistence();
    await expect(p.getRecentOpportunities(10)).resolves.toEqual([]);
  });
});
