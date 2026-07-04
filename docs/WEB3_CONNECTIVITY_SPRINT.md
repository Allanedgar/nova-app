# Web3 Connectivity Sprint

*Purpose: Make all 20 DEX and 20 bridge connectors pass live integration tests*

## Sprint Goal
Every connector must:
1. Connect to an official, working public endpoint
2. Return real data without Cloudflare/HTML errors
3. Pass both offline unit tests AND live integration tests
4. Handle authentication, pagination, rate limits, and network failures

## Sprint Plan

### Phase A: CEX Hardening (already passing — 5/5)
- [x] Binance — 3,625 markets ✅
- [x] OKX — 1,278 markets ✅
- [x] Kraken — 1,506 markets ✅
- [x] Coinbase — 829 markets ✅
- [x] Bybit — 598 markets ✅
- Remaining 15 CEX connectors need similar per-exchange extraction configs

### Phase B: DEX Connectivity (required fixes)
| DEX | Status | Fix Required |
|---|---|---|
| Uniswap V3 | ❌ HTML response | Use public RPC endpoint + factory contract events |
| Uniswap V2 | ❌ HTML response | Use same RPC approach |
| Uniswap V4 | ❌ HTML response | Use same RPC approach |
| PancakeSwap | ⚠️ API key needed | Use official PancakeSwap API v3 |
| Curve | ✅ Connected | Subgraph alternative may improve latency |
| Balancer | ❌ fetch failed | Use Balancer API v2 / RPC |
| SushiSwap | ❌ HTML response | Use Sushi API v2 |
| Aerodrome | ❌ Not tested | Use Aerodrome API / on-chain |
| Raydium | ❌ Not tested | Use Raydium API v3 |
| Orca | ❌ Not tested | Use Orca API |
| Trader Joe | ❌ Not tested | Use official API |
| Camelot | ❌ Not tested | Use Camelot subgraph |
| Velodrome | ❌ Not tested | Use Velodrome subgraph |
| SyncSwap | ❌ Not tested | Use zkSync RPC + SyncSwap contract |
| Hyperliquid Spot | ❌ Not tested | Use Hyperliquid API |
| dYdX | ❌ Not tested | Use dYdX API v4 |
| 1inch | ❌ Not tested | Use 1inch API v5 |
| GMX | ❌ Not tested | Use GMX subgraph |
| Cetus | ❌ Not tested | Use Cetus SDK |
| Thruster | ❌ Not tested | Use Thruster subgraph |

### Phase C: Bridge Connectivity (required fixes)
| Bridge | Status | Fix Required |
|---|---|---|
| Wormhole | ✅ Connected | Operations API works |
| Relay | ✅ Connected | Chains API works |
| Across | ⚠️ HTTP 400 | Add required query params |
| Axelar | ⚠️ HTTP 500 | Use correct endpoint path |
| Stargate | ❌ HTML response | Use Stargate API v2 |
| LayerZero | ❌ HTML response | Use LayerZero API v2 |
| Hyperlane | ❌ Not tested | Use Hyperlane API |
| deBridge | ❌ parse error | Use correct API path |
| Hop | ❌ HTML response | Use Hop API v2 |
| CCIP | ❌ HTML response | Use CCIP REST API |
| Polygon Bridge | ❌ Not tested | Use Polygon API |
| Arbitrum Bridge | ❌ Not tested | Use Arbitrum API |
| Optimism Bridge | ❌ Not tested | Use Optimism API |
| Base Bridge | ❌ Not tested | Use Base API |
| Mayan | ❌ Not tested | Use Mayan API |
| Butter | ❌ Not tested | Use Butter API |
| USDT0 | ❌ Not tested | Use USDT0 API |
| CCTP | ❌ HTML response | Use Circle API v1 |
| Rhino | ❌ Not tested | Use Rhino API |
| Symbiosis | ❌ Not tested | Use Symbiosis API |

### Phase D: Implement & Verify
Will implement connectors in batches using verified endpoints.

**Connector Implementation Pattern:**
```typescript
// Each connector must:
1. Accept auth config (API key, headers) in constructor/options
2. Use official documented endpoint
3. Implement pagination (cursor or offset)
4. Implement exponential retry via @nova-app/resilience
5. Support rate limiting (per-second budget)
6. Return typed responses matching the shared schema