# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial project structure and documentation
- 28 specification documents covering all aspects of the platform
- System architecture with 10 microservices
- Support for 60+ connectors (20 CEX, 20 DEX, 20 bridges)
- Complete database schema with 13 tables
- REST, WebSocket, and GraphQL API specifications
- Security architecture with MFA, RBAC, and audit logging
- Observability stack (Prometheus, Grafana, OpenTelemetry)
- Comprehensive testing strategy
- Kubernetes deployment configuration
- AI contribution guidelines

### Changed
- N/A (initial release)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [0.2.0] - 2026-01-15

### Added
- Phase 2 Detection Engine v2 implementation
- Market Snapshot Aggregator (`packages/engine/src/aggregator.ts`)
- Validation Pipeline (`packages/engine/src/validator.ts`) with 9 validation steps
- Risk Scorer (`packages/engine/src/risk.ts`) with 6-dimensional scoring
- Confidence Scorer (`packages/engine/src/confidence.ts`)
- Spatial Arbitrage Detector (`packages/engine/src/spatial.ts`)
- ID Generator (`packages/engine/src/id.ts`)
- Opportunity types (`packages/shared/src/opportunity.ts`)
- 47 new engine tests (114 total across all packages)
- Phase 1.5 market infrastructure (Binance, OKX connectors, registry, persistence)

### Changed
- Engine version bumped to 0.3.0
- Connector interface expanded to 9 methods (Phase 1.5)
- Shared types reorganized to avoid circular dependencies
- All packages lint clean with `--max-warnings 0`

### Fixed
- TypeScript build errors (circular dependency in shared types)
- ESLint unused import warnings

---

## [0.1.0] - 2026-01-15

### Added
- Project initialization
- Core documentation repository
- Engineering specifications (docs/01-28)
- Mermaid diagrams for architecture, data flow, and execution
- MIT License
- Code of Conduct
- Contributing guidelines
- Security policy

---

## Template

### Added
- Description of new feature

### Changed
- Description of change to existing functionality

### Deprecated
- Description of soon-to-be removed feature

### Removed
- Description of removed feature

### Fixed
- Description of bug fix

### Security
- Description of security fix

---

**Format:**
```
## [MAJOR.MINOR.PATCH] - YYYY-MM-DD
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
```

**Version History:**
- 0.1.0 — Initial public alpha (documentation)
- 0.2.0 — DEX integration beta
- 0.3.0 — Execution and mobile beta
- 1.0.0 — Production-ready release