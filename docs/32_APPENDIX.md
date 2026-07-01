**See also:** [31_GLOSSARY.md](31_GLOSSARY.md), [29_DEPLOYMENT.md](29_DEPLOYMENT.md), [27_TESTING_STRATEGY.md](27_TESTING_STRATEGY.md)
# Appendix

**Document:** Reference
**Cross-References:** All documents

---

## 1. Document Index

| # | Document | Purpose |
|---|---|---|
| 01 | PROJECT_VISION.md | Mission, goals, success criteria |
| 02 | ENGINEERING_PRINCIPLES.md | Design principles, best practices |
| 03 | SYSTEM_ARCHITECTURE.md | High-level system design |
| 04 | MONOREPO_STRUCTURE.md | Repository organization |
| 05 | TECH_STACK.md | Technology choices |
| 06 | DEPENDENCIES.md | Package management |
| 07 | CONNECTOR_SPECIFICATION.md | Exchange connector interface |
| 08 | MARKET_DATA_ENGINE.md | Real-time data pipeline |
| 09 | DISCOVERY_ENGINE.md | Dynamic asset discovery |
| 10 | ARBITRAGE_ENGINE.md | Opportunity detection |
| 11 | RISK_ENGINE.md | Risk scoring |
| 12 | ASSET_NORMALIZATION.md | Asset identifier standardization |
| 13 | SECURITY_ARCHITECTURE.md | Security controls |
| 14 | DATABASE_SCHEMA.md | PostgreSQL + Supabase |
| 15 | FRONTEND_SPECIFICATION.md | Next.js web dashboard |
| 16 | API_SPECIFICATION.md | REST + WebSocket API |
| 17 | BACKEND_SPECIFICATION.md | NestJS backend |
| 18 | MOBILE_SPECIFICATION.md | Expo React Native |
| 19 | PUSH_NOTIFICATIONS.md | Mobile notifications |
| 20 | BIOMETRIC_SECURITY.md | Mobile biometric auth |
| 21 | EXECUTION_ENGINE.md | Trade execution |
| 22 | GUARDRAILS.md | Safety mechanisms |
| 23 | AUDIT_LOGGING.md | Immutable audit trail |
| 24 | DEX_CONNECTORS.md | DEX integrations |
| 25 | BRIDGE_AGGREGATOR.md | Cross-chain bridges |
| 26 | CROSS_CHAIN_ENGINE.md | Cross-chain arbitrage |
| 27 | TESTING_STRATEGY.md | Testing pyramid |
| 28 | OBSERVABILITY.md | Monitoring stack |
| 29 | DEPLOYMENT.md | Kubernetes deployment |
| 30 | PERFORMANCE_TARGETS.md | SLOs and capacity |
| 31 | GLOSSARY.md | Terms and acronyms |
| 32 | APPENDIX.md | This document |

---

## 2. Quick Reference

### 2.1 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/arbitrage
REDIS_URL=redis://host:6379

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Exchanges
BINANCE_API_KEY=xxx
BINANCE_SECRET=xxx
OKX_API_KEY=xxx
OKX_SECRET=xxx

# Bridges
STARGATE_API_KEY=xxx
WORMHOLE_API_KEY=xxx

# Observability
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
PAGERDUTY_KEY=xxx
SLACK_WEBHOOK=xxx
```

### 2.2 CLI Commands

```bash
# Development
pnpm dev                  # Start all services
pnpm dev:api             # Start API only
pnpm dev:web             # Start web only
pnpm dev:mobile          # Start mobile only

# Testing
pnpm test                # Run all tests
pnpm test:unit           # Unit tests only
pnpm test:integration    # Integration tests
pnpm test:e2e            # E2E tests
pnpm test:coverage       # With coverage report

# Building
pnpm build               # Build all packages
pnpm build:packages      # Build packages only
pnpm docker:build        # Build Docker images

# Database
pnpm db:migrate          # Run migrations
pnpm db:seed             # Seed database
pnpm db:reset            # Reset database

# Deployment
helm upgrade --install api ./helm/arbitrage-pro
kubectl apply -f kubernetes/
```

### 2.3 Ports

| Service | Port | Protocol | Purpose |
|---|---|---|---|
| API | 4000 | HTTP | REST + WebSocket |
| Web | 3000 | HTTP | Next.js frontend |
| Postgres | 5432 | TCP | Database |
| Redis | 6379 | TCP | Cache |
| Prometheus | 9090 | HTTP | Metrics |
| Grafana | 3001 | HTTP | Dashboards |
| Jaeger | 16686 | HTTP | Traces |

---

## 3. Architecture Diagrams

### 3.1 System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Dashboard]
        Mobile[Mobile App]
        API_Clients[API Clients]
    end
    
    subgraph "API Layer"
        Gateway[API Gateway]
        Auth[Auth Service]
        RateLimit[Rate Limiter]
    end
    
    subgraph "Application Layer"
        Market[Market Service]
        Arbitrage[Arbitrage Engine]
        Risk[Risk Engine]
        Execution[Execution Engine]
        Alerts[Alert Service]
    end
    
    subgraph "Data Layer"
        Postgres[(PostgreSQL)]
        Redis[(Redis)]
        Snapshots[Price Snapshots]
    end
    
    subgraph "External"
        CEXs[CEX Connectors]
        DEXs[DEX Connectors]
        Bridges[Bridge Aggregator]
    end
    
    Web --> Gateway
    Mobile --> Gateway
    API_Clients --> Gateway
    
    Gateway --> Auth
    Gateway --> RateLimit
    Gateway --> Market
    
    Market --> Arbitrage
    Arbitrage --> Risk
    Risk --> Execution
    Execution --> Alerts
    
    Market --> Snapshots
    Snapshots --> Postgres
    Snapshots --> Redis
    
    Market --> CEXs
    Market --> DEXs
    Execution --> Bridges
```

### 3.2 Data Flow

```mermaid
flowchart LR
    A[CEX/DEX APIs] --> B[Connector Layer]
    B --> C[Discovery Engine]
    C --> D[Market Data]
    
    D --> E[Arbitrage Engine]
    E --> F[Risk Engine]
    F --> G{Pass?}
    
    G -->|No| H[Discard]
    G -->|Yes| I[Opportunity DB]
    
    I --> J[Alert Service]
    I --> K[Execution Engine]
    
    K --> L{Guardrails}
    L -->|Block| M[Log]
    L -->|Pass| N[Trade]
    
    N --> O[Audit Log]
    J --> O
    M --> O
```

### 3.3 Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Guardrails
    participant Safety
    participant Exchange
    participant DB
    
    User->>API: Execute Opportunity
    API->>DB: Get Opportunity
    DB-->>API: Opportunity Data
    
    API->>Guardrails: Check Guardrails
    Guardrails-->>API: Pass/Fail
    
    alt Guardrails Pass
        API->>Safety: Safety Check
        Safety-->>API: Approved
        
        API->>Exchange: Place Buy Order
        Exchange-->>API: Order Filled
        
        API->>Exchange: Place Sell Order
        Exchange-->>API: Order Filled
        
        API->>DB: Record Trade
        DB-->>API: Trade Saved
        
        API-->>User: Success
    else Guardrails Fail
        API->>DB: Log Block
        API-->>User: Blocked
    end
```

---

## 4. Decision Records

### 4.1 Architecture Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| NestJS for backend | Type-safe, DI, modular | Express, Fastify |
| Supabase for DB | Managed Postgres + auth | RDS, CockroachDB |
| Redis for cache | Fast, simple | Memcached, DynamoDB |
| Next.js for web | SSR, App Router | Remix, Gatsby |
| Expo for mobile | Cross-platform, simple CI | Flutter, React Native CLI |
| BullMQ for workers | Reliable, feature-rich | Agenda, Sidekiq |
| Prometheus for metrics | Open standard | Datadog, New Relic |

---

## 5. Future Work

### 5.1 Phase 9+ Features

- Triangular arbitrage (3-leg)
- Perpetual funding arbitrage
- Statistical arbitrage (ML-based)
- NFT arbitrage
- Options arbitrage
- Liquidation hunting
- MEV extraction
- Flash loan arbitrage

### 5.2 Infrastructure Improvements

- Multi-region deployment
- Disaster recovery
- Advanced rate limiting
- Connection pooling optimization
- Read replicas
- Database sharding

### 5.3 Platform Enhancements

- White-label solution
- API marketplace
- Strategy marketplace
- Social trading
- Portfolio management
- Tax reporting

---

## 6. Compliance Considerations

### 6.1 Regulatory Frameworks

| Jurisdiction | Regulation | Status |
|---|---|---|
| USA | SEC, CFTC | Monitor |
| EU | MiCA | Implement |
| UK | FCA | Monitor |
| Singapore | MAS | Monitor |

### 6.2 Data Protection

- GDPR compliance (EU users)
- Data residency requirements
- Right to deletion
- Audit log retention
- Privacy by design

---

## 7. Support

### 7.1 Resources

- **Documentation:** https://docs.arbitrage-pro.com
- **GitHub:** https://github.com/arbitrage-pro/arbitrage-pro
- **Discord:** https://discord.gg/arbitrage-pro
- **Email:** support@arbitrage-pro.com

### 7.2 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

### 7.3 License

See [LICENSE.md](../LICENSE.md) for license information.

---

## 8. Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-07-01 | Initial release |

---

*Last updated: 2026-07-01*