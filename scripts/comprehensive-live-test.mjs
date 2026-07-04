/**
 * Comprehensive Live Provider Test
 * Tests CEX, DEX, and Bridge providers with real data.
 * Uses multiple data sources to ensure maximum coverage.
 */
import { BaseCexConnector } from '../packages/connectors/src/cex/base.js';
import { DiscoveryScheduler } from '../packages/discovery/src/scheduler.js';
import { VenueRegistry } from '../packages/discovery/src/venue-registry.js';
import { AssetRegistry } from '../packages/discovery/src/asset-registry.js';

const results = { cex: {}, dex: {}, bridge: {} };
const errors = [];

// ============================================================
// 1. CEX PROVIDERS — Test multiple exchanges via REST API
// ============================================================
async function testCEX() {
  console.log('\n=== TESTING CEX PROVIDERS ===\n');

  const cexConfigs = [
    {
      id: 'binance', baseUrl: 'https://api.binance.com',
      marketsPath: '/api/v3/exchangeInfo', statusPath: '/api/v3/ping',
      tickerPath: (s) => `/api/v3/ticker/24hr?symbol=${s}`,
      obPath: (s, d) => `/api/v3/depth?symbol=${s}&limit=${d}`,
      tradesPath: (s) => `/api/v3/trades?symbol=${s}&limit=1`,
      toSymbol: (p) => `${p.base}${p.quote}`,
      extractMarkets: (body) => { const b = body; return Array.isArray(b.symbols) ? b.symbols : []; },
    },
    {
      id: 'okx', baseUrl: 'https://www.okx.com',
      marketsPath: '/api/v5/public/instruments?instType=SPOT', statusPath: '/api/v5/public/time',
      tickerPath: (s) => `/api/v5/market/ticker?instId=${s}`,
      obPath: (s, d) => `/api/v5/market/books?instId=${s}&sz=${d}`,
      tradesPath: (s) => `/api/v5/market/trades?instId=${s}&limit=1`,
      toSymbol: (p) => `${p.base}-${p.quote}`,
      extractMarkets: (body) => { const b = body; return Array.isArray(b.data) ? b.data : []; },
    },
    {
      id: 'kraken', baseUrl: 'https://api.kraken.com',
      marketsPath: '/0/public/AssetPairs', statusPath: '/0/public/Time',
      tickerPath: (s) => `/0/public/Ticker?pair=${s}`,
      obPath: (s, d) => `/0/public/Depth?pair=${s}&count=${d}`,
      tradesPath: (s) => `/0/public/Trades?pair=${s}&count=1`,
      toSymbol: (p) => `${p.base}${p.quote}`,
      extractMarkets: (body) => { const b = body; return b.result ? Object.values(b.result) : []; },
    },
    {
      id: 'coinbase', baseUrl: 'https://api.exchange.coinbase.com',
      marketsPath: '/products', statusPath: '/products',
      tickerPath: (s) => `/products/${s}/ticker`,
      obPath: (s, d) => `/products/${s}/book?level=2`,
      tradesPath: (s) => `/products/${s}/trades?limit=1`,
      toSymbol: (p) => `${p.base}-${p.quote}`,
      extractMarkets: (body) => Array.isArray(body) ? body : [],
    },
    {
      id: 'bybit', baseUrl: 'https://api.bybit.com',
      marketsPath: '/v5/market/instruments-info?category=spot', statusPath: '/v5/market/time',
      tickerPath: (s) => `/v5/market/tickers?category=spot&symbol=${s}`,
      obPath: (s, d) => `/v5/market/orderbook?category=spot&symbol=${s}&limit=${d}`,
      tradesPath: (s) => `/v5/market/recent-trade?category=spot&symbol=${s}&limit=1`,
      toSymbol: (p) => `${p.base}${p.quote}`,
      extractMarkets: (body) => { const b = body; return b.result?.list ? b.result.list : []; },
    },
  ];

  for (const cfg of cexConfigs) {
    try {
      const started = Date.now();
      const res = await fetch(`${cfg.baseUrl}${cfg.marketsPath}`);
      const body = await res.json();
      const markets = cfg.extractMarkets(body);
      const elapsed = Date.now() - started;
      results.cex[cfg.id] = { status: 'ok', markets: markets.length, elapsedMs: elapsed };
      console.log(`  ${cfg.id}: ${markets.length} markets in ${elapsed}ms`);
    } catch (e) {
      results.cex[cfg.id] = { status: 'error', error: e.message };
      errors.push(`CEX ${cfg.id}: ${e.message}`);
      console.log(`  ${cfg.id}: ERROR - ${e.message}`);
    }
  }
}

// ============================================================
// 2. DEX PROVIDERS — Test via direct RPC + public endpoints
// ============================================================
async function testDEX() {
  console.log('\n=== TESTING DEX PROVIDERS ===\n');

  // Uniswap V3 via direct Ethereum RPC (public endpoint)
  const uniswapV3Factory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const poolCreatedTopic = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b9d9b7b0e4c9b';
  const rpcUrl = 'https://eth.llamarpc.com';

  const dexEndpoints = [
    {
      id: 'uniswap-v3',
      type: 'rpc',
      url: rpcUrl,
      query: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
    },
    {
      id: 'pancakeswap',
      type: 'api',
      url: 'https://api.pancakeswap.info/api/v2/pairs?limit=5',
    },
    {
      id: 'sushiswap',
      type: 'api',
      url: 'https://api.sushi.com/pools?limit=5',
    },
    {
      id: 'curve',
      type: 'api',
      url: 'https://api.curve.fi/api/getPools/ethereum/main',
    },
    {
      id: 'balancer',
      type: 'api',
      url: 'https://api.balancer.fi/pools?first=5',
    },
  ];

  for (const dex of dexEndpoints) {
    try {
      const started = Date.now();
      let data;
      if (dex.type === 'rpc') {
        const res = await fetch(dex.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dex.query) });
        data = await res.json();
      } else {
        const res = await fetch(dex.url);
        data = await res.json();
      }
      const elapsed = Date.now() - started;
      results.dex[dex.id] = { status: 'ok', dataKeys: Object.keys(data), elapsedMs: elapsed };
      console.log(`  ${dex.id}: connected in ${elapsed}ms (keys: ${Object.keys(data).join(', ')})`);
    } catch (e) {
      results.dex[dex.id] = { status: 'error', error: e.message };
      errors.push(`DEX ${dex.id}: ${e.message}`);
      console.log(`  ${dex.id}: ERROR - ${e.message}`);
    }
  }

  // Also try The Graph decentralized network with a simple query
  try {
    const started = Date.now();
    const res = await fetch('https://gateway-arbitrum.network.thegraph.com/api/0d0e8c1b0a1c1b0a1c1b0a1c1b0a1c/subgraphs/id/5zvR82doa4kPZJ3RjP1iMqdq8Qm3T3E4wK9KjGmJXK', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
    });
    const body = await res.json();
    const elapsed = Date.now() - started;
    if (body.data) {
      results.dex['uniswap-v3-subgraph'] = { status: 'ok', block: body.data._meta?.block?.number, elapsedMs: elapsed };
      console.log(`  uniswap-v3-subgraph: connected, block ${body.data._meta?.block?.number} in ${elapsed}ms`);
    } else {
      results.dex['uniswap-v3-subgraph'] = { status: 'auth_error', error: body.errors?.[0]?.message, elapsedMs: elapsed };
      console.log(`  uniswap-v3-subgraph: auth error - ${body.errors?.[0]?.message}`);
    }
  } catch (e) {
    results.dex['uniswap-v3-subgraph'] = { status: 'error', error: e.message };
    console.log(`  uniswap-v3-subgraph: ERROR - ${e.message}`);
  }
}

// ============================================================
// 3. BRIDGE PROVIDERS — Test via REST API
// ============================================================
async function testBridges() {
  console.log('\n=== TESTING BRIDGE PROVIDERS ===\n');

  const bridgeEndpoints = [
    { id: 'stargate', url: 'https://api.stargate.finance/api/v1/pools?chainId=1' },
    { id: 'across', url: 'https://across.to/api/pools' },
    { id: 'hop', url: 'https://api.hop.exchange/v1/pools?token=USDC' },
    { id: 'wormhole', url: 'https://api.wormholescan.io/api/v1/operations?pageSize=1' },
    { id: 'axelar', url: 'https://api.axelarscan.io/chain?size=1' },
    { id: 'debridge', url: 'https://api.debridge.finance/api/ChainDetails' },
    { id: 'ccip', url: 'https://ccip.chain.link/api/v1/chains' },
    { id: 'layerzero', url: 'https://api.layerzero.network/api/v1/chains' },
    { id: 'cctp', url: 'https://iris-api.circle.com/attestations?pageSize=1' },
    { id: 'relay', url: 'https://api.relay.link/chains' },
  ];

  for (const bridge of bridgeEndpoints) {
    try {
      const started = Date.now();
      const res = await fetch(bridge.url);
      const body = await res.json();
      const elapsed = Date.now() - started;
      const keys = body ? Object.keys(body).slice(0, 5) : [];
      results.bridge[bridge.id] = { status: 'ok', statusCode: res.status, keys, elapsedMs: elapsed };
      console.log(`  ${bridge.id}: connected in ${elapsed}ms (HTTP ${res.status}, keys: ${keys.join(', ')})`);
    } catch (e) {
      results.bridge[bridge.id] = { status: 'error', error: e.message };
      errors.push(`Bridge ${bridge.id}: ${e.message}`);
      console.log(`  ${bridge.id}: ERROR - ${e.message}`);
    }
  }
}

// ============================================================
// 4. DISCOVERY ENGINE — Full pipeline test
// ============================================================
async function testDiscoveryEngine() {
  console.log('\n=== TESTING DISCOVERY ENGINE ===\n');

  const vr = new VenueRegistry();
  const ar = new AssetRegistry();
  const sched = new DiscoveryScheduler(vr, ar, { cexIntervalMs: 0, fullScanIntervalMs: 0, staleAssetThresholdMs: 86400000 });

  // Register Binance
  const binance = new BaseCexConnector({
    id: 'binance', info: { id: 'binance', code: 'binance', name: 'Binance', makerFeeBps: 10, takerFeeBps: 10, baseUrl: 'https://api.binance.com', status: 'active' },
    baseUrl: 'https://api.binance.com', toSymbol: (p) => `${p.base}${p.quote}`,
    tickerPath: (s) => `/api/v3/ticker/24hr?symbol=${s}`, obPath: (s, d) => `/api/v3/depth?symbol=${s}&limit=${d}`,
    tradesPath: (s) => `/api/v3/trades?symbol=${s}&limit=1`, marketsPath: '/api/v3/exchangeInfo', statusPath: '/api/v3/ping',
    parseTicker: (raw) => { if (!raw || typeof raw !== 'object') return null; const r = raw; return { bid: String(r.bestBid ?? r.bidPrice ?? '0'), ask: String(r.bestAsk ?? r.askPrice ?? '0'), last: String(r.lastPrice ?? '0'), volume: String(r.volume ?? '0') }; },
    parseOB: (raw) => { if (!raw || typeof raw !== 'object') return { bids: [], asks: [] }; const r = raw; return { bids: r.bids || [], asks: r.asks || [] }; },
    parseTrade: (raw) => ({ id: String(raw.id ?? 0), price: String(raw.price ?? '0'), qty: String(raw.quoteQty ?? '0'), side: 'buy', ts: 0 }),
    parseMarket: (raw) => ({ symbol: String(raw.symbol ?? ''), base: String(raw.baseAsset ?? ''), quote: String(raw.quoteAsset ?? ''), status: String(raw.status ?? 'active') }),
    extractMarkets: (body) => { const b = body; return Array.isArray(b.symbols) ? b.symbols : []; },
  });

  sched.registerCexConnectors([binance]);
  const result = await sched.runCycle();
  const assets = ar.assets;
  const pairs = ar.pairs;

  console.log(`  Discovery cycle: ${result.venuesSucceeded}/${result.venuesScanned} venues succeeded`);
  console.log(`  Assets discovered: ${result.assetsDiscovered}`);
  console.log(`  Pairs discovered: ${result.pairsDiscovered}`);
  console.log(`  Total registered assets: ${assets.length}`);
  console.log(`  Total registered pairs: ${pairs.length}`);
  console.log(`  Sample assets: ${assets.slice(0, 5).map(a => a.symbol).join(', ')}`);
  console.log(`  Sample pairs: ${pairs.slice(0, 5).map(p => p.symbol).join(', ')}`);

  results.discovery = {
    venuesSucceeded: result.venuesSucceeded,
    assetsDiscovered: result.assetsDiscovered,
    pairsDiscovered: result.pairsDiscovered,
    totalAssets: assets.length,
    totalPairs: pairs.length,
  };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('========================================');
  console.log('  COMPREHENSIVE LIVE PROVIDER TEST');
  console.log('========================================');

  await testCEX();
  await testDEX();
  await testBridges();
  await testDiscoveryEngine();

  console.log('\n========================================');
  console.log('  RESULTS SUMMARY');
  console.log('========================================\n');

  const cexOk = Object.values(results.cex).filter(r => r.status === 'ok').length;
  const cexTotal = Object.keys(results.cex).length;
  const dexOk = Object.values(results.dex).filter(r => r.status === 'ok').length;
  const dexTotal = Object.keys(results.dex).length;
  const bridgeOk = Object.values(results.bridge).filter(r => r.status === 'ok').length;
  const bridgeTotal = Object.keys(results.bridge).length;

  console.log(`CEX:     ${cexOk}/${cexTotal} connected`);
  console.log(`DEX:     ${dexOk}/${dexTotal} connected`);
  console.log(`Bridge:  ${bridgeOk}/${bridgeTotal} connected`);
  console.log(`Errors:  ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const err of errors) console.log(`  - ${err}`);
  }

  console.log('\n========================================');
  console.log('  TEST COMPLETE');
  console.log('========================================');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });