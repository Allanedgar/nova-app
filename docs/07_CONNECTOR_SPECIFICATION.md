# Connector Specification

**Document:** Phase 1 — Real Data
**Cross-References:** [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [08_MARKET_DATA_ENGINE.md](08_MARKET_DATA_ENGINE.md), [09_DISCOVERY_ENGINE.md](09_DISCOVERY_ENGINE.md)

---

## 1. Connector Architecture

### 1.1 Interface Definition

```typescript
// packages/shared/src/connector.ts
export interface Connector {
  readonly id: string;                    // 'binance', 'uniswap-v3', 'stargate'
  readonly kind: 'cex' | 'dex' | 'bridge';
  readonly status: ConnectorStatus;       // 'active' | 'degraded' | 'maintenance'
  
  fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null>;
  fetchStatus(): Promise<ConnectorHealth>;
}

export interface PriceSnapshot {
  readonly bid: number;                   // Best bid price
  readonly ask: number;                   // Best ask price
  readonly bidQty: number;                // Bid quantity
  readonly askQty: number;                // Ask quantity
  readonly timestamp: number;             // Unix timestamp (ms)
  readonly exchange: ExchangeInfo;
  readonly symbol: TradingPair;
}

export interface TradingPair {
  readonly baseAsset: string;             // 'BTC'
  readonly quoteAsset: string;            // 'USDT'
  readonly symbol: string;                // 'BTC/USDT'
  readonly chain?: string;                // 'ethereum', 'solana', etc.
  readonly contractAddress?: string;      // Token contract (DEX)
}

export interface ExchangeInfo {
  readonly code: string;                  // 'binance'
  readonly name: string;                  // 'Binance'
  readonly url: string;                   // 'https://binance.com'
  readonly rateLimit: number;             // ms between requests
  readonly takerFee: number;              // 0.001 = 10 bps
  readonly makerFee: number;
}

export type ConnectorStatus = 'active' | 'degraded' | 'maintenance';

export interface ConnectorHealth {
  readonly status: ConnectorStatus;
  readonly latencyMs: number;
  readonly lastError?: string;
  readonly checkedAt: number;
}
```

### 1.2 Connector Registry

```typescript
// packages/connectors/src/index.ts
export class ConnectorRegistry {
  private connectors: Map<string, Connector> = new Map();
  
  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
  }
  
  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }
  
  getByKind(kind: ConnectorKind): Connector[] {
    return Array.from(this.connectors.values()).filter(
      c => c.kind === kind && c.status === 'active'
    );
  }
  
  async loadMarketSnapshots(
    symbols: TradingPair[],
    enabledIds: string[]
  ): Promise<PriceSnapshot[]> {
    const connectors = enabledIds
      .map(id => this.connectors.get(id))
      .filter((c): c is Connector => c !== undefined && c.status === 'active');
    
    const results = await Promise.allSettled(
      symbols.map(symbol =>
        Promise.allSettled(
          connectors.map(c => c.fetchSnapshot(symbol))
        )
      )
    );
    
    return results.flatMap(r =>
      r.status === 'fulfilled'
        ? r.value.filter((r): r is PriceSnapshot => r.status === 'fulfilled').map(r => r.value)
        : []
    );
  }
}
```

### 1.3 Rate Limiting

```typescript
// packages/connectors/src/rate-limiter.ts
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  
  async acquire(connectorId: string, limit: number, windowMs: number): Promise<void> {
    const bucket = this.getOrCreate(connectorId, limit, windowMs);
    await bucket.acquire();
  }
}

class TokenBucket {
  constructor(
    private capacity: number,
    private refillRate: number,
    private tokens: number = capacity,
    private lastRefill: number = Date.now()
  ) {}
  
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    await new Promise(resolve => setTimeout(resolve, this.getWaitMs()));
    return this.acquire();
  }
}
```

---

## 2. CEX Connectors

### 2.1 Tier 1 Exchanges (Phase 1)

| Exchange | Volume | API | CCXT ID | Rate Limit | Implementation |
|---|---|---|---|---|---|
| Binance | ~$8.5B/day | REST + WS | `binance` | 1200 req/min | [binance/rest.ts](connectors/src/binance/rest.ts) |
| OKX | ~$6B/day | REST + WS | `okx` | 600 req/min | [okx/rest.ts](connectors/src/okx/rest.ts) |
| Kraken | ~$1.2B/day | REST + WS | `kraken` | 300 req/min | [kraken/rest.ts](connectors/src/kraken/rest.ts) |
| Coinbase | ~$1.6B/day | REST + WS | `coinbase` | 600 req/min | Phase 2 |
| Bybit | ~$4.2B/day | REST + WS | `bybit` | 120 req/min | Phase 2 |

### 2.2 Implementation Pattern (CCXT-based)

```typescript
// packages/connectors/src/binance/rest.ts
import ccxt from 'ccxt';
import type { Connector, PriceSnapshot, TradingPair, ExchangeInfo } from '@arbitrage-pro/shared';

export class BinanceRestConnector implements Connector {
  readonly id = 'binance';
  readonly kind: ConnectorKind = 'cex';
  readonly status: ConnectorStatus = 'active';
  
  private exchange: ccxt.binance;
  
  constructor() {
    this.exchange = new ccxt.binance({
      enableRateLimit: true,
      options: { defaultType: 'spot' }
    });
  }
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol.symbol);
      
      return {
        bid: ticker.bid,
        ask: ticker.ask,
        bidQty: ticker.bidVolume,
        askQty: ticker.askVolume,
        timestamp: ticker.timestamp,
        exchange: this.getExchangeInfo(),
        symbol
      };
    } catch (error) {
      logger.warn({ exchange: this.id, symbol: symbol.symbol, error }, 'Failed to fetch snapshot');
      return null;
    }
  }
  
  private getExchangeInfo(): ExchangeInfo {
    return {
      code: 'binance',
      name: 'Binance',
      url: 'https://binance.com',
      rateLimit: 50, // ms between requests
      takerFee: 0.001, // 10 bps
      makerFee: 0.0002 // 2 bps
    };
  }
  
  async fetchStatus(): Promise<ConnectorHealth> {
    try {
      const start = Date.now();
      await this.exchange.fetchTime();
      return {
        status: 'active',
        latencyMs: Date.now() - start,
        checkedAt: Date.now()
      };
    } catch (error) {
      return {
        status: 'degraded',
        latencyMs: -1,
        lastError: error.message,
        checkedAt: Date.now()
      };
    }
  }
}
```

### 2.3 Tier 2 Exchanges (Phase 2-3)

| Exchange | Volume | API | CCXT ID | Notes |
|---|---|---|---|---|
| Bitget | ~$3.1B/day | REST + WS | `bitget` | Copy trading |
| KuCoin | ~$5.3B/day | REST + WS | `kucoin` | Wide altcoin |
| MEXC | top derivatives | REST | `mexc` | 1000 req/min |
| Gate.io | top tier | REST | `gate` | 100 req/10s |
| Bitfinex | long-tail | REST + WS | `bitfinex` | Pro-grade |
| Crypto.com | ~$480M/day | REST | `crypto` | Visa ecosystem |
| HTX | top tier | REST | `htx` | Renamed from Huobi |
| Bitstamp | ~$200M/day | REST + WS | `bitstamp` | EU-focused |
| Phemex | derivatives | REST | `phemex` | Low fees |
| LBank | mid-tier | REST | `lbank` | Altcoin focus |
| Poloniex | legacy | REST | `poloniex` | US-compliant |
| BingX | growing | REST + WS | `bingx` | Copy trading |

---

## 3. DEX Connectors

### 3.1 Tier 1 DEXes (Phase 7)

| DEX | 24h Volume | Chains | API | Implementation |
|---|---|---|---|---|
| Uniswap V4 | ~$762M | 14+ | The Graph + RPC | Phase 7 |
| Uniswap V3 | ~$583M | 30+ | The Graph | Phase 7 |
| Aerodrome | ~$486M | Base | The Graph | Phase 7 |
| PancakeSwap V3 | ~$477M | 6+ | The Graph | Phase 7 |
| Hyperliquid | ~$270M | Hyperliquid L1 | Custom API | Phase 7 |
| Orca | ~$254M | Solana | Direct RPC | Phase 7 |

### 3.2 Implementation Pattern (Subgraph-based)

```typescript
// packages/connectors/src/dex/uniswap-v3.ts
import { createClient } from '@graphql-request/client';
import type { Connector, PriceSnapshot, TradingPair } from '@arbitrage-pro/shared';

export class UniswapV3Connector implements Connector {
  readonly id = 'uniswap-v3';
  readonly kind: ConnectorKind = 'dex';
  readonly status: ConnectorStatus = 'active';
  
  private client = createClient({
    url: 'https://gateway.thegraph.com/api/[api-key]/subgraphs/id/...'
  });
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    const QUERY = `
      query Pool($pool: String!) {
        pool(id: $pool) {
          token0Price
          token1Price
          liquidity
          sqrtPrice
          tick
        }
      }
    `;
    
    const data = await this.client.request<PoolData>(QUERY, {
      pool: this.getPoolAddress(symbol)
    });
    
    if (!data.pool) return null;
    
    const price = this.sqrtPriceToPrice(
      data.pool.sqrtPrice,
      symbol.baseAsset,
      symbol.quoteAsset
    );
    
    return {
      bid: price * 0.999, // 1 bps spread
      ask: price * 1.001,
      bidQty: data.pool.liquidity,
      askQty: data.pool.liquidity,
      timestamp: Date.now(),
      exchange: this.getExchangeInfo(),
      symbol
    };
  }
  
  private sqrtPriceToPrice(sqrtPriceX96: string, base: string, quote: string): number {
    // Uniswap V3 sqrtPriceX96 math
    const sqrtPrice = BigInt(sqrtPriceX96);
    const price = Number(sqrtPrice * sqrtPrice) / 2 ** 192;
    return price;
  }
}
```

### 3.3 Tier 2 DEXes (Phase 7-8)

| DEX | Type | Notes |
|---|---|---|
| Curve Finance | Stable AMM | Stableswap invariant |
| 1inch | Aggregator | Best route |
| SushiSwap | V2 AMM | Multi-chain |
| Balancer V2 | Weighted pools | Custom weights |
| PancakeSwap Infinity | V3 | BSC-focused |
| Raydium | Solana AMM | OpenBook |
| dYdX | Order book | Perpetuals |
| GMX | Perpetuals | Arbitrum |
| Velodrome | Optimism | V2-style |
| Trader Joe | Avalanche | V2-style |
| Camelot | Arbitrum | V2-style |
| SyncSwap | zkSync | V2-style |

---

## 4. Bridge Connectors

### 4.1 Tier 1 Bridges (Phase 7)

| Bridge | 24h Volume | Type | API | Implementation |
|---|---|---|---|---|
| USDT0 | ~$21M | OFT (LayerZero) | LayerZero Scan | Phase 7 |
| Mayan | ~$16M | Intent-based | Mayan API | Phase 7 |
| Across | ~$14M | Optimistic | REST API | Phase 2 (already done) |
| Stargate | ~$3M | LayerZero | `/v2/busMessage` | Phase 7 |
| Wormhole | ~$2M | Guardian | Guardian API | Phase 7 |
| deBridge | ~$5.3M | Intent-based | DLN API | Phase 7 |

### 4.2 Implementation Pattern

```typescript
// packages/connectors/src/bridge/stargate.ts
import type { Connector, BridgeQuote, Chain } from '@arbitrage-pro/shared';

export interface BridgeQuote {
  readonly fromChain: Chain;
  readonly toChain: Chain;
  readonly token: string;
  readonly amount: number;
  readonly fee: number;           // in basis points
  readonly estimatedTime: number; // seconds
  readonly route: string;
}

export class StargateBridgeConnector implements Connector {
  readonly id = 'stargate';
  readonly kind: ConnectorKind = 'bridge';
  readonly status: ConnectorStatus = 'active';
  
  async getBridgeQuote(
    fromChain: Chain,
    toChain: Chain,
    token: string,
    amount: number
  ): Promise<BridgeQuote | null> {
    const response = await fetch(
      `https://stargate-api.com/v2/busMessage?srcChain=${fromChain.id}&dstChain=${toChain.id}&token=${token}&amount=${amount}`
    );
    
    const data = await response.json();
    
    return {
      fromChain,
      toChain,
      token,
      amount,
      fee: data.feeBps,
      estimatedTime: data.estimatedTimeSeconds,
      route: data.route
    };
  }
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    // Bridges don't provide price snapshots
    return null;
  }
}
```

### 4.3 Tier 2 Bridges (Phase 8+)

| Bridge | Type | Notes |
|---|---|---|
| Hyperlane | Mailbox | Custom chains |
| Axelar | Mailbox | AWS chain |
| LayerZero | OFT | Same as USDT0 |
| Hop Protocol | AMM | Ethereum L2s |
| CCIP | Oracle | Chainlink |
| Relay | Cross-chain lending | Novel model |
| Rhino | Aggregator | Multi-bridge |
| Symbiosis | AMM | Floating rate |
| Polygon Bridge | Plasma | Legacy |
| Arbitrum Bridge | Native L2 | Fast |
| Optimism Bridge | Native L2 | Fast |
| Base Bridge | Native L2 | New |

---

## 5. Auto-Discovery

### 5.1 Pair Discovery

```typescript
// packages/connectors/src/discovery/pair-discovery.ts
export class PairDiscovery {
  async discoverPairs(connector: Connector): Promise<TradingPair[]> {
    switch (connector.kind) {
      case 'cex':
        return this.discoverCexPairs(connector);
      case 'dex':
        return this.discoverDexPairs(connector);
      default:
        return [];
    }
  }
  
  private async discoverCexPairs(connector: Connector): Promise<TradingPair[]> {
    const markets = await fetchMarkets(connector.id);
    return markets
      .filter(m => m.active && m.spot)
      .map(m => ({
        baseAsset: m.base,
        quoteAsset: m.quote,
        symbol: m.symbol,
        chain: undefined,
        contractAddress: undefined
      }));
  }
}
```

### 5.2 Discovery Schedule

- **Frequency:** Every 5 minutes
- **Trigger:** App startup, webhook notifications
- **Storage:** `discovered_pairs` table
- **TTL:** 24 hours (refresh even if no changes)

```sql
CREATE TABLE IF NOT EXISTS discovered_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id TEXT NOT NULL,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  symbol TEXT NOT NULL,
  chain TEXT,
  contract_address TEXT,
  status TEXT DEFAULT 'active', -- 'active' | 'delisted' | 'paused'
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_observed_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(connector_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_discovered_pairs_connector ON discovered_pairs(connector_id);
CREATE INDEX IF NOT EXISTS idx_discovered_pairs_status ON discovered_pairs(status);
```

---

## 6. Testing

### 6.1 Unit Tests (Contract Test)

```typescript
// packages/connectors/src/binance/__tests__/rest.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { BinanceRestConnector } from '../rest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.binance.com/api/v3/ticker/bookTicker', () =>
    HttpResponse.json({
      symbol: 'BTCUSDT',
      bidPrice: '60000.10',
      bidQty: '1.5',
      askPrice: '60000.20',
      askQty: '2.1'
    })
  )
);

describe('BinanceRestConnector', () => {
  const connector = new BinanceRestConnector();
  
  it('returns a snapshot', async () => {
    const snapshot = await connector.fetchSnapshot({
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      symbol: 'BTC/USDT'
    });
    
    expect(snapshot).not.toBeNull();
    expect(snapshot?.bid).toBe(60000.10);
    expect(snapshot?.ask).toBe(60000.20);
    expect(snapshot?.exchange.code).toBe('binance');
  });
  
  it('returns null on error', async () => {
    server.use(
      http.get('https://api.binance.com/api/v3/ticker/bookTicker', () =>
        HttpResponse.error()
      )
    );
    
    const snapshot = await connector.fetchSnapshot({
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      symbol: 'BTC/USDT'
    });
    
    expect(snapshot).toBeNull();
  });
});
```

### 6.2 Integration Tests

```typescript
// packages/connectors/test/integration/binance.integration.spec.ts
describe('Binance Integration', () => {
  it('connects to live API', async () => {
    const connector = new BinanceRestConnector();
    const snapshot = await connector.fetchSnapshot({
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      symbol: 'BTC/USDT'
    });
    
    expect(snapshot).not.toBeNull();
    expect(snapshot!.bid).toBeGreaterThan(0);
    expect(snapshot!.ask).toBeGreaterThan(snapshot!.bid);
  }, 10000); // 10s timeout
});
```

---

## 7. Acceptance Criteria

- [ ] 5 CEX connectors implemented (Binance, OKX, Kraken, Coinbase, Bybit)
- [ ] All connectors implement `Connector` interface
- [ ] Rate limiting enforced per exchange
- [ ] Auto-discovery finds 70+ pairs
- [ ] Unit tests pass for all connectors
- [ ] Integration tests pass against live APIs
- [ ] Circuit breaker on 5 consecutive failures
- [ ] Health check returns status within 100ms

## Engineering Notes

- Use CCXT for CEX to avoid maintaining 50+ exchange implementations
- DEX connectors are custom (The Graph + RPC)
- Bridge connectors are custom per protocol
- All connectors must handle rate limits gracefully
- Discovered pairs stored in DB with TTL