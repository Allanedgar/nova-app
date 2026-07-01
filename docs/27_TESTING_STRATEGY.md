# Testing Strategy

**Document:** Engineering Standards
**Cross-References:** [04_TECH_STACK.md](04_TECH_STACK.md), [21_EXECUTION_ENGINE.md](21_EXECUTION_ENGINE.md), [06_DEPENDENCIES.md](06_DEPENDENCIES.md)

---

## 1. Overview

Multi-layered testing strategy ensuring correctness, performance, and reliability. Every layer must pass before code reaches production.

**Key Properties:**
- Pyramid — Unit 70%, Integration 20%, E2E 10%
- Deterministic — No flaky tests
- Fast — Unit tests <100ms, Integration <5s
- Isolated — Each test independent
- CI-gated — All tests must pass on PR

---

## 2. Test Pyramid

```
        /\
       /E2E\        10% - Critical paths
      /------\
     /Integr.\      20% - API + DB
    /----------\
   /Unit Tests \   70% - Logic + Utilities
  /--------------\
```

---

## 3. Framework Selection

### 3.1 Unit Testing

| Tool | Usage | Why |
|---|---|---|
| Jest | Packages | Zero-config, fast |
| Vitest | Apps/web | ESM-native, faster |
| pytest | Backend services | Python standard |

### 3.2 Integration Testing

| Tool | Usage | Why |
|---|---|---|
| Jest + supertest | API endpoints | HTTP assertions |
| Playwright | E2E | Cross-browser, real user flows |
| k6 | Load testing | Performance benchmarks |

### 3.3 Mocking

| Tool | Usage | Why |
|---|---|---|
| MSW (Mock Service Worker) | API mocking | Network-level intercepts |
| sinon | Spies/stubs/mocks | Flexible mocking |
| jest.mock | Module mocks | Simple replacements |

---

## 4. Unit Tests

### 4.1 Structure

```
packages/arbitrage-engine/
├── src/
│   ├── engine.ts
│   ├── detector.ts
│   └── scorer.ts
├── tests/
│   ├── engine.test.ts
│   ├── detector.test.ts
│   └── scorer.test.ts
└── package.json
```

### 4.2 Example: Arbitrage Engine

```typescript
// packages/arbitrage-engine/tests/engine.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ArbitrageEngine } from '../src/engine';

describe('ArbitrageEngine', () => {
  let engine: ArbitrageEngine;
  
  beforeEach(() => {
    engine = new ArbitrageEngine({
      minSpreadBps: 50,
      maxSlippageBps: 10
    });
  });
  
  it('detects spatial arbitrage', () => {
    const snapshots = [
      createSnapshot('BTC/USDT', 50000, 50010, 'binance'),
      createSnapshot('BTC/USDT', 50020, 50030, 'coinbase')
    ];
    
    const opportunities = engine.detect(snapshots);
    
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].type).toBe('spatial');
    expect(opportunities[0].netProfitBps).toBeGreaterThan(50);
  });
  
  it('ignores opportunities below threshold', () => {
    const snapshots = [
      createSnapshot('BTC/USDT', 50000, 50010, 'binance'),
      createSnapshot('BTC/USDT', 50005, 50015, 'coinbase') // 5 bps spread
    ];
    
    const opportunities = engine.detect(snapshots);
    
    expect(opportunities).toHaveLength(0);
  });
  
  it('validates trade costs', () => {
    const opportunity = createOpportunity({
      buyPrice: 50000,
      sellPrice: 50100,
      buyFee: 10,
      sellFee: 10
    });
    
    const costs = engine.calculateCosts(opportunity);
    
    expect(costs.totalFeeBps).toBeCloseTo(20, 1);
  });
});
```

---

## 5. Integration Tests

### 5.1 API Integration Tests

```typescript
// apps/api/tests/integration/opportunities.test.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';

describe('Opportunities API', () => {
  let authToken: string;
  
  beforeAll(async () => {
    // Login to get token
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    
    authToken = response.body.accessToken;
  });
  
  it('GET /opportunities returns array', async () => {
    const response = await request(app)
      .get('/opportunities')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.opportunities).toBeInstanceOf(Array);
  });
  
  it('GET /opportunities/:id returns opportunity', async () => {
    const response = await request(app)
      .get('/opportunities/test-opportunity-id')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('test-opportunity-id');
  });
  
  it('POST /opportunities/:id/execute creates trade', async () => {
    const response = await request(app)
      .post('/opportunities/test-opportunity-id/execute')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ notionalUsd: 1000, type: 'manual' });
    
    expect(response.status).toBe(201);
    expect(response.body.tradeId).toBeDefined();
  });
});
```

### 5.2 Database Integration Tests

```typescript
// packages/persistence/tests/postgres.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SupabasePersistence } from '../src/supabase';

describe('SupabasePersistence', () => {
  let persistence: SupabasePersistence;
  
  beforeAll(async () => {
    persistence = new SupabasePersistence({
      url: process.env.SUPABASE_URL!,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY!
    });
    
    // Run migrations
    await persistence.runMigrations();
  });
  
  afterAll(async () => {
    await persistence.cleanup();
  });
  
  it('inserts opportunity', async () => {
    const opportunity = createOpportunity();
    
    await persistence.insertOpportunity(opportunity);
    
    const found = await persistence.getOpportunity(opportunity.id);
    
    expect(found).toBeDefined();
    expect(found!.pair).toBe(opportunity.pair);
  });
});
```

---

## 6. E2E Tests

### 6.1 Playwright Configuration

```typescript
// apps/web/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
```

### 6.2 E2E Test Example

```typescript
// apps/web/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('user can login and view opportunities', async ({ page }) => {
  // Navigate to login
  await page.goto('/login');
  
  // Login
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard
  await page.waitForURL('/dashboard');
  
  // Verify opportunities loaded
  await page.waitForSelector('[data-testid="opportunity-card"]');
  
  const opportunities = await page.locator('[data-testid="opportunity-card"]').count();
  expect(opportunities).toBeGreaterThan(0);
});
```

---

## 7. Load Testing

### 7.1 k6 Configuration

```javascript
// k6/opportunities.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01']
  }
};

export default function () {
  const response = http.get('https://api.arbitrage-pro.com/opportunities', {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` }
  });
  
  check(response, {
    'status 200': (r) => r.status === 200,
    'response time <200ms': (r) => r.timings.duration < 200
  });
  
  sleep(1);
}
```

### 7.2 Load Test Run

```bash
k6 run --env TOKEN=$JWT_TOKEN k6/opportunities.js
```

---

## 8. Chaos Testing

### 8.1 Chaos Scenarios

| Scenario | Tool | Purpose |
|---|---|---|
| Kill DB connection | Chaos Monkey | Test reconnect |
| High latency | Toxiproxy | Test timeouts |
| Rate limit | Custom script | Test backpressure |
| Memory pressure | stress-ng | Test OOM handling |

### 8.2 Chaos Example

```yaml
# chaos/db-outage.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: db-outage
spec:
  action: partition
  duration: "30s"
  selector:
    namespaces:
      - arbitrage-pro
  direction: both
  target:
    selector:
      labels:
        app: postgres
```

---

## 9. Regression Testing

### 9.1 Test Suite Organization

```
tests/
├── regression/
│   ├── spatial-arbitrage.spec.ts
│   ├── triangular-arbitrage.spec.ts
│   ├── cross-chain-arbitrage.spec.ts
│   └── execution-flows.spec.ts
```

### 9.2 Replay Tests

```typescript
// tests/regression/spatial-arbitrage.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ReplayEngine } from '../src/replay';

describe('Spatial Arbitrage Regression', () => {
  it('detects known opportunity from 2026-07-01', async () => {
    const replay = new ReplayEngine();
    
    await replay.load('fixtures/2026-07-01-snapshots.jsonl');
    
    const opportunities = await replay.run();
    
    // Must detect this known opportunity
    expect(opportunities).toContainEqual(
      expect.objectContaining({
        pair: 'BTC/USDT',
        sourceExchange: 'coinbase',
        targetExchange: 'binance',
        netProfitBps: expect.any(Number)
      })
    );
  });
});
```

---

## 10. Performance Testing

### 10.1 Benchmark Tests

```typescript
describe('ArbitrageEngine Performance', () => {
  it('processes 1000 snapshots in <100ms', () => {
    const snapshots = Array.from({ length: 1000 }, () => createSnapshot());
    
    const start = Date.now();
    
    engine.detect(snapshots);
    
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
});
```

---

## 11. Coverage Requirements

### 11.1 Coverage Thresholds

| Layer | Minimum | Target |
|---|---|---|
| Unit (packages) | 80% | 90% |
| Integration (apps) | 70% | 80% |
| E2E | Critical paths | All user flows |

### 11.2 CI Gate

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: pnpm test:coverage

- name: Check coverage
  run: |
    pnpm test:coverage -- --coverageThreshold='{"global":{"lines":80}}'
```

---

## 12. Test Data Management

### 12.1 Fixtures

```
tests/fixtures/
├── snapshots/
│   ├── binance-btc.json
│   └── coinbase-btc.json
├── opportunities/
│   └── spatial-btc-usdt.json
└── trades/
    └── manual-execution.json
```

### 12.2 Factories

```typescript
// tests/factories/opportunity.factory.ts
export function createOpportunity(overrides?: Partial<Opportunity>): Opportunity {
  return {
    id: generateId(),
    type: 'spatial',
    pair: 'BTC/USDT',
    sourceExchange: 'binance',
    targetExchange: 'coinbase',
    buyPrice: 50000,
    sellPrice: 50100,
    grossProfitBps: 200,
    feesBps: 20,
    netProfitBps: 180,
    liquidityUsd: 10000,
    riskScore: 75,
    confidenceScore: 0.85,
    detectedAt: new Date(),
    expiresAt: new Date(Date.now() + 30000),
    ...overrides
  };
}
```

---

## 13. Flaky Test Prevention

### 13.1 Strategies

| Issue | Solution |
|---|---|
| Race condition | Use `waitFor` |
| Time-based test | Mock `Date.now()` |
| Network flake | Mock external APIs |
| Order dependency | Shuffle tests |
| Timing flake | Increase timeout |

### 13.2 Retry Logic

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: 2, // Retry flaky tests twice
    maxConcurrency: 10
  }
});
```

---

## 14. Test Documentation

### 14.1 Test Naming

```typescript
describe('ArbitrageEngine.detect', () => {
  describe('when spread exceeds threshold', () => {
    it('returns spatial opportunity', () => {
      // ...
    });
  });
  
  describe('when spread below threshold', () => {
    it('returns empty array', () => {
      // ...
    });
  });
});
```

### 14.2 Test Documentation Template

```typescript
/**
 * Tests spatial arbitrage detection.
 * 
 * Given snapshots from two exchanges
 * When spread > min threshold
 * Then spatial opportunity returned
 * 
 * Reference: docs/10_ARBITRAGE_ENGINE.md §3.1
 */
describe('Spatial Arbitrage Detection', () => {
  // ...
});
```

---

## 15. Acceptance Criteria

- [ ] Unit test coverage ≥80%
- [ ] Integration test coverage ≥70%
- [ ] E2E tests cover critical flows
- [ ] Load tests pass under 2x expected load
- [ ] Chaos tests demonstrate resilience
- [ ] Regression tests collect snapshots
- [ ] No flaky tests in CI
- [ ] Test results in CI artifacts

## Engineering Notes

- Tests must be deterministic
- No network calls in unit tests
- Mock external services
- Run tests locally before PR
- CI is authoritative