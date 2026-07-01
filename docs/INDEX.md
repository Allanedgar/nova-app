# Documentation Master Index

> **Master navigation for the engineering blueprint.**
> All 32 numbered specifications, grouped by domain, with purpose and owning director.
> Maintained by @sage (Documentation Director).

**How to use this index**

- **For AI agents and new contributors:** start here. Pick the spec closest to your task, then follow the `See also` links at the top of each spec.
- **For directors:** each row names the organizational owner. Coordinate cross-domain work through Hermes.
- **For phase planning:** specs roughly follow the 8-phase roadmap in `02_PHASED_ROADMAP.md`.

**Supporting documents**

- [`SOUL.md`](../SOUL.md) — project identity and values
- [`README.md`](../README.md) — top-level project README
- [`docs/README.md`](README.md) — phase-organized docs landing page
- [`docs/diagrams/`](diagrams/) — architecture, dataflow, and execution diagrams (Mermaid)

## Core

| Spec | Purpose | Owning Director |
|---|---|---|
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Mission, goals, success metrics, and product vision | Atlas (Chief Software Architect) |
| [02_PHASED_ROADMAP.md](02_PHASED_ROADMAP.md) | 8-phase build plan (20 weeks) to production | PulsePM (Product Director) |
| [03_ENGINEERING_PRINCIPLES.md](03_ENGINEERING_PRINCIPLES.md) | Code quality, architecture, and engineering standards | Atlas (Chief Software Architect) |
| [04_TECH_STACK.md](04_TECH_STACK.md) | Technology choices and versions across the stack | Blueprint (Package Architecture Director) |
| [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md) | Package organization, boundaries, and repository layout | Blueprint (Package Architecture Director) |
| [06_DEPENDENCIES.md](06_DEPENDENCIES.md) | Package management, versions, and dependency policy | Blueprint (Package Architecture Director) |

## Engine

| Spec | Purpose | Owning Director |
|---|---|---|
| [07_CONNECTOR_SPECIFICATION.md](07_CONNECTOR_SPECIFICATION.md) | CEX, DEX, and bridge connector interfaces and standards | Mercury (CEX Director) / Neptune (DEX Director) / BridgeMaster (Bridge Director) |
| [08_MARKET_DATA_ENGINE.md](08_MARKET_DATA_ENGINE.md) | Real-time market data ingestion and distribution | Stream (Real-Time Streaming Director) |
| [09_DISCOVERY_ENGINE.md](09_DISCOVERY_ENGINE.md) | Dynamic asset and venue discovery | Discovery (Discovery Intelligence Director) |
| [10_ARBITRAGE_ENGINE.md](10_ARBITRAGE_ENGINE.md) | Multi-type arbitrage opportunity detection and ranking | Apollo (Arbitrage Director) |
| [11_RISK_ENGINE.md](11_RISK_ENGINE.md) | Multi-dimensional risk scoring (8 factors) and confidence | Aegis (Risk Director) |
| [12_ASSET_NORMALIZATION.md](12_ASSET_NORMALIZATION.md) | Canonical asset identity, symbol resolution, wrapped assets | TokenIQ (Token Intelligence Director) |

## Security & Schema

| Spec | Purpose | Owning Director |
|---|---|---|
| [13_SECURITY_ARCHITECTURE.md](13_SECURITY_ARCHITECTURE.md) | Authentication, authorization, RLS, encryption, secrets, threat model | Sentinel (Security Director) |
| [14_DATABASE_SCHEMA.md](14_DATABASE_SCHEMA.md) | Supabase Postgres schema, migrations, RLS policies, indexes | Titan (Database Director) |

## Apps

| Spec | Purpose | Owning Director |
|---|---|---|
| [15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md) | Next.js web dashboard, components, analytics, admin | Aurora (Frontend Director) |
| [16_API_SPECIFICATION.md](16_API_SPECIFICATION.md) | REST, WebSocket, and GraphQL API contracts | Nova (Backend Director) |
| [17_BACKEND_SPECIFICATION.md](17_BACKEND_SPECIFICATION.md) | NestJS backend architecture, services, workers, queues | Nova (Backend Director) |
| [18_MOBILE_SPECIFICATION.md](18_MOBILE_SPECIFICATION.md) | Expo React Native mobile app (Android-first, iOS) | Orion (Mobile Director) |
| [19_PUSH_NOTIFICATIONS.md](19_PUSH_NOTIFICATIONS.md) | Push notification architecture for mobile and web | Orion (Mobile Director) |
| [20_BIOMETRIC_SECURITY.md](20_BIOMETRIC_SECURITY.md) | Biometric authentication, secure storage, device binding | Cipher (Cryptography Director) |

## Execution & Risk

| Spec | Purpose | Owning Director |
|---|---|---|
| [21_EXECUTION_ENGINE.md](21_EXECUTION_ENGINE.md) | 3-tier execution: manual → simulated → automated | Vulcan (Execution Director) |
| [22_GUARDRAILS.md](22_GUARDRAILS.md) | Risk limits, circuit breakers, kill switch, spend caps | Aegis (Risk Director) |
| [23_AUDIT_LOGGING.md](23_AUDIT_LOGGING.md) | Immutable trade audit trail, HMAC chains, compliance logs | Guardian (Compliance Director) |

## Cross-Chain & Infra

| Spec | Purpose | Owning Director |
|---|---|---|
| [24_DEX_CONNECTORS.md](24_DEX_CONNECTORS.md) | DEX protocol connectors (Uniswap, PancakeSwap, Curve, 1inch) | Neptune (DEX Director) |
| [25_BRIDGE_AGGREGATOR.md](25_BRIDGE_AGGREGATOR.md) | Cross-chain bridge routing, fees, transfer times | BridgeMaster (Bridge Director) |
| [26_CROSS_CHAIN_ENGINE.md](26_CROSS_CHAIN_ENGINE.md) | Cross-chain arbitrage detection and orchestration | Router (Smart Routing Director) |

## Quality & Deploy

| Spec | Purpose | Owning Director |
|---|---|---|
| [27_TESTING_STRATEGY.md](27_TESTING_STRATEGY.md) | Unit, integration, E2E, chaos, and load testing | Validator (QA Director) |
| [28_OBSERVABILITY.md](28_OBSERVABILITY.md) | Prometheus, Grafana, OpenTelemetry, metrics, traces, logs | Pulse (Observability Director) |
| [29_DEPLOYMENT.md](29_DEPLOYMENT.md) | Docker, Kubernetes, Helm, CI/CD, release pipeline | Forge (DevOps Director) |
| [30_PERFORMANCE_TARGETS.md](30_PERFORMANCE_TARGETS.md) | SLOs, latency budgets, throughput, and optimization targets | Benchmark (Performance Director) |
| [31_GLOSSARY.md](31_GLOSSARY.md) | Terminology and definitions used across the blueprint | Sage (Documentation Director) |
| [32_APPENDIX.md](32_APPENDIX.md) | References, RFCs, and supplementary resources | Sage (Documentation Director) |

---

**Diagrams** (under `docs/diagrams/`):
- `architecture.mmd` — system architecture
- `dataflow.mmd` — market-data and opportunity dataflow
- `execution.mmd` — 3-tier execution flow

**Last updated:** 2026-07-01 by @sage (Documentation Director).
