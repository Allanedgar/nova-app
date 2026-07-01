# Project Vision

**Document:** Phase 0 — Foundation
**Cross-References:** [02_PHASED_ROADMAP.md](02_PHASED_ROADMAP.md), [03_ENGINEERING_PRINCIPLES.md](03_ENGINEERING_PRINCIPLES.md), [04_TECH_STACK.md](04_TECH_STACK.md)

---

## 1. Mission Statement

Build the world's most professional open-source crypto arbitrage platform capable of detecting and executing cross-exchange and cross-chain arbitrage opportunities in real-time.

## 2. Product Goals

### 2.1 MVP Scope

- Real-time CEX and DEX price ingestion
- Normalized market snapshots
- Net-profit arbitrage detection after fees and slippage buffers
- Supabase-backed opportunity history
- Auth-ready user settings and alerts
- Manual execution workflow first; automated execution later

### 2.2 Target Markets

- **Primary:** Active retail traders seeking automated opportunity detection
- **Secondary:** Institutional traders requiring cross-exchange arbitrage
- **Future:** Hedge funds and market makers

## 3. Success Metrics

### 3.1 Technical Metrics

- Opportunity detection latency: <5 seconds
- Connector reliability: 99.9% uptime
- False positive rate: <10%
- API response time: p95 <200ms

### 3.2 Business Metrics

- Support for 15+ CEX exchanges
- Support for 12+ DEX protocols
- Support for 20+ cross-chain bridges
- Mobile apps on App Store and Play Store
- 1000+ DAU within first 30 days

## 4. Competitive Positioning

### 4.1 Differentiators

- **Dynamic discovery** — No hardcoded asset lists; automatically adapts to new listings
- **Cross-chain native** — Built-in bridge aggregation, not an afterthought
- **Institutional-grade risk** — 5-factor risk scoring with guardrails
- **Mobile-first** — Android-first design with split-screen support
- **Open source** — Transparent, auditable, community-driven

### 4.2 Competitors

| Competitor | Weakness | Our Advantage |
|---|---|---|
| 3Commas | Closed source, expensive | Free, open, transparent |
| Cryptohopper | Cloud-only, complex | Self-hostable, simple |
| Arbitrage.io | Limited exchanges | 15+ CEX + 12 DEX |
| Custom bots | Requires coding | No-code UI + API |

## 5. Architecture Principles

- **Type safety first** — TypeScript monorepo with strict mode
- **Separation of concerns** — Engine is pure, connectors handle IO
- **Security by default** — RLS on all tables, encrypted credentials
- **Observability built-in** — OpenTelemetry, structured logging
- **Progressive enhancement** — Detect → Manual → Automated

## 6. Technology Vision

```
TypeScript monorepo · pnpm workspaces · Node 22
├── NestJS 11 (API)
├── Next.js 15 (Web)
├── Expo SDK 52 (Mobile)
├── Supabase Postgres + RLS
├── Redis cache
└── CCXT 4.x + The Graph
```

## 7. Roadmap Vision

- **Phase 0 (Week 1):** Foundation — CI, linting, testing
- **Phase 1 (Weeks 2-3):** Real data — CEX connectors, Supabase persistence
- **Phase 2 (Weeks 4-5):** Detection — Triangular + cross-chain engines
- **Phase 3 (Week 6):** Auth — Supabase Auth, multi-tenant profiles
- **Phase 4 (Weeks 7-8):** Web dashboard — Realtime opportunities, alerts
- **Phase 5 (Weeks 9-13):** Mobile — Android-first, biometric auth
- **Phase 6 (Weeks 12-14):** Execution — 3-tier manual → simulated → automated
- **Phase 7 (Weeks 15-17):** DEX + bridges — Uniswap, PancakeSwap, Stargate
- **Phase 8 (Week 20):** Production — SLOs, security review, App Store launch

**Total: 20 weeks to production launch**

## 8. Stakeholder Alignment

### 8.1 For Developers

- Clear phase-based roadmap with acceptance criteria
- TDD workflow with explicit test requirements
- Agent-assisted development with specialist routing
- Comprehensive documentation and examples

### 8.2 For Users

- Real-time opportunity detection
- Mobile push notifications
- Manual execution with full control
- Optional auto-execute behind conservative guardrails

### 8.3 For Contributors

- Open source (MIT license)
- Clear contribution guidelines
- AI-assisted development (Claude Code agents)
- Structured onboarding

## 9. Acceptance Criteria

- [ ] Repository scaffolded with CI/CD
- [ ] 5 CEX connectors live (Binance, OKX, Kraken, Coinbase, Bybit)
- [ ] Triangular detector functional
- [ ] Supabase persistence operational
- [ ] Web dashboard with realtime opportunities
- [ ] Mobile app on Play Store (Android)
- [ ] Manual execution working on at least 1 exchange
- [ ] All 6 guardrails tested and enforced
- [ ] App Store approval (iOS)
- [ ] 1000 DAU milestone reached

## Engineering Notes

- MVP focuses on detection + manual execution
- Auto-execute deferred until guardrails proven
- Mobile is Android-first (70% of TAM)
- DEX + bridge connectors in later phases
- Security review mandatory before production launch