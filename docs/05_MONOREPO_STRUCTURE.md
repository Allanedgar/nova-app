**See also:** [04_TECH_STACK.md](04_TECH_STACK.md), [06_DEPENDENCIES.md](06_DEPENDENCIES.md), [01_PROJECT_VISION.md](01_PROJECT_VISION.md)
# Monorepo Structure

**Document:** Phase 0 — Foundation
**Cross-References:** [04_TECH_STACK.md](04_TECH_STACK.md), [06_DEPENDENCIES.md](06_DEPENDENCIES.md)

---

## 1. Repository Layout

```
arbitrage-pro/
├── apps/                          # Applications
│   ├── api/                      # NestJS backend (port 4000)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── market/
│   │   │   │   ├── market.service.ts
│   │   │   │   └── market.controller.ts
│   │   │   ├── workers/
│   │   │   │   ├── detector.worker.ts
│   │   │   │   ├── executor.worker.ts
│   │   │   │   └── alerts.worker.ts
│   │   │   └── auth/
│   │   ├── test/
│   │   │   └── integration/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                      # Next.js dashboard (port 3000)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── callback/route.ts
│   │   │   ├── opportunities/
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── alerts/page.tsx
│   │   │   ├── watchlist/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                    # Expo React Native app
│       ├── app/
│       │   ├── (auth)/
│       │   │   └── login.tsx
│       │   ├── (tabs)/
│       │   │   ├── index.tsx
│       │   │   ├── opportunities.tsx
│       │   │   └── settings/
│       │   │       └── notifications.tsx
│       │   └── opportunities/
│       │       └── [id].tsx
│       ├── src/
│       │   ├── auth/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── services/
│       │   └── storage/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                      # Shared packages
│   ├── shared/                    # Pure TypeScript types
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── connector.ts
│   │   │   ├── market.ts
│   │   │   ├── engine.ts
│   │   │   ├── execution.ts
│   │   │   └── assets.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── engine/                    # Pure arbitrage detection
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── spatial.ts
│   │   │   ├── triangular.ts
│   │   │   ├── cross-chain.ts
│   │   │   └── filter.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── connectors/                # CEX, DEX, bridge connectors
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── binance/
│   │   │   │   ├── rest.ts
│   │   │   │   └── __tests__/rest.spec.ts
│   │   │   ├── okx/
│   │   │   │   ├── rest.ts
│   │   │   │   └── __tests__/rest.spec.ts
│   │   │   ├── krakendex/
│   │   │   │   ├── rest.ts
│   │   │   │   └── __tests__/rest.spec.ts
│   │   │   ├── dex/
│   │   │   │   ├── uniswap-v3.ts
│   │   │   │   ├── pancakeswap.ts
│   │   │   │   ├── sushi.ts
│   │   │   │   └── oneinch.ts
│   │   │   └── bridge/
│   │   │       ├── stargate.ts
│   │   │       ├── wormhole.ts
│   │   │       └── across.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── persistence/               # Supabase writer/reader
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── supabase.ts
│   │   │   ├── types.ts
│   │   │   └── queries.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cache/                     # Redis sliding window
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── redis.ts
│   │   │   └── sliding-window.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── risk/                      # 5-factor risk scorer
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── score.ts
│   │   │   └── profitability.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── alerts/                    # Threshold evaluator + dispatcher
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── evaluator.ts
│   │   │   └── dispatcher.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── execution/                 # 3-tier executor
│       ├── src/
│       │   ├── index.ts
│       │   ├── router.ts
│       │   ├── manual.ts
│       │   ├── simulated.ts
│       │   ├── automated.ts
│       │   ├── safety.ts
│       │   └── audit.ts
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/                       # Database
│   ├── migrations/
│   │   ├── 20260626173000_initial_arbitrage_pro_schema.sql
│   │   ├── 20260630_connector_id_link.sql
│   │   ├── 20260630_dex_pools.sql
│   │   └── 20260630_automation_settings.sql
│   └── functions/                  # Edge functions
│       └── cron/                   # Cron fallbacks
│
├── scripts/                        # Utility scripts
│   └── seed-venues.ts
│
├── .claude/                        # Claude Code config
│   └── commands/
│       ├── dispatch.md
│       ├── merge.md
│       └── phase-next.md
│
├── .github/
│   └── workflows/
│       └── ci.yml                  # Lint → Test → Build
│
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── eslint.config.mjs
├── .gitignore
├── README.md
├── SOUL.md
├── CONTRIBUTING.md
└── LICENSE.md
```

---

## 2. Workspace Configuration

### 2.1 pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'scripts/*'

# Disable hoisting for better isolation
shamefully-hoist: false
strict-peer-dependencies: true
auto-install-peers: true
```

### 2.2 Package Naming Convention

| Package | Name |
|---|---|
| Root workspace | `arbitrage-pro` |
| API app | `@arbitrage-pro/api` |
| Web app | `@arbitrage-pro/web` |
| Mobile app | `@arbitrage-pro/mobile` |
| Shared types | `@arbitrage-pro/shared` |
| Engine | `@arbitrage-pro/engine` |
| Connectors | `@arbitrage-pro/connectors` |
| Persistence | `@arbitrage-pro/persistence` |
| Cache | `@arbitrage-pro/cache` |
| Risk | `@arbitrage-pro/risk` |
| Alerts | `@arbitrage-pro/alerts` |
| Execution | `@arbitrage-pro/execution` |

---

## 3. Package Boundaries

### 3.1 Dependency Rules

 enforced by ESLint `eslint-plugin-boundaries`.

```
shared        → (no imports - pure types)
engine        → shared only (pure functions)
connectors    → shared only (IO only)
persistence   → shared only (DB access)
cache         → shared only (Redis access)
risk          → shared, engine (pure scoring)
alerts        → shared, engine (threshold logic)
execution     → shared, engine, risk (business logic + IO)

apps/api      → shared, engine, connectors, persistence, cache, risk, alerts, execution
apps/web      → shared, engine (via API)
apps/mobile   → shared, engine (via API)
```

### 3.2 Boundary Rules

```javascript
// eslint.config.mjs
export default [
  {
    plugins: {
      boundaries: boundariesPlugin
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'packages/engine', allow: ['packages/shared'] },
            { from: 'packages/connectors', allow: ['packages/shared'] },
            { from: 'packages/persistence', allow: ['packages/shared'] },
            { from: 'packages/cache', allow: ['packages/shared'] },
            { from: 'packages/risk', allow: ['packages/shared', 'packages/engine'] },
            { from: 'packages/alerts', allow: ['packages/shared', 'packages/engine'] },
            { from: 'packages/execution', allow: ['packages/shared', 'packages/engine', 'packages/risk'] },
          ]
        }
      ]
    }
  }
];
```

---

## 4. Shared Package Structure

### 4.1 packages/shared

Pure TypeScript types. Zero dependencies.

```typescript
// src/connector.ts
export interface Connector {
  readonly id: string;
  readonly kind: 'cex' | 'dex' | 'bridge';
  fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot>;
}

// src/market.ts
export interface TradingPair {
  baseAsset: string;
  quoteAsset: string;
  symbol: string;
}

export interface PriceSnapshot {
  bid: number;
  ask: number;
  exchange: ExchangeInfo;
  timestamp: number;
}

// src/engine.ts
export interface ArbitrageOpportunity {
  id: string;
  pair: TradingPair;
  sourceExchange: string;
  targetExchange: string;
  buyPrice: number;
  sellPrice: number;
  grossProfitBps: number;
  estimatedFeesUsd: number;
  estimatedNetProfitUsd: number;
  liquidityUsd: number;
  riskScore: number;
  confidenceScore: number;
  detectedAt: Date;
  expiresAt: Date;
}

// src/execution.ts
export interface ExecutionResult {
  status: 'dry_run' | 'submitted' | 'failed';
  txHash?: string;
  error?: string;
}

export type RiskTier = 'manual' | 'simulated' | 'automated';
```

### 4.2 packages/engine

Pure detection functions. No IO.

```typescript
// src/spatial.ts
export function findSpatialOpportunities(
  snapshots: PriceSnapshot[],
  options?: { minProfitBps?: number; maxAgeSeconds?: number }
): ArbitrageOpportunity[];

// src/triangular.ts
export function findTriangularOpportunities(
  pairs: TradingPair[],
  options?: { minProfitBps?: number }
): TriangularOpportunity[];

// src/cross-chain.ts
export async function findCrossChainOpportunities(
  snapshotsByChain: Map<string, PriceSnapshot[]>,
  bridgeQuote: BridgeQuoteFunction,
  options?: { minNetBps?: number }
): Promise<CrossChainOpportunity[]>;
```

### 4.3 packages/connectors

IO only. One subdirectory per connector.

```typescript
// src/binance/rest.ts
export class BinanceRestConnector implements Connector {
  readonly id = 'binance';
  readonly kind = 'cex';

  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot> {
    // Real HTTP call to Binance REST API
  }
}

// src/index.ts - Fan-out registry
export async function loadMarketSnapshots(
  symbols: TradingPair[],
  enabledConnectors: string[]
): Promise<PriceSnapshot[]> {
  const connectors = enabledConnectors.map(id => registry[id]);
  const results = await Promise.allSettled(
    symbols.map(symbol =>
      Promise.all(
        connectors.map(c => c.fetchSnapshot(symbol))
      )
    )
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}
```

### 4.4 packages/persistence

Database access only.

```typescript
// src/supabase.ts
export class SupabasePersistence {
  constructor(private client: SupabaseClient) {}

  async upsertOpportunities(opportunities: ArbitrageOpportunity[]): Promise<DbResult> {
    // INSERT ... ON CONFLICT UPDATE
  }

  async getOpportunities(userId: string, limit: number): Promise<ArbitrageOpportunity[]> {
    // SELECT with RLS
  }
}
```

### 4.5 packages/cache

Redis access only.

```typescript
// src/sliding-window.ts
export class SlidingWindowCache {
  async add(key: string, value: any, ttlSeconds: number): Promise<void>;
  async getRange(key: string, start: number, end: number): Promise<any[]>;
}
```

### 4.6 packages/risk

Pure scoring functions.

```typescript
// src/score.ts
export function scoreRisk(snapshots: PriceSnapshot[], opp: ArbitrageOpportunity): RiskBreakdown {
  // 5-factor scoring: reliability, volume, age, spread, liquidity
}

// src/profitability.ts
export function scoreProfitability(
  opp: ArbitrageOpportunity,
  notionalUsd: number
): ProfitabilityAnalysis {
  // Net profit after fees, slippage, gas
}
```

### 4.7 packages/alerts

Threshold evaluation + push dispatch.

```typescript
// src/evaluator.ts
export class AlertEvaluator {
  async evaluate(opportunities: ArbitrageOpportunity[]): Promise<Alert[]> {
    // Match against user alert_rules
  }
}

// src/dispatcher.ts
export class AlertDispatcher {
  async dispatch(alerts: Alert[]): Promise<void> {
    // Send push notifications via Expo Push
  }
}
```

### 4.8 packages/execution

Business logic + IO for trades.

```typescript
// src/router.ts
export function routerFor(tier: RiskTier): Executor {
  switch (tier) {
    case 'manual': return new ManualExecutor();
    case 'simulated': return new SimulatedExecutor();
    case 'automated': return new AutomatedExecutor();
  }
}

// src/safety.ts
export class SafetyChecker {
  check(opp: ArbitrageOpportunity, user: UserProfile): SafetyResult {
    // 6 guardrails: notional, risk, daily loss, pair cap, cooldown, pause
  }
}
```

---

## 5. Apps Structure

### 5.1 apps/api

NestJS backend.

```
src/
├── main.ts                    # Bootstrap
├── app.module.ts              # Root module
├── market/
│   ├── market.service.ts      # Market service (orchestrator)
│   └── market.controller.ts   # REST endpoints
├── workers/
│   ├── detector.worker.ts     # 5s detector cron
│   ├── executor.worker.ts     # 3-tier execution queues
│   └── alerts.worker.ts       # Alert evaluator cron
└── auth/
    └── auth.guard.ts          # JWT validation
```

### 5.2 apps/web

Next.js dashboard.

```
app/
├── (auth)/
│   ├── login/page.tsx         # Login page
│   └── callback/route.ts      # OAuth callback
├── opportunities/
│   └── [id]/page.tsx          # Opportunity detail
├── alerts/page.tsx            # Alert rules CRUD
├── watchlist/page.tsx         # Saved opportunities
├── settings/page.tsx          # User settings
└── page.tsx                   # Dashboard (default)
```

### 5.3 apps/mobile

Expo React Native app.

```
app/
├── (auth)/
│   └── login.tsx              # Login screen
├── (tabs)/
│   ├── index.tsx              # Home (6 tiles)
│   ├── opportunities.tsx      # Opportunities list
│   └── settings/
│       └── notifications.tsx  # Notification diagnostics
└── opportunities/
    └── [id].tsx               # Opportunity detail
```

---

## 6. Build Configuration

### 6.1 Root tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true
  }
}
```

### 6.2 Package-level tsconfig.json

Each package extends the base:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 7. Acceptance Criteria

- [ ] pnpm-workspace.yaml configured
- [ ] All packages have package.json
- [ ] All packages have tsconfig.json
- [ ] ESLint boundaries configured
- [ ] No circular dependencies
- [ ] All apps can import from packages
- [ ] Build succeeds for all workspaces

## Engineering Notes

- Keep packages small and focused
- Avoid premature extraction to shared
- Apps are orchestration only
- Business logic lives in packages/