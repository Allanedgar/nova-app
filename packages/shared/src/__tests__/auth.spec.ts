/**
 * @nova-app/shared — auth utilities tests.
 */

import { describe, expect, it } from 'vitest';
import { decodeAuthUser } from '../auth.js';

describe('decodeAuthUser', () => {
  it('decodes a valid Supabase JWT', () => {
    // Build a valid JWT: header.payload.signature
    const payload = btoa(JSON.stringify({ sub: 'u-123', email: 'a@b.com', role: 'authenticated' }));
    const token = `header.${payload}.sig`;
    const user = decodeAuthUser(token);
    expect(user).not.toBeNull();
    expect(user!.sub).toBe('u-123');
    expect(user!.email).toBe('a@b.com');
    expect(user!.role).toBe('authenticated');
  });

  it('returns null for malformed token', () => {
    expect(decodeAuthUser('not-a-jwt')).toBeNull();
    expect(decodeAuthUser('a.b')).toBeNull();
  });

  it('returns null for non-JSON payload', () => {
    expect(decodeAuthUser('a.not-json.c')).toBeNull();
  });
});