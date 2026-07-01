# DEX Connectors

**Document:** Phase 7 — DEX
**Cross-References:** [07_CONNECTOR_SPECIFICATION.md](07_CONNECTOR_SPECIFICATION.md), [08_MARKET_DATA_ENGINE.md](08_MARKET_DATA_ENGINE.md)

---

## 1. Overview

Decentralized exchange connectors for ARBITRAGE-PRO. Fetch on-chain prices via The Graph, RPC nodes, and DEX APIs.

**Key Properties:**
- Subgraph-based — Query on-chain events
- Multi-chain — Ethereum, BSC, Solana, L2s
- Real-time — WebSocket subscriptions
- Slippage-aware — Simulate DEX trades

---

## 2. Architecture

```
packages/connectors/src/dex/
├── index.ts              # Registry
├── uniswap-v3.ts         # Uniswap V3
├── uniswap-v4.ts         # Uniswap V4
├── pancakeswap-v3.ts     # PancakeSwap
├── aerodrome.ts          # Aerodrome (Base)
├── curve.ts              # Curve Finance
├── orca.ts               # Orca (Solana)
├── hyperliquid.ts        # Hyperliquid
├── subgraph-client.ts    # GraphQL client
└── rpc-client.ts         # RPC fallback
```

---

## 3. Uniswap V3

### 3.1 Subgraph Query

```graphql
query Pool($pool: String!) {
  pool(id: $pool) {
    id
    token0 { symbol, decimals }
    token1 { symbol, decimals }
    feeTier
    liquidity
    sqrtPrice
    tick
    token0Price
    token1Price
  }
}
```

### 3.2 Connector Implementation

```typescript
// packages/connectors/src/dex/uniswap-v3.ts
export class UniswapV3Connector implements Connector {
  readonly id = 'uniswap-v3';
  readonly kind: ConnectorKind = 'dex';
  readonly status: ConnectorStatus = 'active';
  
  private subgraph = createSubgraphClient('https://gateway.thegraph.com/api/[key]/subgraphs/id/...');
  private rpc = createRpcClient('https://eth-mainnet.g.alchemy.com/v2/[key]');
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    const poolAddress = this.getPoolAddress(symbol);
    if (!poolAddress) return null;
    
    const pool = await this.subgraph.query<Pool>(`
      query {
        pool(id: "${poolAddress.toLowerCase()}") {
          token0Price
          token1Price
          liquidity
          sqrtPrice
          tick
        }
      }
    `);
    
    if (!pool) return null;
    
    const price = this.parsePrice(pool, symbol);
    const liquidity = this.parseLiquidity(pool, symbol);
    
    return {
      bid: price * 0.999, // 1 bps spread
      ask: price * 1.001,
      bidQty: liquidity,
      askQty: liquidity,
      timestamp: Date.now(),
      exchange: this.getExchangeInfo(),
      symbol
    };
  }
  
  private parsePrice(pool: Pool, symbol: TradingPair): number {
    // sqrtPriceX96 to human price
    const sqrtPrice = BigInt(pool.sqrtPrice);
    const price = Number(sqrtPrice * sqrtPrice) / 2 ** 192;
    
    // Invert if token1 is base
    if (symbol.baseAsset === pool.token1.symbol) {
      return 1 / price;
    }
    
    return price;
  }
}
```

### 3.3 Pool Discovery

```typescript
private async discoverPools(): Promise<TradingPair[]> {
  const query = `
    query {
      pools(first: 1000, orderBy: totalValueLockedUSD, orderDirection: desc) {
        id
        token0 { symbol, decimals }
        token1 { symbol, decimals }
        feeTier
      }
    }
  `;
  
  const data = await this.subgraph.query<PoolDiscoveryResponse>(query);
  
  return data.pools.map(pool => ({
    baseAsset: pool.token0.symbol,
    quoteAsset: pool.token1.symbol,
    symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
    chain: 'ethereum',
    contractAddress: pool.id
  }));
}
```

---

## 4. PancakeSwap V3

### 4.1 Subgraph

```graphql
query {
  pools(first: 1000, orderBy: totalValueLocked, orderDirection: desc) {
    id
    token0 { symbol, decimals }
    token1 { symbol, decimals }
    feeTier
    liquidity
    sqrtPrice
  }
}
```

### 4.2 Connector

```typescript
export class PancakeSwapV3Connector implements Connector {
  readonly id = 'pancakeswap-v3';
  readonly kind: ConnectorKind = 'dex';
  
  private subgraph = createSubgraphClient('https://api.thegraph.com/subgraphs/...');
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    // Similar to Uniswap V3 but with PancakeSwap subgraph
  }
}
```

---

## 5. Aerodrome (Base)

### 5.1 Subgraph

```graphql
query {
  pools(first: 500) {
    id
    token0 { symbol }
    token1 { symbol }
    liquidity
    virtualPrice
  }
}
```

---

## 6. Curve Finance

### 6.1 Stablecoins

```typescript
export class CurveStablecoinConnector implements Connector {
  readonly id = 'curve-stablecoin';
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    // Curve uses StableSwap invariant
    // Price is close to 1:1 for stablecoins
    const pool = await this.getPool(symbol);
    
    return {
      bid: 0.999,
      ask: 1.001,
      bidQty: pool.liquidity,
      askQty: pool.liquidity,
      timestamp: Date.now(),
      exchange: this.getExchangeInfo(),
      symbol
    };
  }
}
```

---

## 7. Solana DEXes

### 7.1 Orca

```typescript
export class OrcaConnector implements Connector {
  readonly id = 'orca';
  readonly kind: ConnectorKind = 'dex';
  
  async fetchSnapshot(symbol: TradingPair): Promise<PriceSnapshot | null> {
    // Query Orca whirlpool
    const pool = await this.getWhirlpool(symbol);
    
    const price = this.sqrtPriceToPrice(pool.sqrtPrice);
    
    return {
      bid: price * 0.999,
      ask: price * 1.001,
      bidQty: pool.liquidity,
      askQty: pool.liquidity,
      timestamp: Date.now(),
      exchange: this.getExchangeInfo(),
      symbol
    };
  }
}
```

---

## 8. Testing

### 8.1 Unit Tests

```typescript
describe('UniswapV3Connector', () => {
  it('fetches price from subgraph', async () => {
    const connector = new UniswapV3Connector();
    const snapshot = await connector.fetchSnapshot({
      baseAsset: 'ETH',
      quoteAsset: 'USDC',
      symbol: 'ETH/USDC'
    });
    
    expect(snapshot).not.toBeNull();
    expect(snapshot!.bid).toBeGreaterThan(0);
  });
});
```

---

## 9. Acceptance Criteria

- [ ] Uniswap V3 connector functional
- [ ] PancakeSwap connector functional
- [ ] Subgraph queries working
- [ ] RPC fallback functional
- [ ] Pool discovery automated
- [ ] Tests pass (70% coverage)

## Engineering Notes

- Use subgraphs for historical data
- Use RPC for real-time prices
- Cache pool addresses
- Handle subgraph downtime
- Monitor pool liquidity