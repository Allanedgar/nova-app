# ARBITRAGE-PRO

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)

**Institutional-grade Crypto Arbitrage Platform**

[Documentation](docs/01_PROJECT_VISION.md) • [API Reference](docs/15_API_SPECIFICATION.md) • [Contributing](CONTRIBUTING.md)

---

## Overview

ARBITRAGE-PRO is a production-ready, open-source crypto arbitrage platform designed for institutional traders. It detects and executes arbitrage opportunities across 60+ exchanges (CEX, DEX, and bridges) with sub-second latency.

### Supported Arbitrage Types

- **CEX ↔ CEX** — Price differences between centralized exchanges
- **CEX ↔ DEX** — Centralized vs decentralized exchange arbitrage
- **DEX ↔ DEX** — Cross-DEX price discrepancies
- **Cross-Chain** — Same asset across different blockchains
- **Bridge Arbitrage** — Exploiting bridge fee differentials

### Coming Soon

- Triangular arbitrage
- Perpetual funding arbitrage
- Statistical arbitrage
- ML-based opportunity ranking

---

## Architecture

```
┌─────────────┐
│   Clients   │ (Web, Mobile, API)
└──────┬──────┘
       │
┌──────▼──────────────────────────────────┐
│         API Gateway (Hono)              │
└──────┬──────────────────────────────────┘
       │
   ┌───┴────┐
   │  Services │ (Microservices)
   └───┬────┘
       │
┌──────▼──────────────────────────────────┐
│   60+ Connectors (CEX, DEX, Bridges)    │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│   PostgreSQL + Redis                    │
└─────────────────────────────────────────┘
```

**Key Features:**
- Microservices architecture with 10 independent services
- Real-time market data from 60+ venues
- Sub-500ms opportunity detection
- Institutional-grade risk scoring (8 dimensions)
- Immutable audit logging with HMAC chains
- Multi-factor authentication & RBAC
- Kubernetes-native deployment
- Comprehensive observability (Prometheus, Grafana, OpenTelemetry)

---

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- pnpm 8+

### Installation

```bash
# Clone repository
git clone https://github.com/arbitrage-pro/core.git
cd core

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:migrate

# Start development environment
pnpm dev
```

### Docker

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps
```

---

## Documentation

> **📑 Master index:** [docs/INDEX.md](docs/INDEX.md) — all 32 specs grouped by domain, with owning directors. Use this as the entry point.

### Index

- **[Documentation Master Index](docs/INDEX.md)** — single-page navigation of every spec, by domain and owning director.
- **[Phase-based Docs](docs/README.md)** — specs organized by build phase (the order the team works in).


### Core Specifications

| Document | Purpose |
|---|---|
| [01_PROJECT_VISION.md](docs/01_PROJECT_VISION.md) | Mission, goals, and vision |
| [02_ENGINEERING_PRINCIPLES.md](docs/02_ENGINEERING_PRINCIPLES.md) | Engineering standards and practices |
| [03_SYSTEM_ARCHITECTURE.md](docs/03_SYSTEM_ARCHITECTURE.md) | High-level system design |
| [04_MONOREPO_STRUCTURE.md](docs/04_MONOREPO_STRUCTURE.md) | Repository organization |
| [05_TECH_STACK.md](docs/05_TECH_STACK.md) | Technology choices |
| [06_DEPENDENCIES.md](docs/06_DEPENDENCIES.md) | Package dependencies |

### Engine Specifications

| Document | Purpose |
|---|---|
| [07_CONNECTOR_SPECIFICATION.md](docs/07_CONNECTOR_SPECIFICATION.md) | Connector interface and standards |
| [08_DISCOVERY_ENGINE.md](docs/08_DISCOVERY_ENGINE.md) | Dynamic asset/pair discovery |
| [09_MARKET_DATA_ENGINE.md](docs/09_MARKET_DATA_ENGINE.md) | Market data ingestion & distribution |
| [10_ASSET_NORMALIZATION.md](docs/10_ASSET_NORMALIZATION.md) | Canonical asset identity |
| [11_ARBITRAGE_ENGINE.md](docs/11_ARBITRAGE_ENGINE.md) | Opportunity detection & scoring |
| [12_RISK_ENGINE.md](docs/12_RISK_ENGINE.md) | Multi-dimensional risk scoring |
| [13_EXECUTION_ENGINE.md](docs/13_EXECUTION_ENGINE.md) | Order lifecycle management |

### Infrastructure Specifications

| Document | Purpose |
|---|---|
| [14_DATABASE_SCHEMA.md](docs/14_DATABASE_SCHEMA.md) | PostgreSQL schema and migrations |
| [15_API_SPECIFICATION.md](docs/15_API_SPECIFICATION.md) | REST, WebSocket, GraphQL APIs |
| [16_BACKEND_SPECIFICATION.md](docs/16_BACKEND_SPECIFICATION.md) | Microservices architecture |
| [19_SECURITY_ARCHITECTURE.md](docs/19_SECURITY_ARCHITECTURE.md) | Security layers and controls |
| [20_OBSERVABILITY.md](docs/20_OBSERVABILITY.md) | Metrics, logs, traces, alerts |
| [21_TESTING_STRATEGY.md](docs/21_TESTING_STRATEGY.md) | Unit, integration, load, chaos tests |
| [22_DEPLOYMENT.md](docs/22_DEPLOYMENT.md) | Kubernetes deployment guide |
| [23_AI_CONTRIBUTION_GUIDE.md](docs/23_AI_CONTRIBUTION_GUIDE.md) | Guidelines for AI contributors |
| [24_VERIFICATION_CHECKLIST.md](docs/24_VERIFICATION_CHECKLIST.md) | Pre-deployment checklist |
| [25_PERFORMANCE_TARGETS.md](docs/25_PERFORMANCE_TARGETS.md) | SLOs and performance targets |
| [26_PROJECT_ROADMAP.md](docs/26_PROJECT_ROADMAP.md) | Development phases and milestones |
| [27_GLOSSARY.md](docs/27_GLOSSARY.md) | Terminology and definitions |
| [28_APPENDIX.md](docs/28_APPENDIX.md) | References and appendices |

---

## Project Structure

```
ARBITRAGE-PRO/
├── README.md                  # This file
├── SOUL.md                    # Project identity and values
├── CONTRIBUTING.md            # Contribution guidelines
├── SECURITY.md                # Security policy
├── LICENSE.md                 # MIT License
├── CODE_OF_CONDUCT.md         # Community standards
├── CHANGELOG.md               # Version history
│
├── docs/                      # Engineering specifications
│   ├── 01_PROJECT_VISION.md
│   ├── 02_ENGINEERING_PRINCIPLES.md
│   ├── 03_SYSTEM_ARCHITECTURE.md
│   ├── ... (26 specification documents)
│   ├── 28_APPENDIX.md
│   └── diagrams/
│       ├── architecture.mmd
│       ├── dataflow.mmd
│       └── execution.mmd
│
├── packages/                  # Shared packages
│   ├── core/                  # Core types and interfaces
│   ├── database/              # Database client and migrations
│   ├── api/                   # API framework and middleware
│   ├── connectors/            # Connector base classes
│   └── config/                # Configuration management
│
├── services/                  # Microservices
│   ├── auth-service/
│   ├── discovery-service/
│   ├── market-data-service/
│   ├── arbitrage-service/
│   ├── risk-service/
│   ├── execution-service/
│   ├── notification-service/
│   ├── audit-service/
│   └── config-service/
│
├── connectors/                # Venue connectors
│   ├── cex/                   # CEX connectors (20)
│   ├── dex/                   # DEX connectors (20)
│   └── bridges/               # Bridge connectors (20)
│
├── tools/                     # Development tools
│   ├── codegen/               # Code generation
│   ├── testing/               # Test utilities
│   └── deployment/            # Deployment scripts
│
├── helm/                      # Kubernetes Helm charts
├── docker/                    # Docker configurations
├── .github/                   # GitHub Actions workflows
└── tests/                     # Integration and E2E tests
```

---

## Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 22 | Backend services |
| Language | TypeScript 5.3 | Type-safe development |
| Framework | Hono 4 | Web framework |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | Caching, pub/sub, streams |
| ORM | Drizzle | Database access |
| gRPC | @grpc/grpc-js | Inter-service communication |
| Auth | JWT + MFA | Authentication |
| Observability | Prometheus, Grafana, OpenTelemetry | Monitoring |
| Testing | Vitest, Playwright | Unit and E2E tests |
| Deployment | Kubernetes, Helm | Container orchestration |
| CI/CD | GitHub Actions | Automation |

---

## Key Features

### Discovery Engine
- Dynamic asset discovery without hardcoding
- Automatic new listing detection
- Status monitoring (trading, deposits, withdrawals)
- Incremental updates with caching

### Market Data Engine
- WebSocket + REST dual ingestion
- Official APIs and SDKs only
- Real-time normalization across venues
- Order book and ticker distribution

### Arbitrage Engine
- Multi-type detection (CEX-CEX, CEX-DEX, cross-chain)
- 15-stage opportunity pipeline
- Expected value calculation
- Confidence scoring

### Risk Engine
- 8-dimensional risk scoring:
  - Liquidity depth
  - Volatility
  - Exchange reliability
  - MEV exposure
  - Smart contract risk
  - Bridge reliability
  - Gas costs
  - Historical failure rate

### Execution Engine
- Manual, simulation, and automated modes
- Circuit breakers and retries
- Kill switch for emergency stops
- Immutable audit logging

---

## Performance Targets

| Metric | Target |
|---|---|
| REST API latency (p95) | <100ms |
| Opportunity detection | <500ms |
| Order execution | <200ms |
| WebSocket delivery | <10ms |
| Throughput | 1,000 RPS |
| Uptime | 99.95% |

---

## Security

- **Authentication**: JWT + MFA (TOTP)
- **Authorization**: RBAC with 5 roles
- **Encryption**: AES-256-GCM at rest, TLS 1.3 in transit
- **Audit**: Immutable HMAC-chained logs
- **Secrets**: HashiCorp Vault integration
- **Network**: Kubernetes NetworkPolicies, mTLS

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**For AI contributors**: See [23_AI_CONTRIBUTION_GUIDE.md](docs/23_AI_CONTRIBUTION_GUIDE.md) for strict requirements.

---

## Roadmap

### v0.1 (Current) — Foundation
- 20 CEX connectors
- Core arbitrage detection
- REST API

### v0.2 (Month 6) — DEX Integration
- 20 DEX connectors
- WebSocket API
- Frontend dashboard

### v0.3 (Month 9) — Execution
- Bridge connectors
- Cross-chain arbitrage
- Mobile app

### v1.0 (Month 18) — Production
- Advanced risk scoring
- ML-based ranking
- Open source launch

See [26_PROJECT_ROADMAP.md](docs/26_PROJECT_ROADMAP.md) for details.

---

## License

MIT License — see [LICENSE.md](LICENSE.md) for details.

---

## Contact

- **GitHub**: [@arbitrage-pro](https://github.com/arbitrage-pro)
- **Discord**: [discord.gg/arbitrage-pro](https://discord.gg/arbitrage-pro)
- **Email**: maintainers@arbitrage-pro.com
- **Issues**: [GitHub Issues](https://github.com/arbitrage-pro/core/issues)

---

## Acknowledgments

Built with:
- [Hono](https://hono.dev/) — Web framework
- [Drizzle ORM](https://orm.drizzle.team/) — Database
- [PostgreSQL](https://www.postgresql.org/) — Database
- [Redis](https://redis.io/) — Cache and messaging
- [OpenTelemetry](https://opentelemetry.io/) — Observability
- All our [contributors](https://github.com/arbitrage-pro/core/graphs/contributors)

---

**⚠️ Disclaimer**: This software is for educational and research purposes. Trading cryptocurrencies involves significant risk. Use at your own risk. The authors are not responsible for financial losses.