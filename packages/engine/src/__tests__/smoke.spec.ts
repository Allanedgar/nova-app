import { describe, expect, it } from 'vitest';
import { NOVA_ENGINE_VERSION } from '../index.js';

describe('@nova-app/engine smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_ENGINE_VERSION).toBe('0.3.0');
  });
});
