/**
 * Auth types — per docs/13_SECURITY_ARCHITECTURE.md (Phase 3).
 */

/** JWT payload decoded from Supabase Auth. */
export interface AuthUser {
  readonly sub: string;          // user UUID
  readonly email?: string;
  readonly role: string;         // 'authenticated' | 'service_role'
  readonly iat?: number;
  readonly exp?: number;
}

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly dailyLossCapUsd: number;
  readonly maxAutoNotionalUsd: number;
  readonly minRiskScore: number;
  readonly maxTradesPerPair: number;
  readonly cooldownSeconds: number;
  readonly autoPausedUntil: string | null;
}

export interface AlertRule {
  readonly id: string;
  readonly userId: string;
  readonly pair: string | null;
  readonly minProfitBps: number;
  readonly maxRiskScore: number;
  readonly minConfidence: number;
  readonly enabled: boolean;
  readonly cooldownSeconds: number;
}

export interface WatchlistEntry {
  readonly id: string;
  readonly userId: string;
  readonly opportunityId: string;
  readonly notes: string | null;
}

/** Decode and verify a Supabase JWT. Returns null if invalid. */
export function decodeAuthUser(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]!)) as Record<string, unknown>;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : 'authenticated',
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}