import { describe, expect, it } from 'vitest';
import { NOVA_ENGINE_VERSION, findOpportunities } from '../index.js';

describe('@nova-app/engine smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_ENGINE_VERSION).toBe('0.2.0');
  });
  it('findOpportunities returns an empty array (stub)', () => {
    expect(findOpportunities()).toEqual([]);
  });
});
