**See also:** [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [06_DEPENDENCIES.md](06_DEPENDENCIES.md), [01_PROJECT_VISION.md](01_PROJECT_VISION.md)
# Tech Stack

**Document:** Phase 0 — Foundation
**Cross-References:** [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [06_DEPENDENCIES.md](06_DEPENDENCIES.md)

---

## 1. Technology Summary

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | 22 LTS | Server runtime |
| **Package Manager** | pnpm | 9.15.9 | Dependency management |
| **Language** | TypeScript | 5.3.0 | Type-safe development |
| **API Framework** | NestJS | 11.x | Backend API |
| **Web Framework** | Next.js | 15.x | Dashboard |
| **UI Library** | React | 19.x | Components |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **Mobile** | Expo SDK | 52.x | React Native wrapper |
| **React Native** | RN | 0.76.x | Mobile framework |
| **Database** | Supabase Postgres | Latest | Primary database |
| **Cache** | Upstash Redis | Latest | In-memory cache |
| **Exchange Data** | CCXT | 4.x | Exchange connector library |
| **DEX Data** | The Graph | - | Subgraph queries |
| **Blockchain** | ethers.js / viem | 6.x / 2.x | Ethereum interactions |
| **Auth** | Supabase Auth | - | Authentication |
| **Queue** | BullMQ | Latest | Job queues |
| **Monitoring** | OpenTelemetry | Latest | Distributed tracing |
| **Metrics** | Prometheus | - | Metrics collection |
| **Error Tracking** | Sentry | Latest | Error reporting |
| **Analytics** | PostHog | Latest | Product analytics |

---

## 2. Rationale and It was chosen for several reasons:

  
### 2.1 Node.js 22 LTS

Node.js 22 provides native `fetch`, improved performance with V8 11.3, and long-term support until 2027.

### 2.2 pnpm 9.15.9

pnpm was chosen over npm/yarn for strict dependency resolution, disk efficiency, and monorepo support.

### 2.3 TypeScript 5.3

TypeScript enables type safety across the codebase with structural typing and compile-time checks.

### 2.4 NestJS 11

NestJS provides opinionated architecture with decorators and extensive ecosystem support.

### 2.5 Next.js 15

Next.js supports server components and has React 19 support for optimized rendering.

### 2.6 Expo SDK 52

Expo simplifies React Native builds and EAS handles App Store and Play Store deployments.

### 2.7 Supabase Postgres + RLS

Supabase offers Postgres with Row-Level Security, Realtime, and built-in Edge Functions.

### 2.8 Upstash Redis

Upstash Redis provides a serverless Redis-compatible service with a free tier.

### 2.9 BullMQ

BullMQ provides a robust queue system built on Redis for job processing.

### 2.10 OpenTelemetry

OpenTelemetry enables vendor-neutral distributed tracing and observability.

---

## 3. Selection Criteria

Each technology was evaluated against institutional criteria including maturity, community support, TypeScript compatibility, performance, security track record, and licensing.

### 3.1 Evaluation Matrix

| Technology | Maturity | Community | TS Support | Performance | Security | License |
|---|---|---|---|---|---|---|
| NestJS | High | Large | Excellent | Good | Strong | MIT |
| Next.js | High | Large | Excellent | Good | Strong | MIT |
| Supabase | Medium | Growing | Good | Good | Strong | Apache 2 |
| pnpm | High | Large | N/A | Excellent | Strong | MIT |

---

## 4. Version Constraints

The project pins exact versions for production dependencies to ensure reproducible builds.

### 4.1 Pinned Versions

Production dependencies use exact versions without ranges.

### 4.2 caret Ranges

Dev dependencies use caret ranges for minor updates.

### 4.3 Lock File

The lock file is committed to Git with no manual edits.

---

## 5. Technology Lifecycle

The policy handles security patches immediately, reviews patch versions weekly, reviews minor versions monthly, and plans major version migrations.

### 5.1 Update Policy

### 5.2 Deprecation Timeline

Technologies are monitored for deprecation warnings and replaced proactively.

## 6. Compatibility Matrix

### 6.1 Node.js Compatibility

Node.js 22 is the only supported version with EOL tracking.

### 6.2 Browser Compatibility

Targets ESNext on modern browsers including Chrome, Firefox, Safari, and Edge.

### 6.3 Mobile Compatibility

iOS 15+ and Android API 26+ are supported.

---

## 7. Acceptance Criteria

- [ ] All technologies have documented rationale
- [ ] Versions pinned in package.json
- [ ] Lock file committed
- [ ] Compatibility matrix documented
- [ ] Update policy defined
- [ ] No unapproved dependencies

## Engineering Notes

- Technology choices favor battle-tested solutions
- Avoid bleeding-edge releases in production
- Maintain upgrade paths for major versions
- Document breaking changes in CHANGELOG