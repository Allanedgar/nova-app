-- Phase 1 initial schema — `discovered_pairs` + `opportunities`.
-- Per docs/14_DATABASE_SCHEMA.md + docs/02_PHASED_ROADMAP.md (Phase 1 Tasks 1.7, 1.8, 1.9).
-- Forward-only; no DROP. Names follow the spec; user/auth fields deferred to Phase 3.

-- ────────────────────────────────────────────────────────────────────────────
-- discovered_pairs: output of @discovery for every pair we ever see.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discovered_pairs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id    text        NOT NULL,
  base_asset      text        NOT NULL,
  quote_asset     text        NOT NULL,
  symbol          text        NOT NULL,
  chain           text,
  status          text        NOT NULL DEFAULT 'active',
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, symbol)
);

CREATE INDEX IF NOT EXISTS discovered_pairs_connector_idx
  ON public.discovered_pairs (connector_id, last_observed_at DESC);

CREATE INDEX IF NOT EXISTS discovered_pairs_pair_idx
  ON public.discovered_pairs (base_asset, quote_asset);

-- ────────────────────────────────────────────────────────────────────────────
-- opportunities: every profitable opportunity the detector emits.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair                text        NOT NULL,                  -- 'BTC/USDT'
  source_exchange     text        NOT NULL,                  -- 'binance'
  target_exchange     text        NOT NULL,                  -- 'okx'
  buy_price           numeric     NOT NULL,
  sell_price          numeric     NOT NULL,
  gross_profit_bps    numeric     NOT NULL,
  net_profit_bps      numeric     NOT NULL,
  liquidity_usd       numeric     NOT NULL DEFAULT 0,
  risk_score          numeric     NOT NULL DEFAULT 0,
  confidence_score    numeric     NOT NULL DEFAULT 0,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);

CREATE INDEX IF NOT EXISTS opportunities_pair_idx
  ON public.opportunities (pair, detected_at DESC);

CREATE INDEX IF NOT EXISTS opportunities_net_profit_idx
  ON public.opportunities (net_profit_bps DESC, detected_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- price_snapshots: market-data engine output for replay / analysis.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id  text        NOT NULL,                  -- 'binance'
  pair          text        NOT NULL,                  -- 'BTC/USDT'
  bid           numeric     NOT NULL,
  ask           numeric     NOT NULL,
  observed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_snapshots_pair_idx
  ON public.price_snapshots (pair, observed_at DESC);

CREATE INDEX IF NOT EXISTS price_snapshots_connector_pair_idx
  ON public.price_snapshots (connector_id, pair, observed_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- executed_simulations: @vulcan simulated-tier ledger.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.executed_simulations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid REFERENCES public.opportunities(id),
  tier            text        NOT NULL DEFAULT 'simulated',  -- 'simulated'|'automated'|'manual'
  outcome         text        NOT NULL,                       -- 'simulated'|'rejected'|'failed'
  notional_usd    numeric     NOT NULL,
  reason          text,
  simulated_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS: Phase 1 has no authenticated user yet. Service-role writes; reads
-- are open via anon key. Tightened in Phase 3 when auth lands.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.discovered_pairs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executed_simulations ENABLE ROW LEVEL SECURITY;

-- Phase 1 policy: service-role bypass + anon read-all. RLS still enforced
-- against direct anon writes (only the service role can INSERT/UPDATE/DELETE).
DROP POLICY IF EXISTS "anon read" ON public.discovered_pairs;
CREATE POLICY "anon read"   ON public.discovered_pairs  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read" ON public.opportunities;
CREATE POLICY "anon read"   ON public.opportunities     FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read" ON public.price_snapshots;
CREATE POLICY "anon read"   ON public.price_snapshots    FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon read" ON public.executed_simulations;
CREATE POLICY "anon read"   ON public.executed_simulations FOR SELECT USING (true);
