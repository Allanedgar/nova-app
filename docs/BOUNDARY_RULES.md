# NOVA-app Boundary Rules

Per `docs/03_ENGINEERING_PRINCIPLES.md` and `docs/05_MONOREPO_STRUCTURE.md`, the
monorepo enforces dependency direction through `eslint-plugin-boundaries` (see
`eslint.config.mjs` at the repo root).

## Dependency Graph (ASCII)

```
       ┌─────────────────────────────────────────────────────┐
       │                       apps/                          │ ← users (clients)
       │  (api, web, mobile)                                  │
       └────────────────────────┬────────────────────────────┘
                                │ may consume
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                          packages/                            │
│                                                              │
│   shared   ←────────  ALL other packages may import from here│
│   engine                              ──pure── no I/O ───────│
│   persistence / cache / risk                                   │
│   alerts / execution                                          │
│                                                              │
└────────────────────────┬─────────────────────────────────────┘
                         │ consumed by
       ┌─────────────────┼────────────────────┐
       ▼                 ▼                    ▼
  services/         connectors/           tools/
  (microservices)  (CEX/DEX/bridge)    (codegen, etc.)
```

## Rules (enforced by `boundaries/element-types`)

| # | From | Disallowed Target | Rationale |
|---|------|-------------------|-----------|
| 1 | `packages/*` | `apps/*` | Packages are pure libraries — apps compose them, never vice-versa |
| 2 | `packages/engine` | `packages/{connectors, persistence, cache, risk, alerts, execution}` (allow: `shared`) | Engine is pure math; importing I/O bundles leaks side effects into detection |
| 3 | `packages/shared` | any other `package/*` | Shared stays at the dependency bottom — pull-up only |
| 4 | `connectors/*` | `apps/*` and `services/*` | Connectors are leaf modules — apps pull from them, connectors don't reach back |
| 5 | `services/*` | `apps/*` | Services are independent runtime units; apps may call them via HTTP, not via import |

## Evidence Fixture

`data/evidence/eslint-boundary-violation.spec.ts` exists to prove the rule
fires. It imports `@nova-app/engine` from `@nova-app/persistence`, which
violates rule #2. When the boundary plugin runs, that import must produce
a clear lint error.
