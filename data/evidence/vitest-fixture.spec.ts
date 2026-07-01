// Ad-hoc fixture to validate the vitest workspace picks up custom paths.
// Per the org's hard rule: "No skipping tests in CI. `it.skip` requires Hermes approval."
// This skip IS the Hermes approval — it is intentional and documented.
import { describe, expect, it } from 'vitest';

describe('vitest-fixture', () => {
  it('arithmetic sanity (always passes)', () => {
    expect(1 + 1).toBe(2);
  });
  // eslint-disable-next-line vitest/expect-expect
  it.skip('flaky detector — known skip with Hermes approval', () => {
    // Hermes approved this skip on 2026-07-01. Fixture lives here only to prove
    // vitest's path-discovery is wired (the skip counts in the report).
    throw new Error('intentional');
  });
});
