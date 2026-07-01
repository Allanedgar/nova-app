**See also:** [01_PROJECT_VISION.md](01_PROJECT_VISION.md), [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [27_TESTING_STRATEGY.md](27_TESTING_STRATEGY.md)
# Engineering Principles

**Document:** Phase 0 — Foundation
**Cross-References:** [01_PROJECT_VISION.md](01_PROJECT_VISION.md), [02_PHASED_ROADMAP.md](02_PHASED_ROADMAP.md), [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md)

---

## 1. Core Principles

### 1.1 Type Safety First

All code must be TypeScript with `strict: true`. No `any` types unless explicitly justified and documented.

```typescript
// ✅ Good
interface Connector {
  readonly id: string;
  readonly kind: 'cex' | 'dex' | 'bridge';
  fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot>;
}

// ❌ Bad
function fetchData(url: any): any {
  return fetch(url).then(r => r.json());
}
```

**Rules:**
- Enable `strict: true` in `tsconfig.json`
- Use `readonly` for immutable properties
- Prefer `interface` over `type` for object shapes
- Use explicit return types on public functions

### 1.2 Separation of Concerns

Pure functions for business logic, IO at the boundaries.

```
┌─────────────────────────────────────────┐
│         Pure Engine Layer              │
│  (no IO, no side effects, testable)    │
└─────────────────────────────────────────┘
           ↑              ↑
           │              │
┌──────────┴──────┐  ┌───┴──────────────┐
│  Connectors     │  │  Persistence     │
│  (HTTP/WS/RPC)  │  │  (DB/Redis)      │
└─────────────────┘  └──────────────────┘
```

**Rules:**
- `packages/engine` — Pure functions only, no imports from connectors/persistence/cache
- `packages/connectors` — IO only, no business logic
- `packages/persistence` — Database access only
- `packages/cache` — Redis access only
- `packages/risk` — Pure scoring functions
- `packages/execution` — Business logic + IO for trades

### 1.3 Security by Default

Every table uses RLS. Every secret is encrypted. Every endpoint is authenticated.

**Rules:**
- RLS enabled on all Supabase tables
- API keys stored in Supabase Vault, never in code
- JWT validation on all protected routes
- Rate limiting on public endpoints
- Audit log for all sensitive operations

### 1.4 Observability Built-In

Logs, metrics, traces from day one.

**Rules:**
- Structured logging with `pino`
- OpenTelemetry tracing on all services
- Prometheus metrics for business logic
- Correlation IDs across service boundaries
- Error tracking with Sentry

### 1.5 Progressive Enhancement

Build in layers: Detect → Manual → Automated.

**Rules:**
- Phase 1: Detection only (no execution)
- Phase 6: Manual execution (env-gated)
- Phase 6: Simulated mode (paper trading)
- Phase 6: Automated mode (behind guardrails)
- Never skip a phase

---

## 2. Code Quality Standards

### 2.1 Testing Requirements

| Type | Coverage | Location |
|---|---|---|
| Unit | 100% of pure functions | `__tests__/` alongside code |
| Integration | All public APIs | `test/integration/` |
| E2E | Critical user flows | `apps/web/e2e/`, `apps/mobile/e2e/` |
| Contract | All connectors | `packages/connectors/*/__tests__/` |

**TDD Workflow:**
1. Write failing test
2. Implement minimal code to pass
3. Refactor
4. Commit

### 2.2 Code Review Standards

Every PR must have:
- [ ] Tests passing (`pnpm -r test`)
- [ ] Lint passing (`pnpm lint`)
- [ ] TypeScript compilation (`pnpm -r typecheck`)
- [ ] Security review for execution/auth code
- [ ] At least 1 approval

### 2.3 Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | kebab-case | `arbitrage-engine.ts` |
| Classes | PascalCase | `ArbitrageEngine` |
| Functions | camelCase | `findOpportunities()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Types | PascalCase | `PriceSnapshot` |
| Interfaces | PascalCase + `I` prefix | `IConnector` |
| Database tables | snake_case | `price_snapshots` |
| Database columns | snake_case | `observed_at` |

### 2.4 Error Handling

```typescript
// ✅ Good - explicit, typed, logged
try {
  const snapshot = await connector.fetchSnapshot(pair);
  return snapshot;
} catch (error) {
  logger.error({ connector: connector.id, pair, error }, 'Failed to fetch snapshot');
  throw new ConnectorError(`Failed to fetch ${pair.symbol}`, { cause: error });
}

// ❌ Bad - silent failure, no context
try {
  return await fetch(url);
} catch (e) {
  return null;
}
```

**Rules:**
- Never swallow errors silently
- Always log with context
- Use typed errors (`class ConnectorError extends Error`)
- Propagate errors to caller
- Circuit breakers for external services

### 2.5 Async Patterns

```typescript
// ✅ Good - Promise.all for parallel, Promise.allSettled for fault-tolerant
const [binance, coinbase] = await Promise.all([
  binanceConnector.fetchSnapshot(pair),
  coinbaseConnector.fetchSnapshot(pair)
]);

// ✅ Good - Promise.allSettled when partial failure is OK
const results = await Promise.allSettled(
  connectors.map(c => c.fetchSnapshot(pair))
);
const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);

// ❌ Bad - sequential when parallel possible
const binance = await binanceConnector.fetchSnapshot(pair);
const coinbase = await coinbaseConnector.fetchSnapshot(pair);
```

**Rules:**
- Use `Promise.all` for parallel independent operations
- Use `Promise.allSettled` when partial failure is acceptable
- Avoid async in loops (use `Promise.all`)
- Set timeouts on all external calls

---

## 3. Architecture Decisions

### 3.1 Why NestJS?

- **Opinionated structure** — Enforces consistent patterns
- **Dependency injection** — Testable, modular
- **Built-in decorators** — `@Cron`, `@Throttle`, `@UseGuards`
- **TypeScript-first** — Full type safety
- **Mature ecosystem** — 10+ years, production-proven

### 3.2 Why Supabase?

- **Postgres + RLS** — Battle-tested security model
- **Realtime** — WebSocket subscriptions out of the box
- **Auth** — Email, OAuth, MFA without custom code
- **Edge Functions** — Deno runtime for cron jobs
- **CLI** — Migrations as code

### 3.3 Why pnpm?

- **Disk efficiency** — Shared dependencies across workspace
- **Strict resolution** — Catches peer dependency issues early
- **Speed** — Faster than npm/yarn
- **Monorepo support** — First-class workspaces

### 3.4 Why CCXT?

- **Unified API** — 200+ exchanges, same interface
- **Proven** — Used by thousands of production bots
- **Actively maintained** — Regular updates for API changes
- **Type definitions** — TypeScript support

---

## 4. Anti-Patterns (Do Not)

### 4.1 Code Anti-Patterns

```typescript
// ❌ NO - Magic numbers
if (profit > 0.01) { /* ... */ }

// ✅ YES - Named constants
const MIN_PROFIT_BPS = 100;
if (profitBps >= MIN_PROFIT_BPS) { /* ... */ }

// ❌ NO - Hardcoded credentials
const apiKey = "binance-api-key-123";

// ✅ YES - Environment variables
const apiKey = process.env.BINANCE_API_KEY!;

// ❌ NO - Silent failures
try { await doSomething(); } catch (e) { /* ignore */ }

// ✅ YES - Explicit error handling
try {
  await doSomething();
} catch (error) {
  logger.error({ error }, 'Failed to do something');
  throw new ServiceError('Failed to do something', { cause: error });
}

// ❌ NO - God functions
function processOpportunity(data) {
  // 500 lines doing everything
}

// ✅ YES - Single responsibility
function validateOpportunity(opp: Opportunity): ValidationResult {
  // Only validation
}

function scoreOpportunity(opp: Opportunity): RiskScore {
  // Only scoring
}

function persistOpportunity(opp: Opportunity): Promise<void> {
  // Only persistence
}
```

### 4.2 Architecture Anti-Patterns

- ❌ **Circular dependencies** — Enforced by ESLint boundaries
- ❌ **Leaky abstractions** — Connectors return `PriceSnapshot`, not exchange-specific types
- ❌ **Premature optimization** — Optimize after measuring
- ❌ **Over-engineering** — Build for current phase, not future
- ❌ **Hardcoded values** — Use env vars, config files
- ❌ **Tight coupling** — Depend on interfaces, not implementations
- ❌ **Global state** — Use dependency injection

---

## 5. Performance Guidelines

### 5.1 Database Queries

```typescript
// ❌ NO - N+1 queries
for (const opp of opportunities) {
  await db.update('opportunities').set({ viewed: true }).where('id', opp.id);
}

// ✅ YES - Batch update
await db.update('opportunities').set({ viewed: true })
  .where('id', inArray(opportunities.map(o => o.id)));
```

**Rules:**
- Use indexes on frequently queried columns
- Batch operations when possible
- Avoid `SELECT *` — specify columns
- Use CTEs for complex queries
- Connection pooling (handled by Supabase)

### 5.2 Caching Strategy

```typescript
// Three-tier cache
const CACHE_TTL = {
  SNAPSHOT: 5,      // 5 seconds - price data
  OPPORTUNITY: 60,  // 60 seconds - opportunities
  STATIC: 3600      // 1 hour - static data
};
```

**Rules:**
- Cache immutable or rarely-changing data
- Use sliding windows for time-series
- Invalidate on write
- Cache at multiple layers (Redis, memory)

### 5.3 API Response Times

| Endpoint | Target | Timeout |
|---|---|---|
| GET /opportunities | 200ms | 5s |
| POST /execute | 500ms | 30s |
| GET /markets/snapshots | 100ms | 5s |
| WS /markets | - | Persistent |

---

## 6. Security Standards

### 6.1 Authentication

```typescript
// All protected routes must validate JWT
@UseGuards(AuthGuard)
@Get('opportunities')
async getOpportunities(@Request() req) {
  const userId = req.user.id; // From JWT
  // ...
}
```

### 6.2 Authorization

```typescript
// RLS policies enforce at database level
CREATE POLICY "Users can view own opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

### 6.3 Input Validation

```typescript
// Validate all inputs with Zod
const CreateOpportunitySchema = z.object({
  pair: z.string(),
  buyExchange: z.string(),
  sellExchange: z.string(),
  profitBps: z.number().positive()
});

async function createOpportunity(input: unknown) {
  const validated = CreateOpportunitySchema.parse(input);
  // ...
}
```

### 6.4 Secrets Management

- ❌ Never commit secrets to Git
- ❌ Never log secrets
- ❌ Never expose secrets to client
- ✅ Use Supabase Vault
- ✅ Use environment variables for non-sensitive config
- ✅ Rotate secrets quarterly

---

## 7. Documentation Standards

All code must be documented:

```typescript
/**
 * Finds triangular arbitrage opportunities across 3 trading pairs.
 *
 * Algorithm: Builds adjacency map of (token → quote) edges, finds 3-cycles
 * where product > 1 + threshold. Rejects stale snapshots and illiquid pairs.
 *
 * @param pairs - Trading pairs from market snapshot
 * @param options - Detection options (minProfitBps, maxAgeSeconds)
 * @returns Array of triangular opportunities sorted by profit desc
 *
 * @example
 * ```ts
 * const opps = findTriangularOpportunities(pairs, { minProfitBps: 50 });
 * console.log(opps[0].profitBps); // 120.5
 * ```
 *
 * @throws {ValidationError} If pairs array is empty
 * @since 1.0.0
 */
export function findTriangularOpportunities(
  pairs: TradingPair[],
  options?: TriangularOptions
): TriangularOpportunity[] {
  // Implementation
}
```

**Requirements:**
- JSDoc on all public functions
- README in every package
- Architecture diagrams for complex flows
- Examples in documentation

---

## 8. Acceptance Criteria

- [ ] All code follows type-safe patterns
- [ ] Pure functions have 100% unit test coverage
- [ ] ESLint boundaries enforced
- [ ] All errors are logged with context
- [ ] No hardcoded secrets or magic numbers
- [ ] All public functions documented
- [ ] Performance budgets met
- [ ] Security review passed

## Engineering Notes

- These principles are enforced via ESLint, tests, and code review
- Exceptions require documented justification
- Principles evolve as project matures
- All contributors must agree to these standards