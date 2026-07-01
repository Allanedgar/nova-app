# ARBITRAGE-PRO Documentation

**Engineering Specification — Phased Build Plan**

This documentation is organized by development phase, matching the actual repository implementation at https://github.com/Allanedgar/arbitrage-pro.


> **📑 Master index:** [docs/INDEX.md](INDEX.md) — all 32 specs grouped by domain, with owning directors.

## Quick Navigation

### Phase-Based Documentation

- **[01_PROJECT_VISION.md](01_PROJECT_VISION.md)** — Mission, goals, and success metrics
- **[02_PHASED_ROADMAP.md](02_PHASED_ROADMAP.md)** — 8-phase build plan (20 weeks)
- **[03_ENGINEERING_PRINCIPLES.md](03_ENGINEERING_PRINCIPLES.md)** — Code quality and architecture rules

### Foundation (Phase 0)

- **[04_TECH_STACK.md](04_TECH_STACK.md)** — Technology choices and versions
- **[05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md)** — Package organization and boundaries
- **[06_DEPENDENCIES.md](06_DEPENDENCIES.md)** — Package management and versions

### Real Data (Phase 1)

- **[07_CONNECTOR_SPECIFICATION.md](07_CONNECTOR_SPECIFICATION.md)** — CEX, DEX, and bridge connectors
- **[08_MARKET_DATA_ENGINE.md](08_MARKET_DATA_ENGINE.md)** — Real-time data ingestion
- **[09_DISCOVERY_ENGINE.md](09_DISCOVERY_ENGINE.md)** — Dynamic asset discovery

### Detection (Phase 2)

- **[10_ARBITRAGE_ENGINE.md](10_ARBITRAGE_ENGINE.md)** — Opportunity detection algorithms
- **[11_RISK_ENGINE.md](11_RISK_ENGINE.md)** — Risk scoring and profitability models
- **[12_ASSET_NORMALIZATION.md](12_ASSET_NORMALIZATION.md)** — Asset identity and symbol resolution

### Auth & Multi-Tenancy (Phase 3)

- **[13_SECURITY_ARCHITECTURE.md](13_SECURITY_ARCHITECTURE.md)** — Authentication, RLS, authorization
- **[14_DATABASE_SCHEMA.md](14_DATABASE_SCHEMA.md)** — Supabase migrations and tables

### Web Dashboard (Phase 4)

- **[15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md)** — Next.js dashboard
- **[16_API_SPECIFICATION.md](16_API_SPECIFICATION.md)** — REST, WebSocket, GraphQL APIs
- **[17_BACKEND_SPECIFICATION.md](17_BACKEND_SPECIFICATION.md)** — NestJS backend architecture

### Mobile (Phase 5)

- **[18_MOBILE_SPECIFICATION.md](18_MOBILE_SPECIFICATION.md)** — Expo React Native app
- **[19_PUSH_NOTIFICATIONS.md](19_PUSH_NOTIFICATIONS.md)** — Push notification architecture
- **[20_BIOMETRIC_SECURITY.md](20_BIOMETRIC_SECURITY.md)** — Biometric authentication

### Execution (Phase 6)

- **[21_EXECUTION_ENGINE.md](21_EXECUTION_ENGINE.md)** — 3-tier execution (manual → simulated → automated)
- **[22_GUARDRAILS.md](22_GUARDRAILS.md)** — Risk limits and circuit breakers
- **[23_AUDIT_LOGGING.md](23_AUDIT_LOGGING.md)** — Trade audit and compliance

### DEX & Bridges (Phase 7)

- **[24_DEX_CONNECTORS.md](24_DEX_CONNECTORS.md)** — Uniswap, PancakeSwap, Curve, 1inch
- **[25_BRIDGE_AGGREGATOR.md](25_BRIDGE_AGGREGATOR.md)** — Cross-chain bridge routing
- **[26_CROSS_CHAIN_ENGINE.md](26_CROSS_CHAIN_ENGINE.md)** — Cross-chain arbitrage detection

### Production (Phase 8)

- **[27_TESTING_STRATEGY.md](27_TESTING_STRATEGY.md)** — Unit, integration, E2E, chaos tests
- **[28_OBSERVABILITY.md](28_OBSERVABILITY.md)** — Monitoring, logging, metrics
- **[29_DEPLOYMENT.md](29_DEPLOYMENT.md)** — Docker, Kubernetes, CI/CD
- **[30_PERFORMANCE_TARGETS.md](30_PERFORMANCE_TARGETS.md)** — SLOs and performance budgets

### Supporting Documents

- **[31_GLOSSARY.md](31_GLOSSARY.md)** — Terminology and definitions
- **[32_APPENDIX.md](32_APPENDIX.md)** — Additional resources and references

## Document Purposes

Each document includes:
- **Purpose** — What this document covers
- **Cross-References** — Related documents
- **Contents** — Detailed specifications
- **Mermaid Diagrams** — Visual architecture and flows
- **Tables** — Structured data (connectors, APIs, schemas)
- **Examples** — Code samples and implementations
- **Acceptance Criteria** — Checklist for completion
- **Engineering Notes** — Implementation guidance
- **Future Work** — Planned enhancements

## How to Use This Documentation

1. **For implementers:** Start with Phase-based docs (01-30) in order
2. **For architects:** Read PROJECT_VISION, ENGINEERING_PRINCIPLES, and SYSTEM_ARCHITECTURE first
3. **For contributors:** Check CONTRIBUTING.md and AI_CONTRIBUTION_GUIDE.md
4. **For operators:** Jump to OBSERVABILITY, DEPLOYMENT, and PERFORMANCE_TARGETS

## Repository Structure

```
arbitrage-pro/
├── apps/
│   ├── api/          NestJS backend (port 4000)
│   ├── web/          Next.js dashboard (port 3000)
│   └── mobile/       Expo React Native app
├── packages/
│   ├── shared/       TypeScript type contracts
│   ├── engine/       Arbitrage detection algorithms
│   ├── connectors/   CEX, DEX, bridge connectors
│   ├── persistence/  Supabase writer/reader
│   ├── cache/        Redis sliding window
│   ├── risk/         5-factor risk scorer
│   ├── alerts/       Threshold evaluator + dispatcher
│   └── execution/    3-tier executor
├── supabase/
│   └── migrations/   Database schema
└── docs/             This documentation
```

## Version

- **Document Version:** 2.0 (Phase-aligned)
- **Last Updated:** 2026-07-01
- **Status:** Production-ready specification
- **Repository:** https://github.com/Allanedgar/arbitrage-pro