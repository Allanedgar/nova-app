# Performance Targets

**Document:** Engineering Standards
**Cross-References:** [27_TESTING_STRATEGY.md](27_TESTING_STRATEGY.md), [28_OBSERVABILITY.md](28_OBSERVABILITY.md), [29_DEPLOYMENT.md](29_DEPLOYMENT.md)

---

## 1. Overview

Performance targets for ARBITRAGE-PRO. Defines acceptable latency, throughput, and resource utilization for production systems.

**Key Properties:**
- Latency-first — Sub-200ms API responses
- High-throughput — Handle 10k opportunities/minute
- Efficient — Low resource consumption
- Scalable — Horizontal scaling ready
- Measured — Continuous performance tracking

---

## 2. Performance Budget

### 2.1 Response Time Targets

| Endpoint | p50 | p95 | p99 | SLA |
|---|---|---|---|---|
| GET /opportunities | <50ms | <150ms | <300ms | 99.9% |
| POST /execute | <100ms | <200ms | <500ms | 99.5% |
| GET /markets/snapshots | <30ms | <100ms | <200ms | 99.9% |
| WebSocket message | <10ms | <50ms | <100ms | 99.9% |
| GraphQL query | <80ms | <200ms | <500ms | 99.5% |

### 2.2 Throughput Targets

| Component | Target | Peak | Unit |
|---|---|---|---|
| API requests | 1,000 | 5,000 | req/s |
| Opportunities detected | 10,000 | 50,000 | /min |
| Trades executed | 100 | 500 | /min |
| WebSocket connections | 10,000 | 50,000 | concurrent |
| Database queries | 5,000 | 20,000 | /s |

### 2.3 Resource Utilization

| Resource | Idle | Normal | Peak | Limit |
|---|---|---|---|---|
| API CPU | 10% | 40% | 70% | 80% |
| API Memory | 256MB | 512MB | 768MB | 1Gi |
| Database CPU | 20% | 50% | 75% | 85% |
| Database Memory | 1GB | 2GB | 4GB | 8GB |
| Redis Memory | 128MB | 256MB | 512MB | 1Gi |

---

## 3. API Performance

### 3.1 Optimization Techniques

```typescript
// 1. Database connection pooling
export const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// 2. Response caching
@Cacheable({ ttl: 5 })
async getOpportunities(userId: string) {
  return this.persistence.getOpportunities(userId);
}

// 3. Query optimization
const opportunities = await supabase
  .from('opportunities')
  .select('id, pair, netProfitBps, riskScore')
  .eq('user_id', userId)
  .order('detected_at', { ascending: false })
  .limit(50)
  .throwOnError(); // Early error detection

// 4. Pagination
async getOpportunitiesPaginated(cursor: string, limit: number) {
  return supabase
    .from('opportunities')
    .select('*')
    .gt('id', cursor)
    .limit(limit);
}
```

### 3.2 Connection Limits

| Connection Type | Limit | Reason |
|---|---|---|
| PostgreSQL max | 100 | Connection pool exhaustion |
| Redis max | 50 | Memory pressure |
| External API | 50 per exchange | Rate limits |
| WebSocket | 50,000 | Server capacity |

---

## 4. Database Performance

### 4.1 Query Performance

```sql
-- Slow query log: >100ms
SET log_min_duration_statement = 100;

-- Query plan analysis
EXPLAIN ANALYZE
SELECT * FROM opportunities
WHERE user_id = 'xxx'
ORDER BY detected_at DESC
LIMIT 50;

-- Expected: Index Scan on idx_opportunities_user_timestamp
-- Duration: <10ms
```

### 4.2 Index Strategy

| Table | Index | Type | Purpose |
|---|---|---|---|
| opportunities | idx_user_timestamp | B-tree | User queries |
| opportunities | idx_pair | B-tree | Pair filtering |
| opportunities | idx_risk_score | B-tree | Risk filtering |
| trades | idx_user_created | B-tree | Trade history |
| audit_log | idx_timestamp | B-tree | Time-range queries |
| price_snapshots | idx_symbol_timestamp | B-tree | Latest prices |

### 4.3 Connection Pooling

```
Pool Configuration:
  max: 20 connections
  min: 5 connections
  idleTimeout: 30s
  acquireTimeout: 2s

Monitoring:
  active: 15/20
  idle: 5/20
  waiting: 0
```

---

## 5. Cache Performance

### 5.1 Redis Configuration

```yaml
# redis.conf
maxmemory: 1gb
maxmemory-policy: allkeys-lru
save: ""
appendonly: no

# Performance tuning
tcp-backlog: 511
timeout: 0
keepalive: 60
```

### 5.2 Cache Strategy

| Data | TTL | Hit Rate Target | Size |
|---|---|---|---|
| Market snapshots | 5s | 95% | 100MB |
| Opportunities | 30s | 90% | 50MB |
| User profiles | 1h | 99% | 10MB |
| Exchange metadata | 24h | 99% | 5MB |

### 5.3 Cache Metrics

```typescript
export const CACHE_METRICS = {
  hits: new promClient.Counter({
    name: 'cache_hits_total',
    labelNames: ['cache_key']
  }),
  misses: new promClient.Counter({
    name: 'cache_misses_total',
    labelNames: ['cache_key']
  }),
  latency: new promClient.Histogram({
    name: 'cache_latency_seconds',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1]
  })
};
```

---

## 6. Worker Performance

### 6.1 Detector Cycle

```
Target: <5s per cycle

Breakdown:
  - Fetch snapshots: 1-2s
  - Detect opportunities: 500ms
  - Score risk: 200ms
  - Persist: 100ms
  - Broadcast: 50ms
  - Slack: 2s
```

### 6.2 Worker Configuration

```typescript
export const WORKER_CONFIG = {
  detector: {
    concurrency: 10,
    rateLimit: 100, // requests/s
    timeout: 5000
  },
  alerts: {
    concurrency: 5,
    rateLimit: 50,
    timeout: 10000
  },
  executor: {
    concurrency: 3,
    rateLimit: 10,
    timeout: 30000
  }
};
```

---

## 7. WebSocket Performance

### 7.1 Connection Targets

| Metric | Target | Limit |
|---|---|---|
| Concurrent connections | 50,000 | 100,000 |
| Messages/second | 10,000 | 50,000 |
| Message size | <1KB | <5KB |
| Connection latency | <10ms | <50ms |

### 7.2 Optimization

```typescript
// Binary protocol for efficiency
const message = BinaryMessage.encode({
  type: 'opportunity',
  data: { id, pair, profit: 50.5 }
});

// Compression for large payloads
ws.compression = true;

// Ping/pong for connection health
setInterval(() => {
  ws.ping();
}, 30000);
```

---

## 8. Frontend Performance

### 8.1 Core Web Vitals

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP | <2.5s | 2.5-4s | >4s |
| FID | <100ms | 100-300ms | >300ms |
| CLS | <0.1 | 0.1-0.25 | >0.25 |
| INP | <200ms | 200-500ms | >500ms |

### 8.2 Optimization

```typescript
// 1. Code splitting
const OpportunityDetail = dynamic(() => import('./OpportunityDetail'));

// 2. Image optimization
<Image
  src={logo}
  alt="Logo"
  width={200}
  height={100}
  priority // Above fold
/>

// 3. Font optimization
const inter = Inter({ subsets: ['latin'], display: 'swap' });

// 4. Bundle analysis
export default withBundleAnalyzer({
  analyzerMode: 'static'
});
```

---

## 9. Load Testing

### 9.1 Load Test Scenarios

```javascript
// k6/load-test.js
export const scenarios = {
  normal: {
    executor: 'constant-vus',
    vus: 100,
    duration: '5m'
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 1000 },
      { duration: '1m', target: 1000 },
      { duration: '30s', target: 0 }
    ]
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 100,
    stages: [
      { duration: '2m', target: 500 },
      { duration: '5m', target: 500 },
      { duration: '2m', target: 0 }
    ]
  }
};
```

### 9.2 Performance Gates

| Test | Threshold | Action |
|---|---|---|
| Load test | p95 <200ms | Pass to staging |
| Stress test | 2x normal load | Autoscale verification |
| Soak test | 24h stable | Pass to production |
| Spike test | 5x load handled | Capacity planning |

---

## 10. Monitoring

### 10.1 Performance Dashboards

```json
{
  "dashboard": {
    "title": "Performance",
    "panels": [
      {
        "title": "API Latency (p95)",
        "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
      },
      {
        "title": "Throughput",
        "expr": "rate(http_requests_total[1m])"
      },
      {
        "title": "Error Rate",
        "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
      }
    ]
  }
}
```

### 10.2 Alerts

| Alert | Condition | Severity |
|---|---|---|
| High latency | p95 >200ms for 5m | Warning |
| Very high latency | p95 >500ms for 2m | Critical |
| Error spike | Error rate >5% for 5m | Critical |
| Throughput drop | Requests -50% for 5m | Warning |

---

## 11. Capacity Planning

### 11.1 Scaling Triggers

| Metric | Scale Up | Scale Down |
|---|---|---|
| CPU | >70% for 5m | <40% for 15m |
| Memory | >80% for 5m | <60% for 15m |
| Queue depth | >1000 for 2m | <100 for 10m |
| Connections | >80% for 5m | <50% for 15m |

### 11.2 Cost Projections

| Users | API Instances | Database | Monthly Cost |
|---|---|---|---|
| 1,000 | 2 | 1 | $500 |
| 10,000 | 5 | 2 | $2,000 |
| 100,000 | 15 | 4 | $10,000 |

---

## 12. Acceptance Criteria

- [ ] API p95 latency <200ms
- [ ] Detector cycle <5s
- [ ] 10k opportunities/minute throughput
- [ ] 50k WebSocket connections
- [ ] Database queries <100ms
- [ ] Cache hit rate >90%
- [ ] Load tests pass
- [ ] Auto-scaling functional

## Engineering Notes

- Profile before optimizing
- Monitor performance regressions
- Load test before deployment
- Capacity plan quarterly
- Review SLOs monthly