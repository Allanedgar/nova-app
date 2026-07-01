import { describe, expect, it } from 'vitest';
import { NOVA_SHARED_VERSION } from '../index.js';

describe('@nova-app/shared smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_SHARED_VERSION).toBe('0.1.0');
  });
});
