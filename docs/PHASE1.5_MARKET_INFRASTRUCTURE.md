# Phase 1.5 — Market Infrastructure

> **Status:** 🟡 Planning complete. Sprints 1–5 below; do not start Detection Engine v2 (Phase 2) until **all** Sprints 1–5 are merged and verified.

This milestone covers everything that turns the platform from "one connector stub + one persistence layer" into a complete market-data foundation. The detection engine consumes this layer — it never talks to a venue directly. Therefore, every gap in the data layer becomes a gap in the engine, and a wrong number in the data layer becomes a wrong trade in production.

## Why a separate milestone

The original Phase 1 numbering had gaps (1.4, 1.5, 1.6, 1.9, 1.11) and mixed "real CEX" with "discovery" and "auth". Grouping the remaining connector + discovery + registry + aggregator work under a single Phase 1.5 milestone:

- Makes the roadmap legible
- Forces a single quality bar across all venues
- Groups the work that depends on the same shared interfaces
- Inserts a hard gate before Phase 2 (Detection Engine v2) so the engine is never built on a partial data layer

## What this milestone produces

A complete, verified market data platform consisting of:

1. **Tier-1 CEX connectors** — 20 venues, each implementing the full `Connector` interface (see below).
2. **Tier-1 DEX connectors** — 20 venues, with the SDK → API → Subgraph → RPC fallback ladder.
3. **Top-20 Bridge connectors** — quotes, ETAs, route discovery, fee schedules.
4. **Dynamic Discovery Engine** — no hardcoded assets, scheduler + workers + cache + incremental updates + new-listing + delisting + contract-based identity.
5. **Asset Registry** — canonical asset identity, decimals, wrapped status, bridge mapping, listing status, first/last seen.
6. **Venue Registry** — venue metadata, supported assets, deposit/withdrawal status, fee schedule, API version, health score, rate limits.
7. **Market Snapshot Aggregator** — the single source of truth for the engine, with bid/ask/last/spread/depth/volume/timestamp/latency/fees/chain/venue/confidence.

## The `Connector` interface (post-Phase-1.5)

Every venue — CEX, DEX, or bridge — must implement this surface. The Phase 1 `Connector` interface from `packages/shared/src/connector.ts` (commit `13f5e86`) is the starting point; Phase 1.5 extends it with the methods listed below.

```ts
export interface Connector {
  readonly id: string;
  readonly kind: 'cex' | 'dex' | 'bridge';
  readonly info: ExchangeInfo;

  // Discovery
  fetchMarkets(): Promise<readonly Market[]>;
  discoverAssets(): Promise<readonly DiscoveredPairRow[]>;

  // Pricing
  fetchTicker(pair: TradingPair): Promise<PriceSnapshot | null>;
  fetchOrderBook(pair: TradingPair, depth?: number): Promise<OrderBook | null>;
  fetchTrades(pair: TradingPair, sinceMs?: number): Promise<readonly Trade[]>;

  // Cost
  fetchFees(): Promise<FeeSchedule>;
  fetchExchangeInfo(): Promise<ExchangeInfo>;

  // Health
  fetchNetworkStatus(): Promise<NetworkStatus>;
  health(): Promise<ConnectorHealth>;
}
```

Where:
- `Market` = venue-specific symbol + base/quote + listing status
- `OrderBook` = L2 bid/ask ladder
- `Trade` = a single fill (timestamp, price, qty, side)
- `FeeSchedule` = per-tier maker/taker fees, withdrawal fees
- `NetworkStatus` = venue-wide status (deposits paused, withdrawals paused, maintenance)
- `NetworkStatus` and `health()` together drive the per-venue health score

The existing `fetchSnapshot(pair)` from Phase 1 becomes a thin wrapper over `fetchTicker` (single-source, backward compatible).

## Per-connector test policy (HARD)

Every connector must have **offline tests** — no live network calls in CI. This is enforced by:

1. The test file must construct a connector with an injected `fetchImpl: typeof fetch` and run all 9 methods through mocked responses.
2. The test must cover: success path, HTTP 429, HTTP 5xx, network throw, malformed JSON, auth failure (where applicable), rate-limit header handling.
3. Symbol mapping round-trips (e.g. `BTC/USDT ↔ BTCUSDT ↔ BTC-USD`).
4. Live-network smoke test (manual, gated by `*_LIVE=1` env) — never on CI.

The `@connectors` `pnpm lint --max-warnings 0` and `pnpm test` must both pass green for a connector to be considered merged.

## Sprint breakdown

The CEO Directive lays out this order. Each sprint ships a verifiable commit on `main` of `Allanedgar/nova-app`.

### Sprint 1 — Apply Supabase migration (DONE 2026-07-01)

Apply the migration we shipped in commit `13f5e86` against the live `nova-app` Supabase project (`fnyvalaoaxnwjejrxyzb`). This makes Phase 1 end-to-end runnable against real storage.

### Sprint 2 — OKX connector

- New file: `packages/connectors/src/cex/okx.ts`
- Implements the full `Connector` interface
- Symbol mapping: `BTC-USDT` (OKX's separator is `-`)
- Auth: HMAC-signed requests, passphrase required
- Injectable `fetchImpl` + `clock` + `sign` (so tests can verify the signature path)
- Tests: all 9 methods, all failure modes, signature round-trip
- `vitest --max-warnings 0` clean
- Bumps `NOVA_CONNECTORS_VERSION`

### Sprint 3 — Kraken connector

- New file: `packages/connectors/src/cex/kraken.ts`
- Symbol mapping: Kraken's `XBT` for `BTC`, and `ZUSD` for `USDT` — this is the canonical `XBT ↔ BTC` test case for `@tokeniq`'s symbol normalization
- Auth: nonce-based HMAC, message = `nonce + body`
- Tests: XBT round-trip, all 9 methods, all failure modes
- `vitest --max-warnings 0` clean

### Sprint 4 — All 20 Tier-1 CEX connectors

Bybit, Bitget, KuCoin, Gate.io, MEXC, Coinbase Advanced, HTX, Bitfinex, Bitstamp, Crypto.com, WhiteBIT, BingX, Phemex, LBank, Poloniex, Backpack, Gemini.

Per the connector test policy above. Each connector ships as a single `packages/connectors/src/cex/<name>.ts` file plus a parallel `__tests__/<name>.spec.ts`. Sprints 2 and 3 above are the templates — the rest are mechanical ports.

### Sprint 5 — DEX connector framework + initial DEXes

- Abstract `DexConnector` extends `Connector` with pool discovery, token discovery, liquidity, TVL, fee tiers, pool metadata, dynamic pagination
- Fallback priority per directive: Official SDK → Official API → GraphQL Subgraph → RPC
- Initial DEXes: Uniswap V3, Uniswap V4, PancakeSwap V3, Curve, Balancer, Aerodrome, Sushi, Raydium, Orca, 1inch, Hyperliquid Spot, dYdX, GMX
- Dynamic pagination is mandatory — no hardcoded page counts

### Beyond Sprint 5 (Phase 1.5 closeout)

- **Top-20 Bridge connectors** — Stargate, Across, USDT0, Mayan, deBridge, Polygon Bridge, Arbitrum Bridge, Hop, Hyperlane, Axelar, LayerZero, Relay, Rhino, Symbiosis, Wormhole, CCIP, Butter
- **Dynamic Discovery Engine** — `packages/connectors/src/assets/{discovery-scheduler,discovery-cache,discovery-worker,pagination}.ts` (this is where the 4-layer fan-out + scheduler + cache lives)
- **Asset Registry** — `packages/registry/src/asset-registry.ts` — canonical `AssetDescriptor` keyed by `(chain, contract)`, with bridge mapping
- **Venue Registry** — `packages/registry/src/venue-registry.ts` — venue metadata + per-venue health + rate limits
- **Market Snapshot Aggregator** — `packages/engine/src/aggregator.ts` — single source of truth; produces `MarketSnapshot` with bid/ask/last/spread/depth/volume/timestamp/latency/fees/chain/venue/confidence

## Phase 2 — Detection Engine v2 (gated on Phase 1.5 close)

The engine is allowed to start only when:
- All Sprints 1–5 merged to `main` on `Allanedgar/nova-app`
- All 20 CEX + all 20 DEX + all 20 bridge connectors green
- Asset + Venue registries populated from real discovery
- Aggregator has replayed a real 24h dataset with no missing-data gaps

When those gates pass, the engine implements the validation pipeline in the directive:
```
Asset Identity
↓ Snapshot Validation
↓ Bid/Ask Validation   ← never use Last Price
↓ Fee Calculation
↓ Gas Estimation
↓ Bridge Cost
↓ Liquidity Validation
↓ Slippage Estimation
↓ Expected Net Profit
↓ Risk Score
↓ Confidence Score
↓ Ranking
↓ Expiration
↓ Persistence
```

## Director activation for Phase 1.5

| Director | Owns | Phase 1.5 role |
|---|---|---|
| **@mercury** 🟢 Active | CEX | Owns the 20 CEX connectors (Sprints 2, 3, 4) |
| **@neptune** 🟡 Standby → activate | DEX | Owns the 20 DEX connectors (Sprint 5+) |
| **@bridgemaster** 🟡 Standby → activate | Bridges | Owns the 20 bridge connectors |
| **@discovery** 🟢 Active | Discovery Engine | Owns the Dynamic Discovery Engine |
| **@tokeniq** 🟢 Active | Asset Registry | Owns the Asset Registry + symbol normalization |
| **@orderbook** 🟡 Standby → activate | Liquidity | Owns the depth/slippage math the Aggregator needs |
| **@apollo** 🟡 Standby → activate | Arbitrage | Owns Phase 2 Detection Engine (gated on Phase 1.5 close) |
| **@aegis** 🟡 Standby → activate | Risk | Owns the risk score in Phase 2's pipeline |
| **@atlas** 🟢 Active | Architecture | Owns the Connector interface evolution |
| **@sentinel** 🟡 Standby → activate | Security | Owns the per-venue auth + secret handling review |
| **@titan** 🟢 Active | Database | Owns the migration follow-ups (Phase 3 auth) |

Activation happens in this commit, in the existing `ORGANIZATIONAL-STRUCTURE.md`.
