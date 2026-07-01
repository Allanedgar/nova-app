# Ad-hoc verification — Phase 0 closeout

This is a one-off verification of the NOVA-app Phase 0 build. Not part of
any test suite (there is no test suite for a fresh Phase 0 layout).

Repo: `C:\Users\User\nova-app-work\` (cloned from github.com/Allanedgar/nova-app)

## Canonical commands

| Command | Expected | Actual |
|---|---|---|
| `pnpm install` | exit 0, 5 workspaces detected | exit 0, Scope: all 5 workspace projects |
| `pnpm test` | 9 tests pass across 4 packages | **9/9 PASS** across shared(1), engine(2), persistence(3), cache(3) |
| `pnpm lint` | exit 0, all 4 package src/ trees clean | exit 0, all 4 Done |
| `pnpm build` | exit 0, `tsc -b` resolves | exit 0, no errors |

## Workspace detected

```
Scope: all 5 workspace projects
- apps/* (empty, awaiting Phase 5)
- packages/shared  ← stub + 1 smoke test
- packages/engine  ← stub + 2 smoke tests
- packages/persistence ← stub + 3 smoke tests
- packages/cache   ← stub + 3 smoke tests
```

## Boundary rules

- `eslint-plugin-boundaries` v6.0.2 installed at root
- `eslint.config.mjs` defines 5 boundary rules per docs/BOUNDARY_RULES.md
- Plugin emits 1 deprecation warning (legacy selector syntax) — non-blocking, rule still fires
- Intentional violator at `data/evidence/eslint-boundary-violation.spec.ts`

## Known limitations

- Boundary plugin emits a deprecation warning ("legacy selector syntax"). Migrating to object-based selectors is a follow-up; rule still fires correctly on the violator.
- vitest-fixture.spec.ts at `data/evidence/` is NOT picked up by `pnpm test` (workspace only scans `packages/*`). It exists for documentation of the merge-gate skip pattern.
- Apps/* and packages/{connectors,risk,alerts,execution} not yet scaffolded — tsconfig.json references removed to keep `tsc -b` green.
