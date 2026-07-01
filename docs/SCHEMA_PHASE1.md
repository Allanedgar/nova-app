# Phase 1 Schema Notes

Per `docs/02_PHASED_ROADMAP.md` Tasks 1.7, 1.8, 1.9 and `docs/14_DATABASE_SCHEMA.md`.

## Files

- Migration: `supabase/migrations/20260701000000_phase1_initial.sql`
- Roll-forward only — no `DROP COLUMN` statements.

## Tables created

| Table | Purpose | Owner | Indexes |
|---|---|---|---|
| `discovered_pairs` | All pairs @discovery has ever seen | @discovery | `(connector_id, last_observed_at)`, `(base, quote)` |
| `opportunities` | Every profitable opportunity the detector emits | @apollo | `(pair, detected_at)`, `(net_profit_bps desc, detected_at)` |
| `price_snapshots` | Market-data engine output for replay | @mercury / @neptune | `(pair, observed_at)`, `(connector_id, pair, observed_at)` |
| `executed_simulations` | @vulcan simulated-tier ledger | @vulcan | (added Phase 2 if needed) |

## RLS posture (Phase 1)

- Service role writes; anon key reads.
- Strict per-user RLS lands in Phase 3 alongside Supabase Auth.
- All tables have `enable row level security`. Anon reads are open via "anon read" policy.

## Apply

Once the Supabase project is wired (env vars set), apply with:

```
supabase db push
```

Or via MCP: `mcp_supabase_apply_migration`.

## Known limits (Phase 1)

- No `user_id` columns yet — auth lands in Phase 3.
- No FK constraints between `opportunities` and any user table.
- No composite primary key on `executed_simulations` — `(tier, outcome)` is not yet constrained.
