**See also:** [14_DATABASE_SCHEMA.md](14_DATABASE_SCHEMA.md), [20_BIOMETRIC_SECURITY.md](20_BIOMETRIC_SECURITY.md), [23_AUDIT_LOGGING.md](23_AUDIT_LOGGING.md)
# Security Architecture

**Document:** Phase 3 — Auth + Multi-Tenant
**Cross-References:** [03_ENGINEERING_PRINCIPLES.md](03_ENGINEERING_PRINCIPLES.md), [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [22_GUARDRAILS.md](22_GUARDRAILS.md)

---

## 1. Overview

Security Architecture defines authentication, authorization, encryption, and audit patterns for ARBITRAGE-PRO. Every layer implements defense-in-depth with no single point of failure.

**Key Properties:**
- Zero-trust — No implicit trust between services
- Least privilege — Minimal permissions per component
- Defense-in-depth — Multiple security layers
- Audit-first — All actions logged and traceable
- Secret-safe — No credentials in code or logs

---

## 2. Threat Model

### 2.1 Threats

| Threat | Severity | Mitigation |
|---|---|---|
| Exchange API key theft | Critical | Supabase Vault encryption |
| Unauthorized trade execution | Critical | 6-tier guardrails + biometrics |
| Data breach (user opportunities) | High | RLS on all tables |
| Man-in-the-middle | High | TLS 1.3 everywhere |
| DDoS / rate limit abuse | Medium | Throttling + circuit breakers |
| Phishing / credential theft | Medium | MFA + biometrics |
| SQL injection | Medium | ORM + parameterized queries |
| XSS / CSRF | Medium | CSP + CSRF tokens |
| Smart contract vulnerability | High | DEX connectors read-only |
| Bridge hack | High | Bridge connectors read-only |

### 2.2 Attack Surface

```
┌────────────────────────────────────────────┐
│  ATTACK SURFACE                           │
├────────────────────────────────────────────┤
│ 1. API endpoints (NestJS)                 │
│ 2. WebSocket connections                  │
│ 3. Database queries (RLS)                 │
│ 4. Exchange credentials (Vault)            │
│ 5. Smart contract interactions (DEX)      │
│ 6. Bridge transactions (cross-chain)       │
│ 7. Mobile app (biometric bypass)          │
│ 8. Push notifications (spoofing)          │
└────────────────────────────────────────────┘
```

---

## 3. Authentication

### 3.1 Supabase Auth

```typescript
// packages/security/src/auth/supabase-auth.ts
export class AuthService {
  constructor(private supabase: SupabaseClient) {}
  
  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw new AuthenticationError(error.message);
    }
    
    // Store session
    await this.storeSession(data.session);
    
    return data.session;
  }
  
  async signInWithGoogle(): Promise<Session> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${FRONTEND_URL}/auth/callback`
      }
    });
    
    return data.session;
  }
  
  async validateToken(token: string): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser(token);
    
    if (error || !data.user) {
      throw new AuthenticationError('Invalid token');
    }
    
    return data.user;
  }
}
```

### 3.2 JWT Validation

```typescript
// apps/api/src/auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super();
  }
  
  validate(request: Request, payload: any) {
    // payload = decoded JWT
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  }
}

// apps/api/src/auth/auth.guard.ts
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    
    try {
      const user = this.authService.validateToken(token);
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

### 3.3 Multi-Factor Authentication

```typescript
// packages/security/src/auth/mfa.ts
export class MFAService {
  async enable(userId: string, secret: string): Promise<void> {
    // Encrypt and store in Supabase Vault
    const encrypted = await this.encrypt(secret);
    await this.supabase.from('profiles').update({
      mfa_enabled: true,
      mfa_secret: encrypted
    }).eq('id', userId);
  }
  
  async verify(userId: string, token: string): Promise<boolean> {
    const profile = await this.getProfile(userId);
    if (!profile.mfa_enabled) return true;
    
    const secret = await this.decrypt(profile.mfa_secret);
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token
    });
  }
  
  async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex')
    );
    
    const hashed = await this.hash(codes);
    await this.supabase.from('profiles').update({
      mfa_recovery_codes: hashed
    }).eq('id', userId);
    
    return codes;
  }
}
```

---

## 4. Authorization

### 4.1 Role-Based Access Control

```typescript
export enum Role {
  USER = 'user',
  PREMIUM = 'premium',
  ADMIN = 'admin',
  SERVICE = 'service'
}

export const PERMISSIONS = {
  [Role.USER]: [
    'opportunities:read',
    'watchlist:write',
    'alerts:write'
  ],
  [Role.PREMIUM]: [
    'opportunities:read',
    'opportunities:execute',
    'watchlist:write',
    'alerts:write'
  ],
  [Role.ADMIN]: [
    '*'
  ],
  [Role.SERVICE]: [
    'connectors:write',
    'discovery:write',
    'opportunities:write'
  ]
};

export class AuthorizationService {
  hasPermission(user: User, permission: string): boolean {
    const userPermissions = PERMISSIONS[user.role] ?? [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  }
}
```

### 4.2 Resource Ownership

```typescript
// All policies enforce: auth.uid() = user_id
CREATE POLICY "Users can view own opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

---

## 5. Encryption

### 5.1 At Rest

```typescript
// packages/security/src/encryption/vault.ts
export class VaultService {
  constructor(private supabase: SupabaseClient) {}
  
  async encrypt(keyId: string, plaintext: string): Promise<string> {
    // Use Supabase Vault (AES-256-GCM)
    const { data, error } = await this.supabase.rpc('vault_encrypt', {
      key_id: keyId,
      plaintext
    });
    
    if (error) throw new EncryptionError(error.message);
    return data;
  }
  
  async decrypt(keyId: string, ciphertext: string): Promise<string> {
    const { data, error } = await this.supabase.rpc('vault_decrypt', {
      key_id: keyId,
      ciphertext
    });
    
    if (error) throw new EncryptionError(error.message);
    return data;
  }
}
```

### 5.2 In Transit

- TLS 1.3 on all HTTP/WebSocket connections
- Certificate pinning on mobile apps
- HSTS headers on all responses

```typescript
// apps/api/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // HTTPS only
    httpsOptions: {
      key: readFileSync(privateKey),
      cert: readFileSync(certificate)
    }
  });
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "wss://api.arbitrage-pro.com"]
      }
    }
  }));
}
```

---

## 6. Secret Management

### 6.1 Supabase Vault

```sql
-- Create encryption key
SELECT vault.create_secret('exchange-api-keys', aes_encrypt(
  '{"binance":{"apiKey":"...","secret":"..."}}',
  'master-key'
));

-- Read secret
SELECT vault.decrypt_secret('exchange-api-keys');
```

### 6.2 Environment Variables

```bash
# .env (never commit)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Vault only
DATABASE_URL=postgres://...

# Exchange API keys (loaded into Vault)
BINANCE_API_KEY=
BINANCE_API_SECRET=
OKX_API_KEY=
OKX_API_SECRET=

# Never in .env:
# - Private keys
# - Seed phrases
# - Database passwords
```

### 6.3 Secret Rotation

```typescript
// packages/security/src/rotation/secret-rotator.ts
export class SecretRotator {
  @Cron('0 0 0 1 * *') // Monthly
  async rotateSecrets() {
    const secrets = await this.vault.list();
    
    for (const secret of secrets) {
      // Generate new secret
      const newSecret = await this.generate(secret.type);
      
      // Encrypt with new key
      const encrypted = await this.encrypt(newSecret);
      
      // Update Vault
      await this.vault.update(secret.id, encrypted);
      
      // Notify owners
      await this.notifyRotation(secret.owner, secret.name);
    }
  }
}
```

---

## 7. Row-Level Security

### 7.1 RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users see only their own data
CREATE POLICY "users_own_opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role bypasses RLS
CREATE POLICY "service_full_access"
  ON opportunities FOR ALL
  TO service_role
  USING (true);
```

### 7.2 RLS Testing

```typescript
// packages/security/src/rls/rls-test.ts
export class RLSTester {
  async testOpportunitiesRLS() {
    // Test as user1
    const user1Client = this.createClient('user1@example.com');
    const user1Opps = await user1Client.from('opportunities').select('*');
    
    // Test as user2
    const user2Client = this.createClient('user2@example.com');
    const user2Opps = await user2Client.from('opportunities').select('*');
    
    // Assert isolation
    expect(user1Opps.data).not.toEqual(user2Opps.data);
  }
}
```

---

## 8. Input Validation

### 8.1 Zod Schemas

```typescript
const OpportunitySchema = z.object({
  pair: z.string().min(3).max(20),
  sourceExchange: z.string().min(2).max(50),
  targetExchange: z.string().min(2).max(50),
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive(),
  netProfitBps: z.number().min(0),
  liquidityUsd: z.number().min(0)
});

export function validateOpportunity(input: unknown) {
  return OpportunitySchema.parse(input);
}
```

### 8.2 SQL Injection Prevention

```typescript
// ✅ Use ORM
const opps = await db
  .select()
  .from(opportunities)
  .where(eq(opportunities.userId, userId));

// ✅ Parameterized queries
const { data } = await supabase
  .from('opportunities')
  .select('*')
  .eq('id', opportunityId)
  .single();

// ❌ Never concatenate strings
const query = `SELECT * FROM opportunities WHERE id = '${id}'`;
```

---

## 9. Audit Logging

### 9.1 Audit Events

```typescript
export enum AuditEventType {
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  OPPORTUNITY_VIEWED = 'opportunity.viewed',
  OPPORTUNITY_EXECUTED = 'opportunity.executed',
  ALERT_CREATED = 'alert.created',
  ALERT_DELETED = 'alert.deleted',
  CONNECTOR_ENABLED = 'connector.enabled',
  CONNECTOR_DISABLED = 'connector.disabled',
  RISK_TIER_CHANGED = 'risk_tier.changed'
}

export interface AuditEvent {
  readonly id: string;
  readonly userId: string;
  readonly type: AuditEventType;
  readonly timestamp: Date;
  readonly ip: string;
  readonly userAgent: string;
  readonly metadata: Record<string, any>;
}

export class AuditLogger {
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const audit: AuditEvent = {
      ...event,
      id: generateId(),
      timestamp: new Date()
    };
    
    // Persist to DB
    await this.supabase.from('audit_log').insert(audit);
    
    // Also log to console
    logger.info(audit);
  }
}
```

### 9.2 Immutable Audit Log

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  ip INET,
  user_agent TEXT,
  metadata JSONB,
  
  -- Indexes
  INDEX idx_audit_user ON audit_log(user_id),
  INDEX idx_audit_timestamp ON audit_log(timestamp),
  INDEX idx_audit_type ON audit_log(event_type)
);

-- Never allow UPDATE/DELETE
REVOKE UPDATE, DELETE ON audit_log FROM service_role;
```

---

## 10. Rate Limiting

### 10.1 API Throttling

```typescript
// apps/api/src/throttler/throttler.module.ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class ThrottlerModule {}

// apps/api/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(
    new ThrottlerGuard([
      {
        name: 'short',
        ttl: 1000,  // 1s
        limit: 10   // 10 requests per second
      },
      {
        name: 'long',
        ttl: 60000, // 1min
        limit: 100  // 100 requests per minute
      }
    ])
  );
}
```

### 10.2 Per-User Rate Limits

```typescript
export class UserRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  
  async checkLimit(userId: string, limit: number, windowMs: number): Promise<boolean> {
    const bucket = this.buckets.get(userId) ?? 
      new TokenBucket(limit, windowMs);
    
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, bucket);
    }
    
    const available = await bucket.tryAcquire();
    return available;
  }
}
```

---

## 11. Mobile Security

### 11.1 Certificate Pinning

```typescript
// apps/mobile/src/utils/ssl-pinning.ts
import SslPinning from 'react-native-ssl-pinning';

export async function fetchWithPinning(url: string) {
  return SslPinning.fetch(url, {
    method: 'GET',
    sslPinning: {
      certs: ['arbitrage-pro-com'],
      domains: ['api.arbitrage-pro.com']
    }
  });
}
```

### 11.2 Secure Storage

```typescript
// apps/mobile/src/auth/secure-storage.ts
import * as SecureStore from 'expo-secure-store';

export class SecureStorage {
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
  
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }
  
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}
```

### 11.3 Biometric Fallback

```typescript
// Reject Class 1-2 biometrics
export class BiometricGate {
  async authenticate(): Promise<boolean> {
    const { available, biometryType } = await LocalAuthentication.authenticateAsync();
    
    if (!available) {
      // Fallback to device credential
      return await this.promptDeviceCredential();
    }
    
    // Require Class 3 biometrics
    if (biometryType === LocalAuthentication.BIOMETRY_TYPE_FACE_ID ||
        biometryType === LocalAuthentication.BIOMETRY_TYPE_FINGERPRINT) {
      return true;
    }
    
    throw new SecurityError('Insufficient biometric security');
  }
}
```

---

## 12. Security Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss://api.arbitrage-pro.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

---

## 13. Vulnerability Management

### 13.1 Security Scanning

| Tool | Frequency | Action |
|---|---|---|
| npm audit | Every CI run | Fail on critical |
| Snyk | Daily | Alert on new CVEs |
| Socket | Every PR | Block malicious packages |
| OWASP ZAP | Weekly | Scan for OWASP top 10 |

### 13.2 Incident Response

```typescript
export class IncidentResponse {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. Alert team
    await this.notifySlack(incident);
    
    // 2. Preserve evidence
    await this.preserveLogs(incident);
    
    // 3. Contain breach
    await this.contain(incident);
    
    // 4. Notify affected users
    await this.notifyUsers(incident);
    
    // 5. Post-mortem
    await this.createPostMortem(incident);
  }
}
```

---

## 14. Acceptance Criteria

- [ ] Supabase Auth with email + OAuth
- [ ] MFA optional but encouraged
- [ ] RLS policies on all tables
- [ ] Audit log for all sensitive operations
- [ ] TLS 1.3 enforced
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all inputs
- [ ] No secrets in code or logs
- [ ] Security scanning in CI
- [ ] Incident response plan documented

## Engineering Notes

- Security is not optional — all features require security review
- RLS is non-negotiable — enabled on every table
- Secrets never leave Vault unencrypted
- MFA required for admin actions
- Monitor for suspicious patterns (rapid trades, new devices)