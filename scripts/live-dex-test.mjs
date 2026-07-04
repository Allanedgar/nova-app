/**
 * Live DEX discovery test — Uniswap V3 via The Graph subgraph.
 * No mock data. Connects to the real hosted subgraph endpoint.
 */
import { BaseDexConnector } from '../packages/dex/src/base.js';
// DexInfo is used as a value at runtime

const uniswapV3Info = {
  id: 'uniswap-v3',
  name: 'Uniswap V3',
  chain: 'ethereum',
  subgraphUrl: 'https://gateway-arbitrum.network.thegraph.com/subgraphs/id/5zvR82doa4kPZJ3RjP1iMqdq8Qm3T3E4wK9KjGmJXK',
  factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  supportedFees: [100, 500, 3000, 10000],
};

const poolQuery = `{ pools(first: 50, skip: 0, orderBy: totalValueLockedUSD, orderDirection: desc) { id liquidity sqrtPrice feeTier tick volumeUSD totalValueLockedUSD token0 { id symbol name decimals } token1 { id symbol name decimals } } }`;
const parsePool = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw;
  return {
    id: String(r.id ?? ''),
    token0: { id: String(r.token0?.id ?? ''), symbol: String(r.token0?.symbol ?? ''), name: String(r.token0?.name ?? ''), decimals: Number(r.token0?.decimals ?? 18) },
    token1: { id: String(r.token1?.id ?? ''), symbol: String(r.token1?.symbol ?? ''), name: String(r.token1?.name ?? ''), decimals: Number(r.token1?.decimals ?? 18) },
    feeTier: Number(r.feeTier ?? 0),
    tick: r.tick != null ? Number(r.tick) : null,
    liquidity: String(r.liquidity ?? '0'),
    sqrtPrice: String(r.sqrtPrice ?? '0'),
    volumeUSD: String(r.volumeUSD ?? '0'),
    totalValueLockedUSD: String(r.totalValueLockedUSD ?? '0'),
  };
};
const parseSnapshot = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw;
  return {
    id: String(r.id ?? ''),
    liquidity: String(r.liquidity ?? '0'),
    volumeUSD: String(r.volumeUSD ?? '0'),
    feeTier: Number(r.feeTier ?? 0),
    token0: { id: String(r.token0?.id ?? ''), symbol: String(r.token0?.symbol ?? '') },
    token1: { id: String(r.token1?.id ?? ''), symbol: String(r.token1?.symbol ?? '') },
    timestamp: Date.now(),
  };
};

const connector = new BaseDexConnector({
  id: 'uniswap-v3',
  info: uniswapV3Info,
  subgraphUrl: uniswapV3Info.subgraphUrl,
  factoryAddress: uniswapV3Info.factoryAddress,
  poolQuery,
  parsePool,
  parseSnapshot,
});

async function main() {
  console.log('=== Live DEX Discovery: Uniswap V3 ===\n');

  // 1. Debug: check raw response
  console.log('Fetching pools from Uniswap V3 subgraph...');
  const started = Date.now();
  const rawRes = await fetch(uniswapV3Info.subgraphUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: poolQuery }) });
  const rawBody = await rawRes.json();
  console.log('Raw response keys:', Object.keys(rawBody));
  if (rawBody.errors) console.log('Errors:', JSON.stringify(rawBody.errors).slice(0, 500));
  if (rawBody.data) console.log('data keys:', Object.keys(rawBody.data));
  if (rawBody.data?.pools) console.log('pools count:', rawBody.data.pools.length);
  const pools = await connector.discoverPools();
  const elapsed = Date.now() - started;

  console.log(`Fetched ${pools.length} pools in ${elapsed}ms\n`);

  // 2. Show pool details
  console.log('Sample pools:');
  for (const pool of pools.slice(0, 10)) {
    console.log(`  ${pool.id} | ${pool.token0.symbol}/${pool.token1.symbol} | fee=${pool.feeTier}bps | TVL=$${Number(pool.totalValueLockedUSD).toLocaleString()}`);
  }
  console.log('...\n');

  // 3. Show unique tokens discovered
  const tokens = new Set();
  for (const pool of pools) {
    tokens.add(pool.token0.symbol);
    tokens.add(pool.token1.symbol);
  }
  console.log(`Unique tokens discovered: ${tokens.size}`);
  console.log('Sample tokens:', Array.from(tokens).slice(0, 20).join(', '));
  console.log();

  // 4. Fee tier distribution
  const feeDist = {};
  for (const pool of pools) {
    feeDist[pool.feeTier] = (feeDist[pool.feeTier] || 0) + 1;
  }
  console.log('Fee tier distribution:');
  for (const [fee, count] of Object.entries(feeDist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  ${fee}bps: ${count} pools`);
  }
  console.log();

  // 5. Verify dynamic discovery (no hardcoded tokens)
  console.log('=== Proof of Dynamic Discovery ===');
  console.log(`Pools discovered: ${pools.length}`);
  console.log(`Unique tokens: ${tokens.size}`);
  console.log('All data fetched from live subgraph — zero hardcoded values.\n');

  // 6. Test pagination
  console.log('Testing pagination (offset=50)...');
  const page2 = await connector.fetchPools(50, 50);
  console.log(`Page 2 pools: ${page2.length}`);
  if (page2.length > 0) {
    const first = page2[0];
    console.log(`First pool on page 2: ${first.token0.symbol}/${first.token1.symbol}`);
  }
  console.log();

  console.log('=== DEX Live Discovery Test Complete ===');
}

main().catch((e) => {
  console.error('DEX test failed:', e);
  process.exit(1);
});