/**
 * @nova-app/shared — auth middleware tests.
 */

import { describe, expect, it } from 'vitest';
import { authenticateRequest, requireAuth, requireRole } from '../middleware.js';

const validToken = `header.${btoa(JSON.stringify({ sub: 'u-1', email: 'a@b.com', role: 'authenticated' }))}.sig`;

describe('authenticateRequest', () => {
  it('extracts user from valid Bearer token', () => {
    const result = authenticateRequest({ authorization: `Bearer ${validToken}` });
    expect(result).not.toBeNull();
    expect(result!.user.sub).toBe('u-1');
  });

  it('returns null for missing header', () => {
    expect(authenticateRequest({})).toBeNull();
  });

  it('returns null for malformed header', () => {
    expect(authenticateRequest({ authorization: 'Invalid' })).toBeNull();
    expect(authenticateRequest({ authorization: 'Bearer ' })).toBeNull();
  });
});

describe('requireAuth', () => {
  it('returns result for valid token', () => {
    const result = requireAuth({ authorization: `Bearer ${validToken}` });
    expect(result.user.sub).toBe('u-1');
  });

  it('throws for missing token', () => {
    expect(() => requireAuth({})).toThrow('Unauthorized');
  });
});

describe('requireRole', () => {
  it('passes for matching role', () => {
    const result = requireRole({ authorization: `Bearer ${validToken}` }, 'authenticated');
    expect(result.user.sub).toBe('u-1');
  });

  it('throws for mismatched role', () => {
    expect(() => requireRole({ authorization: `Bearer ${validToken}` }, 'service_role')).toThrow('Forbidden');
  });
});