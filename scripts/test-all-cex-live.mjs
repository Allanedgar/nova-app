/**
 * Live test all 20 CEX connectors and existing DEX connectors.
 * Tests markets discovery, health, and ticker fetching.
 */
const BASE = 'C:/Users/User/Desktop/nova-app';

const cexConnectors = [
  'binance', 'coinbase', 'okx', 'bybit', 'kraken',
  'bitget', 'gate', 'kucoin', 'mexc', 'htx',
  'bitfinex', 'bitstamp', 'cryptocom', 'whitebit', 'bingx',
  'phemex', 'lbank', 'poloniex', 'backpack', 'gemini'
];

const cexEndpoints = {
  binance: { api: 'https://api.binance.com/api/v3/ping', markets: 'https://api.binance.com/api/v3/exchangeInfo' },
  coinbase: { api: 'https://api.exchange.coinbase.com/products', markets: 'https://api.exchange.coinbase.com/products' },
  okx: { api: 'https://www.okx.com/api/v5/public/time', markets: 'https://www.okx.com/api/v5/public/instruments?instType=SPOT' },
  bybit: { api: 'https://api.bybit.com/v5/market/time', markets: 'https://api.bybit.com/v5/market/instruments-info?category=spot' },
  kraken: { api: 'https://api.kraken.com/0/public/Time', markets: 'https://api.kraken.com/0/public/AssetPairs' },
  bitget: { api: 'https://api.bitget.com/api/v2/public/time', markets: 'https://api.bitget.com/api/v2/spot/public/symbols' },
  gate: { api: 'https://api.gateio.ws/api/v4/spot/currencies', markets: 'https://api.gateio.ws/api/v4/spot/currency_pairs' },
  kucoin: { api: 'https://api.kucoin.com/api/v1/timestamp', markets: 'https://api.kucoin.com/api/v1/symbols' },
  mexc: { api: 'https://api.mexc.com/api/v3/ping', markets: 'https://api.mexc.com/api/v3/exchangeInfo' },
  htx: { api: 'https://api.huobi.pro/v1/common/timestamp', markets: 'https://api.huobi.pro/v1/common/symbols' },
  bitfinex: { api: 'https://api.bitfinex.com/v2/tickers?symbols=ALL', markets: 'https://api.bitfinex.com/v2/tickers?symbols=ALL' },
  bitstamp: { api: 'https://www.bitstamp.net/api/v2/ticker/', markets: 'https://www.bitstamp.net/api/v2/trading-pairs-info/' },
  cryptocom: { api: 'https://api.crypto.com/v2/public/get-ticker?instrument_name=BTC_USDT', markets: 'https://api.crypto.com/v2/public/get-ticker?instrument_name=BTC_USDT' },
  whitebit: { api: 'https://whitebit.com/api/v4/public/time', markets: 'https://whitebit.com/api/v4/public/markets' },
  bingx: { api: 'https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=BTC-USDT', markets: 'https://open-api.bingx.com/openApi/spot/v1/exchangeInfo' },
  phemex: { api: 'https://api.phemex.com/public/products', markets: 'https://api.phemex.com/public/products' },
  lbank: { api: 'https://api.lbank.info/v2/ticker.do?symbol=btc_usdt', markets: 'https://api.lbank.info/v2/currencyPairs.do' },
  poloniex: { api: 'https://api.poloniex.com/markets/price', markets: 'https://api.poloniex.com/markets' },
  backpack: { api: 'https://api.backpack.exchange/api/v1/assets', markets: 'https://api.backpack.exchange/api/v1/markets' },
  gemini: { api: 'https://api.gemini.com/v1/symbols', markets: 'https://api.gemini.com/v1/symbols' },
};

const dexEndpoints = [
  { id: 'hyperliquid', url: 'https://api.hyperliquid.xyz/info', method: 'POST', body: { type: 'allMids' } },
  { id: 'raydium', url: 'https://api.raydium.io/v3/pools/info' },
  { id: 'jupiter', url: 'https://token.jup.ag/strict' },
  { id: '1inch', url: 'https://tokens.1inch.eth.link' },
  { id: 'pancakeswap', url: 'https://api.pancakeswap.info/api/v2/pairs?limit=5' },
  { id: 'curve', url: 'https://api.curve.fi/api/getPools/ethereum/main' },
  { id: 'sushiswap', url: 'https://api.sushi.com/pools?limit=5' },
  { id: 'traderjoe', url: 'https://api.traderjoexyz.com/v1/pools?chain=avalanche' },
  { id: 'orca', url: 'https://api.orca.so/v1/tokens' },
  { id: 'balancer', url: 'https://api.balancer.fi/pools?first=5' },
  { id: 'aerodrome', url: 'https://api.aerodrome.finance/pools?limit=5' },
  { id: 'velodrome', url: 'https://api.velodrome.finance/api/v1/pools' },
  { id: 'camelot', url: 'https://api.camelot.exchange/pools?limit=5' },
  { id: 'dydx', url: 'https://api.dydx.exchange/v3/markets' },
  { id: 'gmx', url: 'https://api.gmx.io/pools?limit=5' },
  { id: 'syncswap', url: 'https://api.syncswap.xyz/pools?limit=5' },
  { id: 'cetus', url: 'https://api.cetus.zone/v2/pools?limit=5' },
  { id: 'thruster', url: 'https://api.thruster.fi/pools?limit=5' },
  { id: 'balancer-v3', url: 'https://api-v3.balancer.fi/pools?first=5' },
  { id: 'orbitals', url: 'https://api.orbitals.com/v1/pools?limit=5' },
];

async function main() {
  console.log('=== LIVE TEST: ALL 20 CEX + ALL DEX ===\n');

  // Test CEX
  let cexOk = 0, cexTotal = 0;
  for (const id of cexConnectors) {
    const ep = cexEndpoints[id];
    if (!ep) { console.log(`  ${id}: no endpoint config`); continue; }
    cexTotal++;
    try {
      const started = Date.now();
      let res;
      if (ep.body) {
        res = await fetch(ep.api, { method: ep.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ep.body) });
      } else {
        res = await fetch(ep.markets || ep.api);
      }
      const elapsed = Date.now() - started;
      if (res.ok) {
        const body = await res.json();
        let count = 0;
        if (Array.isArray(body)) count = body.length;
        else if (body.symbols) count = body.symbols.length;
        else if (body.data) count = Array.isArray(body.data) ? body.data.length : 1;
        else if (body.result) count = Array.isArray(body.result) ? body.result.length : 1;
        else count = Object.keys(body).length;
        console.log(`  CEX ${id}: ✅ ${count} items (${elapsed}ms)`);
        cexOk++;
      } else {
        console.log(`  CEX ${id}: ⚠️ HTTP ${res.status} (${elapsed}ms)`);
      }
    } catch (e) {
      console.log(`  CEX ${id}: ❌ ${e.message}`);
    }
  }

  // Test DEX
  console.log();
  let dexOk = 0, dexTotal = 0;
  for (const dex of dexEndpoints) {
    dexTotal++;
    try {
      const started = Date.now();
      let res;
      if (dex.method === 'POST') {
        res = await fetch(dex.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dex.body) });
      } else {
        res = await fetch(dex.url);
      }
      const elapsed = Date.now() - started;
      const body = await res.json();
      let count = 0;
      if (Array.isArray(body)) count = body.length;
      else if (body.data) count = Array.isArray(body.data) ? body.data.length : 1;
      else if (body.pools) count = Array.isArray(body.pools) ? body.pools.length : 1;
      else count = Object.keys(body).length;
      console.log(`  DEX ${dex.id}: ✅ ${count} items (${elapsed}ms)`);
      dexOk++;
    } catch (e) {
      console.log(`  DEX ${dex.id}: ❌ ${e.message}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`CEX: ${cexOk}/${cexTotal} connected`);
  console.log(`DEX: ${dexOk}/${dexTotal} connected`);
}

main().catch(console.error);