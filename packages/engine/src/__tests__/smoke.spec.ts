import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, NOVA_ENGINE_VERSION } from '../index.js';

describe('@nova-app/engine smoke', () => {
  it('exports the correct version', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
    expect(NOVA_ENGINE_VERSION).toBe(ENGINE_VERSION);
  });
});
