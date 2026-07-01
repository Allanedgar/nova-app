// Intentional ESLint boundary-rule violator.
// @nova-app/persistence MUST NOT import from @nova-app/engine (rule #2 in BOUNDARY_RULES.md).
// This file exists only to prove that `eslint-plugin-boundaries` catches the violation.
// It is NOT a real module — it is run standalone via `pnpm exec eslint data/evidence/...`.

import { findOpportunities } from '../../packages/engine/src/index.js';

export const _demo = findOpportunities;
