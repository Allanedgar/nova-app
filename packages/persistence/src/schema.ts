export const SQL_CREATE_TABLES = `
create extension if not exists "uuid-ossp";
create table if not exists venues (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  kind text not null check (kind in ('cex','dex','bridge')),
  name text not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  symbol text not null,
  name text not null,
  decimals int not null default 18,
  contract_address text,
  chain_id int,
  first_seen_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);
create unique index if not exists idx_assets_symbol_chain on assets(symbol, coalesce(chain_id, -1));
create table if not exists pairs (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id),
  base_asset_id uuid not null references assets(id),
  quote_asset_id uuid not null references assets(id),
  symbol text not null,
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  unique(venue_id, symbol)
);
create table if not exists opportunities (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  status text not null default 'discovered',
  pair_id uuid references pairs(id),
  venue_id uuid references venues(id),
  buy_venue_id uuid references venues(id),
  sell_venue_id uuid references venues(id),
  gross_spread_bps numeric,
  net_profit_bps numeric,
  net_profit_usd numeric,
  expected_value numeric,
  confidence_score numeric,
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  payload jsonb not null default '{}'
);
create table if not exists executions (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid references opportunities(id),
  tier text not null,
  status text not null,
  filled_qty numeric,
  avg_price numeric,
  fee_paid numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  error text,
  metadata jsonb not null default '{}'
);
create table if not exists discovery_cycles (
  id uuid primary key default uuid_generate_v4(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  venues_scanned int not null default 0,
  venues_succeeded int not null default 0,
  venues_failed int not null default 0,
  assets_discovered int not null default 0,
  pairs_discovered int not null default 0,
  errors jsonb not null default '[]'
);
`;