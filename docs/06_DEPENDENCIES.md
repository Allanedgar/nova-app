**See also:** [04_TECH_STACK.md](04_TECH_STACK.md), [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [27_TESTING_STRATEGY.md](27_TESTING_STRATEGY.md)
# Dependencies

**Document:** Phase 0 — Foundation
**Cross-References:** [04_TECH_STACK.md](04_TECH_STACK.md), [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md)

---

## 1. Package Manager

### 1.1 pnpm Configuration

**Version:** 9.15.9 (pinned in CI)

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'scripts/*'

# Strict peer dependency resolution
strict-peer-dependencies: true
auto-install-peers: true
shamefully-hoist: false
```

### 1.2 Version Strategy

- **Production dependencies:** Exact versions (no ranges)
- **Dev dependencies:** Caret ranges (^) for minor updates
- **Lock file:** Committed to Git, no manual edits
- **Update cadence:**
  - Security patches: Immediate
  - Patch versions: Weekly review
  - Minor versions: Monthly review
  - Major versions: Planned migration

---

## 2. Core Dependencies

### 2.1 Runtime & Language

| Package | Version | Purpose |
|---|---|---|
| typescript | 5.3.0 | Type checking |
| tsc-watch | 6.0.0 | TypeScript watch mode |
| tsx | 4.7.0 | TypeScript execution |

### 2.2 API & Framework

| Package | Version | Purpose |
|---|---|---|
| @nestjs/common | 11.0.0 | NestJS core |
| @nestjs/core | 11.0.0 | NestJS core |
| @nestjs/platform-express | 11.0.0 | Express adapter |
| @nestjs/throttler | 6.4.0 | Rate limiting |
| @nestjs/passport | 11.0.0 | Authentication |
| @nestjs/swagger | 8.0.0 | API documentation |
| express | 4.18.0 | HTTP server |

### 2.3 Database & ORM

| Package | Version | Purpose |
|---|---|---|
| @supabase/supabase-js | 2.55.0 | Supabase client |
| @supabase/ssr | 0.6.0 | Server-side rendering |
| drizzle-orm | 0.29.0 | Database ORM |
| postgres | 3.4.0 | PostgreSQL driver |
| pg | 8.11.0 | Alternative PG driver |

### 2.4 Caching & Queue

| Package | Version | Purpose |
|---|---|---|
| ioredis | 5.3.2 | Redis client |
| bullmq | 5.4.0 | Job queues |
| @nestjs/bullmq | 11.0.0 | NestJS BullMQ integration |

### 2.5 Exchange & Blockchain

| Package | Version | Purpose |
|---|---|---|
| ccxt | 4.2.0 | Exchange connectors |
| ethers | 6.9.0 | Ethereum library |
| viem | 2.0.0 | Type-safe Ethereum |
| @solana/web3.js | 1.87.0 | Solana interactions |

### 2.6 GraphQL & Subgraphs

| Package | Version | Purpose |
|---|---|---|
| @apollo/client | 3.8.0 | GraphQL client |
| graphql | 16.8.0 | GraphQL implementation |
| @graphql-tools/schema | 10.0.0 | Schema utilities |

### 2.7 Utilities

| Package | Version | Purpose |
|---|---|---|
| zod | 3.22.0 | Schema validation |
| dayjs | 1.11.0 | Date manipulation |
| ulidx | 2.0.0 | ULID generation |
| cuid2 | 1.0.0 | Collision-resistant IDs |
| dotenv | 16.3.0 | Environment variables |
| pino | 8.17.0 | Structured logging |
| pino-pretty | 10.3.0 | Log formatting |
| big.js | 6.2.0 | Arbitrary precision math |
| axios | 1.6.0 | HTTP client |
| ws | 8.16.0 | WebSocket client |

### 2.8 Observability

| Package | Version | Purpose |
|---|---|---|
| @opentelemetry/sdk-node | 0.45.0 | OpenTelemetry SDK |
| @opentelemetry/api | 1.7.0 | OpenTelemetry API |
| @opentelemetry/instrumentation-http | 0.46.0 | HTTP instrumentation |
| prom-client | 15.0.0 | Prometheus metrics |
| @sentry/node | 7.81.0 | Error tracking |

---

## 3. Frontend Dependencies

### 3.1 Next.js & React

| Package | Version | Purpose |
|---|---|---|
| next | 15.x | React framework |
| react | 19.x | UI library |
| react-dom | 19.x | React DOM |
| @tanstack/react-query | 5.0.0 | Data fetching |
| @tanstack/react-query-devtools | 5.0.0 | DevTools |

### 3.2 Styling

| Package | Version | Purpose |
|---|---|---|
| tailwindcss | 3.4.0 | Utility-first CSS |
| postcss | 8.4.0 | CSS processor |
| autoprefixer | 10.4.0 | CSS vendor prefixes |
| @tailwindcss/typography | 0.5.0 | Typography plugin |

### 3.3 UI Components

| Package | Version | Purpose |
|---|---|---|
| @headlessui/react | 2.0.0 | Unstyled components |
| @heroicons/react | 2.0.0 | Icon set |
| recharts | 2.0.0 | Charts |

---

## 4. Mobile Dependencies

### 4.1 Expo & React Native

| Package | Version | Purpose |
|---|---|---|
| expo | 52.x | React Native wrapper |
| expo-router | 4.0.0 | File-based routing |
| expo-secure-store | 13.0.0 | Secure storage |
| expo-notifications | 17.0.0 | Push notifications |
| expo-local-authentication | 14.0.0 | Biometric auth |
| react-native | 0.76.x | Mobile framework |
| react-native-gesture-handler | 2.16.0 | Gestures |
| @gorhom/bottom-sheet | 4.5.0 | Bottom sheet |
| react-native-reanimated | 3.10.0 | Animations |

### 4.2 State & Data

| Package | Version | Purpose |
|---|---|---|
| @tanstack/react-query | 5.0.0 | Data fetching |
| @supabase/supabase-js | 2.55.0 | Supabase client |
| @react-native-async-storage/async-storage | 2.0.0 | Local storage |

---

## 5. Development Dependencies

### 5.1 Build Tools

| Package | Version | Purpose |
|---|---|---|
| vite | 5.0.0 | Build tool |
| esbuild | 0.19.0 | Bundler |
| rimraf | 5.0.0 | File removal |
| npm-run-all | 4.1.5 | Run multiple scripts |

### 5.2 Linting & Formatting

| Package | Version | Purpose |
|---|---|---|
| eslint | 8.56.0 | Linting |
| @typescript-eslint/parser | 6.19.0 | TS parser |
| @typescript-eslint/eslint-plugin | 6.19.0 | TS rules |
| eslint-plugin-boundaries | 2.1.0 | Import boundaries |
| eslint-plugin-import | 2.29.0 | Import rules |
| eslint-plugin-security | 2.1.0 | Security rules |
| prettier | 3.2.0 | Code formatting |
| eslint-config-prettier | 9.1.0 | Prettier integration |

### 5.3 Testing

| Package | Version | Purpose |
|---|---|---|
| vitest | 1.2.0 | Unit/integration tests |
| @vitest/coverage-v8 | 1.2.0 | Coverage reporting |
| @playwright/test | 1.40.0 | E2E tests |
| msw | 2.0.0 | API mocking |
| @testcontainers/postgresql | 1.0.0 | Test DB |
| @testcontainers/redis | 1.0.0 | Test Redis |

---

## 6. CI/CD Dependencies

### 6.1 GitHub Actions

| Package | Version | Purpose |
|---|---|---|
| actions/checkout | 4.5.0 | Checkout code |
| actions/setup-node | 4.0.0 | Node setup |
| pnpm/action-setup | 4.0.0 | pnpm setup |
| actions/cache | 3.3.0 | Dependency cache |
| codecov/codecov-action | 4.5.0 | Coverage upload |

---

## 7. Optional Dependencies

### 7.1 Analytics

| Package | Version | Purpose |
|---|---|---|
| posthog-js | 1.200.0 | Web analytics |
| @sentry/react | 7.81.0 | React error tracking |
| @sentry/node | 7.81.0 | Node error tracking |

### 7.2 Documentation

| Package | Version | Purpose |
|---|---|---|
| typedoc | 0.25.0 | TypeScript docs |
| markdownlint-cli | 0.37.0 | Markdown linting |

---

## 8. Tools

### 8.1 Database

| Tool | Version | Purpose |
|---|---|---|
| supabase | 2.10.0 | Supabase CLI |
| @drizzle-kit/node-pg | 0.1.0 | Database introspection |

### 8.2 Code Quality

| Tool | Version | Purpose |
|---|---|---|
| commitlint | 18.6.0 | Commit message linting |
| lefthook | 1.6.0 | Git hooks |
| sherif | 1.20.0 | Monorepo linting |

---

## 9. Acceptance Criteria

- [ ] All dependencies documented
- [ ] Versions pinned in package.json
- [ ] No critical vulnerabilities (npm audit)
- [ ] No high-severity Snyk alerts
- [ ] All licenses are permissive (MIT, Apache 2.0)
- [ ] Lock file committed
- [ ] Dependabot enabled
- [ ] Automated security scanning in CI

## Engineering Notes

- Dependencies audited weekly
- Unused dependencies removed
- Vendor critical dependencies for supply chain security
- Consider lighter alternatives for large dependencies