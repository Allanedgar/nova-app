# ARBITRAGE-PRO — CODEX ONBOARDING

## 1. PROJECT SUMMARY

ARBITRAGE-PRO is an institutional-grade open-source crypto arbitrage platform.
It detects and executes arbitrage opportunities across CEXs, DEXs, bridges, and chains.

**Remote:** https://github.com/Allanedgar/nova-app.git (branch: main)
**License:** MIT
**Runtime:** Node.js 24+, pnpm workspace, TypeScript strict

## 2. WHAT WAS BUILT (Phase 0-3)

### Phase 0 — Engine Foundation (packages/engine)
- `types/` — opportunity, snapshot, pipeline interfaces
- `strategies/` — plugin interface, registry, 4 strategies:
  - `cex-cross-exchange.ts` — lowest ask vs highest bid across 20 CEX venues
  - `cross-venue.ts` — CEX↔DEX with WETH normalization + gas cost
  - `cross-chain.ts` — cross-chain via Bridge Manager
  - `graph-arbitrage.ts` — Bellman-Ford negative cycle detection
- `pipeline/orchestrator.ts` — timeout, retry, stage management
- `bridge/manager.ts` — CompositeBridgeManager (multi-adapter)
- `risk/engine.ts` — 15-dimension risk assessment
- `publisher/event-bus.ts` — pub/sub + Publisher
- `scheduler/scheduler.ts` — periodic pipeline execution
- `marketdata/ws-feed.ts` — WebSocket feed manager
- `execution/simulator.ts` — simulation + circuit breakers

### Phase 1 — Connectors (packages/connectors)
- **20 CEX connectors** in `packages/connectors/src/cex/`:
  binance, coinbase, okx, bybit, kraken, kucoin, gate, mexc, htx, bitfinex, bitstamp, cryptocom, whitebit, poloniex, gemini, bitget, bingx, phemex, lbank, backpack
- **7 DEX connectors** in `packages/connectors/src/dex/`:
  uniswap-v3, sushiswap, balancer-v3, raydium, jupiter, oneinch, hyperliquid
- Base classes: `base.ts` (CEX), `dex/` base with RPC sources

### Phase 2 — Bridges & Discovery (packages/bridge, packages/discovery)
- **Bridge adapters:** across, wormhole, lifi
- **Discovery workers:** cex-worker, dex-worker, bridge-worker
- Asset registry, venue registry, metadata resolver, scheduler

### Phase 3 — Persistence & Resilience
- `packages/persistence/src/schema.ts` — Supabase schema
- `packages/resilience/` — retry logic
- `packages/shared/src/` — auth, middleware, opportunity types
- `supabase/migrations/` — Phase 1 + Phase 3 SQL
- `packages/execution/` — audit-log, circuit-breaker, engine

### Packages Still In Progress
- `packages/api/` — scaffold present
- `packages/market-data/` — scaffold present
- `packages/observability/` — scaffold present
- `apps/frontend/` — scaffold present

## 3. GITHUB STATE

```
Latest commits:
  a450025 docs: add CODEX_ONBOARDING.md — project state and continuation guide for AI agents
  b8bbafc feat: add supabase environment setup
  aee9a5e feat: push complete phase 0-3
  07ec13d feat: add real-data arbitrage scan
  3c444cc feat: complete engine v1.0.0
```

Push all changes:
```bash
git -C C:/Users/User/Desktop/nova-app add .
git -C C:/Users/User/Desktop/nova-app commit -m "chore: sync"
git -C C:/Users/User/Desktop/nova-app push origin main
```

## 4. SUPABASE STATE

Files:
- `supabase/migrations/20260701000000_phase1_initial.sql` — discovered_pairs, opportunities, price_snapshots, executed_simulations
- `supabase/migrations/20260804000000_phase3_auth.sql` — auth tables
- `supabase/config.toml` — project_id, name
- `.env.example` — all required env vars
- `scripts/init-supabase.ts` — env validator + migration lister

Setup:
```bash
npx tsx scripts/init-supabase.ts   # creates .env from .env.example if missing
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## 5. HOW TO CONTINUE

### Immediate next steps
1. Fill `.env` with real Supabase + CEX API keys
2. Run Supabase migrations
3. Implement missing connector methods (fetchTicker, fetchOB)
4. Wire real connectors into `scripts/real-data-arbitrage-scan.ts`
5. Build backend REST API in `packages/api/`
6. Build frontend dashboard in `apps/frontend/`

### Architecture rules
- Engine package has NO knowledge of connectors
- Connectors implement `BaseCexConnector` / `BaseDexConnector`
- Strategies receive normalized snapshots
- All writes go through Supabase service-role key
- Keep `.env` out of git

### Testing
```bash
npx tsx scripts/test-engine-full.ts   # 72/72 passing
npx tsx scripts/real-data-arbitrage-scan.ts  # live scan
```

## 6. KEY FILES TO READ

- `packages/engine/src/index.ts` — engine exports
- `packages/engine/src/strategies/interface.ts` — strategy plugin contract
- `packages/connectors/src/cex/base.ts` — CEX base class
- `packages/connectors/src/dex/base.ts` — DEX base class
- `supabase/migrations/20260701000000_phase1_initial.sql` — data model
- `CODEX_ONBOARDING.md` — this file

## 7. CURRENT HANDOFF STATUS

- [x] Create comprehensive Codex onboarding document
- [x] Include phase 0-3 summary
- [x] Include GitHub state
- [x] Include Supabase state
- [x] Include how to continue
- [x] Push to GitHub
- [x] Report
