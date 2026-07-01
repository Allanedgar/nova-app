**See also:** [17_BACKEND_SPECIFICATION.md](17_BACKEND_SPECIFICATION.md), [15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md), [14_DATABASE_SCHEMA.md](14_DATABASE_SCHEMA.md)
# API Specification

**Document:** Phase 4 — Web Dashboard v2
**Cross-References:** [15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md), [17_BACKEND_SPECIFICATION.md](17_BACKEND_SPECIFICATION.md)

---

## 1. Overview

REST and WebSocket API for ARBITRAGE-PRO. All endpoints require authentication unless noted. Returns JSON.

**Base URL:** `https://api.arbitrage-pro.com`
**WebSocket:** `wss://api.arbitrage-pro.com`
**Authentication:** Bearer JWT (Supabase Auth)

---

## 2. REST Endpoints

### 2.1 Opportunities

#### GET /opportunities

List opportunities for authenticated user.

**Response:**
```json
{
  "opportunities": [
    {
      "id": "uuid",
      "type": "spatial",
      "pair": "BTC/USDT",
      "sourceExchange": "coinbase",
      "targetExchange": "binance",
      "buyPrice": 59950.00,
      "sellPrice": 60000.00,
      "grossProfitBps": 83.4,
      "netProfitBps": 61.4,
      "liquidityUsd": 5000.00,
      "riskScore": 75.5,
      "confidenceScore": 0.85,
      "detectedAt": "2026-07-01T12:00:00Z",
      "expiresAt": "2026-07-01T12:00:30Z"
    }
  ]
}
```

#### GET /opportunities/:id

Get opportunity detail.

**Response:**
```json
{
  "id": "uuid",
  "type": "spatial",
  "pair": "BTC/USDT",
  "sourceExchange": "coinbase",
  "targetExchange": "binance",
  "buyPrice": 59950.00,
  "sellPrice": 60000.00,
  "grossProfitBps": 83.4,
  "feesBps": 22.0,
  "netProfitBps": 61.4,
  "liquidityUsd": 5000.00,
  "riskScore": 75.5,
  "confidenceScore": 0.85,
  "riskBreakdown": {
    "reliability": 85.0,
    "volume": 70.0,
    "age": 95.0,
    "spread": 80.0,
    "liquidity": 65.0
  },
  "detectedAt": "2026-07-01T12:00:00Z",
  "expiresAt": "2026-07-01T12:00:30Z"
}
```

### 2.2 Alerts

#### GET /alerts

List alert rules for authenticated user.

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "name": "BTC Profit Alert",
      "pair": "BTC/USDT",
      "minProfitBps": 100,
      "enabled": true,
      "createdAt": "2026-07-01T12:00:00Z"
    }
  ]
}
```

#### POST /alerts

Create alert rule.

**Request:**
```json
{
  "name": "BTC Profit Alert",
  "pair": "BTC/USDT",
  "minProfitBps": 100,
  "channels": ["push", "email"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "BTC Profit Alert",
  "pair": "BTC/USDT",
  "minProfitBps": 100,
  "enabled": true,
  "createdAt": "2026-07-01T12:00:00Z"
}
```

### 2.3 Execution

#### POST /execute/:opportunityId

Execute arbitrage opportunity.

**Request:**
```json
{
  "notionalUsd": 1000.00,
  "type": "manual"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "submitted",
  "type": "manual",
  "notionalUsd": 1000.00,
  "feesUsd": 1.75,
  "executedAt": "2026-07-01T12:01:00Z"
}
```

### 2.4 Markets

#### GET /markets/snapshots

Get latest market snapshots.

**Response:**
```json
{
  "snapshots": [
    {
      "symbol": "BTC/USDT",
      "bid": 60000.00,
      "ask": 60010.00,
      "timestamp": "2026-07-01T12:00:00Z",
      "exchange": {
        "code": "binance",
        "name": "Binance",
        "rateLimit": 50
      }
    }
  ]
}
```

#### GET /markets/health

Get connector health.

**Response:**
```json
{
  "connectors": {
    "binance": {
      "status": "active",
      "latencyMs": 45,
      "uptime24h": 99.99
    },
    "okx": {
      "status": "active",
      "latencyMs": 62,
      "uptime24h": 99.95
    }
  }
}
```

### 2.5 Auth

#### POST /auth/login

Login with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

#### POST /auth/oauth/google

Initiate Google OAuth flow.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### 2.6 Health

#### GET /health

Health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-07-01T12:00:00Z",
  "version": "1.0.0"
}
```

#### GET /health/detailed

Detailed health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-07-01T12:00:00Z",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 5 },
    "redis": { "status": "healthy", "latencyMs": 2 },
    "connectors": { "status": "degraded", "active": 4, "total": 5 }
  }
}
```

---

## 3. WebSocket Events

### 3.1 Connection

```javascript
const ws = new WebSocket('wss://api.arbitrage-pro.com');
ws.onopen = () => {
  // Send auth message
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'eyJ...'
  }));
};
```

### 3.2 Subscribe to Opportunities

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'opportunities'
}));
```

**Event: opportunity**

```json
{
  "type": "opportunity",
  "data": {
    "id": "uuid",
    "pair": "BTC/USDT",
    "netProfitBps": 61.4,
    "riskScore": 75.5,
    "detectedAt": "2026-07-01T12:00:00Z"
  }
}
```

### 3.3 Subscribe to Markets

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'markets:binance:BTC/USDT'
}));
```

**Event: market_update**

```json
{
  "type": "market_update",
  "data": {
    "symbol": "BTC/USDT",
    "bid": 60000.00,
    "ask": 60010.00,
    "timestamp": "2026-07-01T12:00:00Z",
    "exchange": "binance"
  }
}
```

### 3.4 Subscribe to Alerts

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'alerts'
}));
```

**Event: alert_fired**

```json
{
  "type": "alert_fired",
  "data": {
    "id": "uuid",
    "name": "BTC Profit Alert",
    "opportunity": { /* opportunity */ }
  }
}
```

---

## 4. GraphQL Subscriptions

### 4.1 Opportunities Subscription

```graphql
subscription GetOpportunities($userId: UUID!) {
  opportunities: opportunities_stream(
    where: { user_id: { eq: $userId } }
  ) {
    id
    type
    pair
    sourceExchange
    targetExchange
    netProfitBps
    riskScore
    detectedAt
  }
}
```

### 4.2 Markets Subscription

```graphql
subscription GetMarkets($symbol: String!) {
  priceSnapshots: snapshots_stream(
    where: { symbol: { eq: $symbol } }
  ) {
    bid
    ask
    timestamp
    exchangeCode
  }
}
```

### 4.3 Alerts Subscription

```graphql
subscription GetAlerts($userId: UUID!) {
  alertFires: alerts_stream(
    where: { user_id: { eq: $userId } }
  ) {
    id
    name
    opportunityId
    firedAt
  }
}
```

---

## 5. OpenAPI Schema

### 5.1 Info

```yaml
openapi: 3.0.0
info:
  title: ARBITRAGE-PRO API
  description: Crypto arbitrage platform API
  version: 1.0.0
  contact:
    name: API Support
    email: support@arbitrage-pro.com
```

### 5.2 Servers

```yaml
servers:
  - url: https://api.arbitrage-pro.com
    description: Production
```

### 5.3 Security

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## 6. Error Responses

### 6.1 Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2026-07-01T12:00:00Z",
    "requestId": "uuid"
  }
}
```

### 6.2 Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Connector down |

---

## 7. Rate Limits

### 7.1 Global Limits

| Endpoint | Limit | Window |
|---|---|---|
| All endpoints | 100 requests | 1 minute |
| POST /execute | 10 requests | 1 minute |

### 7.2 Authenticated Limits

| User Tier | Limit | Window |
|---|---|---|
| Free | 100 | 1 minute |
| Premium | 500 | 1 minute |
| Admin | 1000 | 1 minute |

---

## 8. Pagination

### 8.1 Cursor-Based Pagination

```
GET /opportunities?cursor=eyJpZCI6MTIzNX0&limit=20
```

**Response:**
```json
{
  "opportunities": [ /* 20 items */ ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTQ1Mn0"
  }
}
```

### 8.2 Offset Pagination (Legacy)

```
GET /opportunities?offset=0&limit=20
```

---

## 9. Filtering & Sorting

### 9.1 Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `pair` | string | Filter by pair |
| `type` | string | Filter by type (spatial, triangular, cross-chain) |
| `minProfitBps` | number | Minimum profit |
| `maxRiskScore` | number | Maximum risk |
| `sort` | string | Sort field |
| `order` | string | asc/desc |
| `limit` | number | Results per page |
| `cursor` | string | Pagination cursor |

### 9.2 Examples

```
GET /opportunities?pair=BTC/USDT&minProfitBps=50&sort=detectedAt&order=desc
GET /opportunities?type=spatial&maxRiskScore=60
```

---

## 10. Testing

### 10.1 Unit Tests

```typescript
describe('Opportunities API', () => {
  it('returns opportunities for authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/opportunities')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.opportunities).toBeInstanceOf(Array);
  });
});
```

### 10.2 Integration Tests

```typescript
describe('WebSocket Streaming', () => {
  it('streams opportunities in real-time', async () => {
    const ws = new WebSocket('wss://api.arbitrage-pro.com');
    await new Promise(resolve => ws.onopen = resolve);
    
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'opportunities',
      token: userToken
    }));
    
    const messages: any[] = [];
    ws.onmessage = (event) => {
      messages.push(JSON.parse(event.data));
      if (messages.length >= 5) ws.close();
    };
    
    await new Promise(resolve => ws.onclose = resolve);
    expect(messages.length).toBeGreaterThanOrEqual(5);
  });
});
```

---

## 11. Acceptance Criteria

- [ ] All endpoints documented in OpenAPI
- [ ] REST and WebSocket functional
- [ ] Authentication enforced
- [ ] Rate limiting works
- [ ] Error responses standardized
- [ ] Pagination implemented
- [ ] Filtering and sorting work
- [ ] WebSocket reconnection logic
- [ ] Tests pass (80% coverage)

## Engineering Notes

- All timestamps in ISO 8601 UTC
- JWT expiry: 1 hour, refresh: 7 days
- WebSocket: Auto-reconnect with exponential backoff
- Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining