# SOUL.md — ARBITRAGE-PRO Identity

**Version:** 0.1.0
**Last Updated:** 2026-01-15
**Status:** Living Document

---

## Mission

Build the world's most professional open-source crypto arbitrage platform — a system so robust, transparent, and performant that it becomes the reference implementation for institutional-grade trading infrastructure.

---

## Identity

### We Are

- **Engineering-first** — Code quality, testing, and documentation are not optional
- **Institution-grade** — Built for traders who depend on this software for their livelihood
- **Transparent** — Every design decision documented, every trade auditable
- **Open** — Open source by default, community-driven development
- **Pragmatic** — Solve real problems with proven technologies

### We Are Not

- A get-rich-quick scheme
- A trading bot for retail investors
- Experimental or hobbyist code
- A project that cuts corners on security
- A closed-source competitor

---

## Values

### 1. Engineering Excellence

We hold ourselves to the standards of Google, Stripe, Cloudflare, Coinbase, Bloomberg, and other world-class engineering organizations. Every line of code is production-ready.

**Manifesto:**
- Test coverage ≥ 80% (90% for core engines)
- TypeScript strict mode, no `any`
- No hardcoded values, no magic numbers
- Comprehensive error handling
- Structured logging everywhere
- Performance measured, not guessed

### 2. Security paramount

Financial software is a target. We treat security as a first-class concern, not an afterthought.

**Manifesto:**
- Defense in depth
- Audit logs are immutable
- Secrets never in code
- MFA required for traders
- Quarterly third-party audits
- Bug bounty program

### 3. Radical Transparency

Every contributor, from AI agents to human engineers, operates with full context.

**Manifesto:**
- All documentation is public
- All design decisions captured in ADRs
- All trade logic is verifiable
- All metrics are exposed
- All failures are documented

### 4. Community-Driven

This project succeeds through collective intelligence.

**Manifesto:**
- All design decisions debated publicly
- Contributions welcomed from all skill levels
- Mentorship for new contributors
- Recognition for all contributions
- Open governance model

### 5. Reliability

Traders depend on us. Downtime is not an option.

**Manifesto:**
- 99.95% uptime SLA
- Graceful degradation over total failure
- Circuit breakers on all external calls
- Kill switch for emergency stops
- Chaos engineering tests

---

## Principles

### Technical Principles

1. **Simplicity over cleverness** — Readable code beats elegant code
2. **Convention over configuration** — Sensible defaults, escape hatches available
3. **Explicit over implicit** — No magic, no hidden behavior
4. **Composability** — Small, focused components that work together
5. **Testability** — Code designed for easy testing
6. **Performance by design** — Optimize hot paths, profile everything

### Business Principles

1. **User sovereignty** — Users control their funds and keys
2. **Non-custodial** — We never hold user assets
3. **Regulatory compliance** — Users responsible for their own compliance
4. **Fair access** — No preferential treatment
5. **Sustainable** — Open source, community-funded long-term

---

## Communication Voice

### Tone

- **Direct** — No fluff, no marketing speak
- **Professional** — We're building for institutions
- **Technical** — Audience is engineers
- **Precise** — Every word chosen carefully

### Language

- Use "we" for the project/community
- Use "you" for the reader/user
- Avoid jargon without definition (see [27_GLOSSARY.md](27_GLOSSARY.md))
- Code examples must be production-ready
- Diagrams must be accurate and up-to-date

### Anti-Patterns

- ❌ "Easy to use" — Everything is relative
- ❌ "Simply" — Nothing is simple in distributed systems
- ❌ "Just" — Minimizes complexity
- ❌ "Obviously" — Assumes knowledge
- ❌ "Best" — Subjective, use specific metrics

---

## Rituals

### Code Review

Every PR, regardless of size, receives:
1. Automated checks (CI)
2. Human review (minimum 1 reviewer)
3. Verification report (for AI contributions)
4. Merge only when all checks pass

### Documentation

Every feature includes:
1. Specification update (if applicable)
2. API documentation
3. Code comments (JSDoc)
4. Example code
5. Migration guide (if breaking change)

### Release

Every release:
1. Changelog updated
2. Version bumped (semantic versioning)
3. Migration guide published
4. Security audit (for major releases)
5. Community announcement

---

## Standards

### Code Quality

| Metric | Standard | Tool |
|---|---|---|
| TypeScript | Strict mode | tsc --strict |
| Linting | Zero errors | ESLint |
| Formatting | Prettier | Prettier |
| Test coverage | ≥ 80% | Vitest |
| Complexity | Cyclomatic < 10 | ESLint complexity |
| Duplication | < 3% | jscpd |

### Performance

| Metric | Target | Measurement |
|---|---|---|
| API latency (p95) | < 100ms | Prometheus |
| Opportunity detection | < 500ms | Tracing |
| Build time | < 5 min | CI |
| Test execution | < 10 min | CI |

### Security

| Metric | Standard | Audit |
|---|---|---|
| Dependency vulnerabilities | 0 critical | npm audit |
| Code scanning | 0 high | Snyk |
| Secrets in code | 0 | git-secrets |
| MFA adoption | 100% (admins/traders) | User analytics |

---

## Conflict Resolution

### Technical Disagreements

1. **Data-driven** — Metrics and benchmarks decide
2. **MVP approach** — Build simplest solution first
3. **Spectrum** — Debate both sides, document decision
4. **ADR** — Architectural Decision Record for posterity

### Community Disputes

1. **Respect** — Attack ideas, not people
2. **Evidence** — Back claims with data or examples
3. **Compromise** — Find middle ground when possible
4. **Maintainers** — Final decision rests with maintainers

---

## Evolution

This document evolves with the project. Proposed changes:

1. Open an issue with rationale
2. Community discussion (7 days minimum)
3. Maintainer review
4. Consensus-based decision
5. Update this document
6. Announce change

All changes versioned in Git.

---

## Manifesto

```
We build for the long term.
We prioritize correctness over speed.
We choose transparency over convenience.
We value safety over features.
We measure twice, cut once.
We document everything.
We test everything.
We ship production-ready code.
We operate with integrity.
We build in public.
We are ARBITRAGE-PRO.
```

---

## Engineering Notes

- This document is the source of truth for project identity
- All contributors must align with these values
- Deviations require maintainer approval
- Reviewed quarterly
- Updated as project evolves