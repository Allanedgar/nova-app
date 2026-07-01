import { describe, expect, it } from 'vitest';
import { NOVA_CACHE_VERSION, StubCache } from '../index.js';

describe('@nova-app/cache smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_CACHE_VERSION).toBe('0.1.0');
  });
  it('StubCache.get returns null (stub)', async () => {
    const c = new StubCache();
    await expect(c.get('any-key')).resolves.toBeNull();
  });
  it('StubCache.set resolves (stub)', async () => {
    const c = new StubCache();
    await expect(c.set('k', 'v', 60)).resolves.toBeUndefined();
  });
});
