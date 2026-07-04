/**
 * Auth middleware — extracts and validates Supabase JWT from HTTP requests.
 * Per docs/13_SECURITY_ARCHITECTURE.md §3.
 */

import { decodeAuthUser, type AuthUser } from './auth.js';

export interface AuthenticatedRequest {
  readonly user: AuthUser;
  readonly token: string;
}

/**
 * Extract and validate bearer token from an HTTP Request-like object.
 * Returns null if the token is missing or invalid.
 */
export function authenticateRequest(
  headers: Record<string, string | string[] | undefined>,
): AuthenticatedRequest | null {
  const raw = headers['authorization'] ?? headers['Authorization'] ?? '';
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return null;

  const parts = value.split(' ');
  if (parts.length !== 2 || parts[0]!.toLowerCase() !== 'bearer') return null;

  const token = parts[1]!;
  const user = decodeAuthUser(token);
  if (!user) return null;

  return { user, token };
}

/**
 * Require authentication. Throws if token is missing or invalid.
 */
export function requireAuth(
  headers: Record<string, string | string[] | undefined>,
): AuthenticatedRequest {
  const result = authenticateRequest(headers);
  if (!result) throw new Error('Unauthorized: invalid or missing token');
  return result;
}

/**
 * Require the user to have a specific role.
 */
export function requireRole(
  headers: Record<string, string | string[] | undefined>,
  role: string,
): AuthenticatedRequest {
  const result = requireAuth(headers);
  if (result.user.role !== role) {
    throw new Error(`Forbidden: required role "${role}", got "${result.user.role}"`);
  }
  return result;
}