-- Phase 3 — Auth + Multi-Tenant
-- Per docs/02_PHASED_ROADMAP.md Phase 3 + docs/13_SECURITY_ARCHITECTURE.md
-- Forward-only; no DROP. Adds user isolation, profiles, alert_rules, watchlist.

-- ────────────────────────────────────────────────────────────────────────────
-- profiles: one row per authenticated user, created via trigger on auth.users
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  display_name      text,
  avatar_url        text,
  daily_loss_cap_usd numeric NOT NULL DEFAULT 1000,
  max_auto_notional_usd numeric NOT NULL DEFAULT 5000,
  min_risk_score    numeric NOT NULL DEFAULT 30,
  max_trades_per_pair integer NOT NULL DEFAULT 5,
  cooldown_seconds  integer NOT NULL DEFAULT 300,
  auto_paused_until timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- alert_rules: per-user notification rules
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair              text,
  min_profit_bps    numeric NOT NULL DEFAULT 50,
  max_risk_score    numeric NOT NULL DEFAULT 70,
  min_confidence    numeric NOT NULL DEFAULT 0.5,
  enabled           boolean NOT NULL DEFAULT true,
  cooldown_seconds  integer NOT NULL DEFAULT 300,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_user_idx ON public.alert_rules (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- opportunity_watchlist: per-user saved/bookmarked opportunities
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_watchlist (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id    uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS watchlist_user_idx ON public.opportunity_watchlist (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Add user_id to existing tables (nullable for Phase 1 backfill)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.executed_simulations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS opportunities_user_idx ON public.opportunities (user_id);
CREATE INDEX IF NOT EXISTS simulations_user_idx ON public.executed_simulations (user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS: Replace Phase 1 "anon read all" with per-user policies
-- ────────────────────────────────────────────────────────────────────────────

-- Drop Phase 1 wide-open policies
DROP POLICY IF EXISTS "anon read" ON public.discovered_pairs;
DROP POLICY IF EXISTS "anon read" ON public.opportunities;
DROP POLICY IF EXISTS "anon read" ON public.price_snapshots;
DROP POLICY IF EXISTS "anon read" ON public.executed_simulations;

-- profiles: users can read/update own profile; service role full access
CREATE POLICY "users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- alert_rules: users CRUD own rules
CREATE POLICY "users read own alert_rules"
  ON public.alert_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own alert_rules"
  ON public.alert_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own alert_rules"
  ON public.alert_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own alert_rules"
  ON public.alert_rules FOR DELETE
  USING (auth.uid() = user_id);

-- watchlist: users CRUD own watchlist
CREATE POLICY "users read own watchlist"
  ON public.opportunity_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own watchlist"
  ON public.opportunity_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own watchlist"
  ON public.opportunity_watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- opportunities: users see own + global (user_id IS NULL)
CREATE POLICY "users read own or global opportunities"
  ON public.opportunities FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- executed_simulations: users see own
CREATE POLICY "users read own simulations"
  ON public.executed_simulations FOR SELECT
  USING (auth.uid() = user_id);

-- discovered_pairs: all authenticated users can read (global reference data)
CREATE POLICY "authenticated read discovered_pairs"
  ON public.discovered_pairs FOR SELECT
  USING (auth.role() = 'authenticated');

-- price_snapshots: all authenticated users can read (global reference data)
CREATE POLICY "authenticated read price_snapshots"
  ON public.price_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────────────────────
-- Enable RLS on new tables
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_watchlist ENABLE ROW LEVEL SECURITY;