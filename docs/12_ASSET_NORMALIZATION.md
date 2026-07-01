**See also:** [07_CONNECTOR_SPECIFICATION.md](07_CONNECTOR_SPECIFICATION.md), [09_DISCOVERY_ENGINE.md](09_DISCOVERY_ENGINE.md), [14_DATABASE_SCHEMA.md](14_DATABASE_SCHEMA.md)
# Asset Normalization

**Document:** Phase 2 — Detection v2
**Cross-References:** [09_DISCOVERY_ENGINE.md](09_DISCOVERY_ENGINE.md), [10_ARBITRAGE_ENGINE.md](10_ARBITRAGE_ENGINE.md)

---

## 1. Overview

Asset normalization converts exchange-specific symbols, contract addresses, and chain identifiers into canonical forms. This enables cross-exchange arbitrage by ensuring BTC/XBT/WBTC all resolve to the same base asset.

**Key Properties:**
- Symbol normalization — Handles exchange-specific variants
- Identity resolution — Maps wrapped/bridged assets to canonical
- Contract resolution — Resolves token addresses across chains
- Metadata enrichment — Adds logos, decimals, market data

---

## 2. Symbol Normalization

### 2.1 Rules

| Exchange Symbol | Canonical | Type |
|---|---|---|
| BTC, XBT, WBTC | BTC | Native/Wrapped |
| ETH, WETH | ETH | Native/Wrapped |
| USDT, TETHER, USDTE | USDT | Stablecoin |
| USDC, USD-C, USDC.E | USDC | Stablecoin |
| DAI, MCDAI | DAI | Stablecoin |
| SOL, SOL-SPL | SOL | Native |
| BNB, BNB-BSC | BNB | Native |

```typescript
// packages/connectors/src/discovery/normalizer.ts
const NORMALIZATION_RULES = new Map([
  ['XBT', 'BTC'],
  ['WBTC', 'BTC'],
  ['WETH', 'ETH'],
  ['TETHER', 'USDT'],
  ['USDTE', 'USDT'],
  ['USD-C', 'USDC'],
  ['MCDAI', 'DAI'],
  ['SOL-SPL', 'SOL'],
  ['BNB-BSC', 'BNB']
]);

export function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  return NORMALIZATION_RULES.get(upper) ?? upper;
}
```

### 2.2 Edge Cases

```typescript
// Handle compound symbols
'ETH/USDT' → base='ETH', quote='USDT'
'WBTC/USDC' → base='BTC', quote='USDC'
'XBTUSDT'   → base='BTC', quote='USDT' (no slash)
```

---

## 3. Asset Identity

### 3.1 Asset Classes

```typescript
export type AssetClass = 
  | 'native'           // BTC, ETH, SOL - chain-native
  | 'wrapped-1to1'     // WBTC, WETH - 1:1 backed
  | 'bridged'          // USDT on BSC - different contract
  | 'stable-quote'     // USDT, USDC, DAI - pegged
  | 'synthetic'        // sBTC, sETH - derivative
  | 'unknown';
```

### 3.2 Identity Resolution

```typescript
export interface AssetIdentity {
  readonly type: AssetClass;
  readonly canonical: string;     // 'BTC'
  readonly bridges: string[];     // ['wbtc', 'renbtc']
  readonly chain: string;         // 'ethereum'
  readonly contractAddress?: string;
}

export function resolveAssetIdentity(base: string, chain?: string): AssetIdentity {
  // Native assets
  if (chain && isNativeAsset(base, chain)) {
    return { type: 'native', canonical: base, bridges: [], chain };
  }
  
  // Wrapped assets
  if (base.startsWith('W') && NATIVE_ASSETS.has(base.slice(1))) {
    const canonical = base.slice(1);
    return { type: 'wrapped-1to1', canonical, bridges: [base.toLowerCase()], chain };
  }
  
  // Stablecoins
  if (STABLECOINS.has(base)) {
    return { type: 'stable-quote', canonical: base, bridges: [], chain };
  }
  
  // Default
  return { type: 'unknown', canonical: base, bridges: [], chain };
}
```

---

## 4. Cross-Chain Identity

### 4.1 Same Asset, Different Chains

```
USDT exists on:
- Ethereum: 0xdac17f958d2ee523a2206206994597c13d831ec7
- BSC: 0x55d398326f99059ff775485246999027b3197955
- Arbitrum: 0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9
- Solana: Es9vMFrzaCERmJfrF4H2QUdUGnQX7mLsGFgm24BfMati

All resolve to canonical: 'USDT'
```

### 4.2 Bridged vs Wrapped

| Asset | Type | Backing | Risk |
|---|---|---|---|
| WBTC | Wrapped 1:1 | BTC custodied by BitGo | Medium (custodial) |
| renBTC | Bridged | RenVM protocol | High (protocol risk) |
| USDT on BSC | Bridged | Tether treasury | Medium (different contract) |
| WETH | Wrapped 1:1 | ETH locked in contract | Low (trustless) |

---

## 5. Contract Resolution

### 5.1 Known Contracts

```typescript
const KNOWN_CONTRACTS: Record<string, Record<string, string>> = {
  'USDT': {
    'ethereum': '0xdac17f958d2ee523a2206206994597c13d831ec7',
    'bsc': '0x55d398326f99059ff775485246999027b3197955',
    'arbitrum': '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    'polygon': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    'optimism': '0x94b008aae0057cffebd7e7ffa232c06d603514ac'
  },
  'USDC': {
    'ethereum': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    'bsc': '0x8ac76a51cc9509895c4b3c8748388a76d7929851',
    'arbitrum': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    'polygon': '0x3c499c4ce5e0bb06e2154003196f7e3e842d4bb1',
    'optimism': '0x7f5c764cbc6142402e69360b17fc7796f30cc12e'
  }
};
```

### 5.2 Dynamic Resolution

```typescript
export class ContractResolver {
  async resolve(symbol: string, chain: string): Promise<string | null> {
    // 1. Check known contracts
    const known = KNOWN_CONTRACTS[symbol]?.[chain];
    if (known) return known;
    
    // 2. Query The Graph
    const query = `
      query Token($symbol: String!, $chain: String!) {
        tokens(where: { symbol: $symbol, chain: $chain }) {
          id
        }
      }
    `;
    
    try {
      const result = await this.graphClient.request<TokenResponse>(query, {
        symbol,
        chain
      });
      
      return result.tokens[0]?.id ?? null;
    } catch {
      return null;
    }
  }
}
```

---

## 6. Metadata Enrichment

### 6.1 Metadata Sources

```typescript
export interface AssetMetadata {
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly logoUrl: string;
  readonly coingeckoId: string;
  readonly priceUsd: number;
  readonly marketCap: number;
  readonly volume24h: number;
}

export class MetadataResolver {
  async resolve(asset: AssetDescriptor): Promise<AssetMetadata> {
    // Try CoinGecko
    const coingeckoId = await this.getCoinGeckoId(asset);
    if (coingeckoId) {
      return this.fetchFromCoinGecko(coingeckoId);
    }
    
    // Fallback to minimal metadata
    return {
      name: asset.baseAsset,
      symbol: asset.symbol,
      decimals: 18,
      logoUrl: '/assets/default.png',
      coingeckoId: '',
      priceUsd: 0,
      marketCap: 0,
      volume24h: 0
    };
  }
}
```

### 6.2 Decimal Handling

```typescript
export function getDecimals(asset: string, chain?: string): number {
  const DECIMALS: Record<string, number> = {
    'BTC': 8,
    'ETH': 18,
    'USDT': 6,
    'USDC': 6,
    'DAI': 18,
    'SOL': 9,
    'BNB': 18
  };
  
  return DECIMALS[asset] ?? 18;
}
```

---

## 7. Cross-Exchange Pair Matching

### 7.1 Pair Normalization

```typescript
export function normalizePair(input: string, exchangeId: string): TradingPair {
  // Remove slashes, normalize
  const cleaned = input.replace('/', '').toUpperCase();
  
  // Known quote assets
  const QUOTES = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'USD'];
  
  for (const quote of QUOTES) {
    if (cleaned.endsWith(quote)) {
      const base = cleaned.slice(0, -quote.length);
      return {
        baseAsset: normalizeSymbol(base),
        quoteAsset: normalizeSymbol(quote),
        symbol: `${normalizeSymbol(base)}/${normalizeSymbol(quote)}`
      };
    }
  }
  
  throw new Error(`Cannot parse pair: ${input}`);
}
```

### 7.2 Examples

| Exchange | Raw Pair | Normalized |
|---|---|---|
| Binance | BTC/USDT | BTC/USDT |
| Coinbase | BTC-USD | BTC/USD |
| OKX | WBTC/USDT | BTC/USDT |
| Kraken | XBT/USD | BTC/USD |
| KuCoin | ETH/USDT | ETH/USDT |

---

## 8. Storage Schema

### 8.1 Database Table

```sql
CREATE TABLE IF NOT EXISTS asset_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL UNIQUE,
  canonical TEXT NOT NULL,
  identity_type TEXT NOT NULL,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  venue_code TEXT NOT NULL,
  chain TEXT,
  contract_address TEXT,
  decimals INT NOT NULL,
  status TEXT DEFAULT 'active',
  metadata JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_observed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_asset_registry_canonical ON asset_registry(canonical);
CREATE INDEX idx_asset_registry_chain ON asset_registry(chain);
CREATE INDEX idx_asset_registry_venue ON asset_registry(venue_code);
```

---

## 9. Testing

### 9.1 Unit Tests

```typescript
describe('AssetNormalization', () => {
  it('normalizes BTC variants', () => {
    expect(normalizeSymbol('BTC')).toBe('BTC');
    expect(normalizeSymbol('XBT')).toBe('BTC');
    expect(normalizeSymbol('WBTC')).toBe('BTC');
  });
  
  it('resolves asset identity', () => {
    const identity = resolveAssetIdentity('WBTC', 'ethereum');
    expect(identity.canonical).toBe('BTC');
    expect(identity.type).toBe('wrapped-1to1');
  });
  
  it('normalizes pairs correctly', () => {
    expect(normalizePair('BTC/USDT', 'binance')).toEqual({
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      symbol: 'BTC/USDT'
    });
  });
});
```

---

## 10. Acceptance Criteria

- [ ] BTC/XBT/WBTC all resolve to BTC
- [ ] ETH/WETH all resolve to ETH
- [ ] Cross-chain USDT/USDC correctly identified
- [ ] Contract addresses resolved for 10+ chains
- [ ] Decimals correct for 100+ assets
- [ ] Pair parsing handles all exchange formats
- [ ] Metadata enrichment from CoinGecko

## Engineering Notes

- Normalization is deterministic (idempotent)
- Contract resolution uses cache + fallback
- Handle contract migration (e.g., USDT upgrades)
- Monitor for new token deployments
- Normalize before any comparison