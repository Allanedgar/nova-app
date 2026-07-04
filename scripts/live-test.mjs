import { BaseCexConnector } from '../packages/connectors/src/cex/base.js';
import { DiscoveryScheduler } from '../packages/discovery/src/scheduler.js';
import { VenueRegistry } from '../packages/discovery/src/venue-registry.js';
import { AssetRegistry } from '../packages/discovery/src/asset-registry.js';

const binance = new BaseCexConnector({
  id: 'binance',
  info: { id: 'binance', code: 'binance', name: 'Binance', makerFeeBps: 10, takerFeeBps: 10, baseUrl: 'https://api.binance.com', status: 'active' },
  baseUrl: 'https://api.binance.com',
  toSymbol: (p) => `${p.base}${p.quote}`,
  tickerPath: (s) => `/api/v3/ticker/24hr?symbol=${s}`,
  obPath: (s, d) => `/api/v3/depth?symbol=${s}&limit=${d}`,
  tradesPath: (s) => `/api/v3/trades?symbol=${s}&limit=1`,
  marketsPath: '/api/v3/exchangeInfo',
  statusPath: '/api/v3/ping',
  parseTicker: (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw;
    return { bid: String(r.bestBid ?? r.bidPrice ?? '0'), ask: String(r.bestAsk ?? r.askPrice ?? '0'), last: String(r.lastPrice ?? '0'), volume: String(r.volume ?? '0') };
  },
  parseOB: (raw) => {
    if (!raw || typeof raw !== 'object') return { bids: [], asks: [] };
    const r = raw;
    return { bids: r.bids || [], asks: r.asks || [] };
  },
  parseTrade: (raw) => ({ id: String(raw.id ?? 0), price: String(raw.price ?? '0'), qty: String(raw.quoteQty ?? '0'), side: 'buy', ts: 0 }),
  parseMarket: (raw) => ({ symbol: String(raw.symbol ?? ''), base: String(raw.baseAsset ?? ''), quote: String(raw.quoteAsset ?? ''), status: String(raw.status ?? 'active') }),
  extractMarkets: (body) => { const b = body; return Array.isArray(b.symbols) ? b.symbols : []; },
});

const vr = new VenueRegistry();
const ar = new AssetRegistry();
const sched = new DiscoveryScheduler(vr, ar, { cexIntervalMs: 0, fullScanIntervalMs: 0, staleAssetThresholdMs: 86400000 });
sched.registerCexConnectors([binance]);

const result = await sched.runCycle();
const assets = ar.assets;
const pairs = ar.pairs;

console.log(JSON.stringify({
  venuesScanned: result.venuesScanned,
  venuesSucceeded: result.venuesSucceeded,
  venuesFailed: result.venuesFailed,
  assetsDiscovered: result.assetsDiscovered,
  pairsDiscovered: result.pairsDiscovered,
  totalAssets: assets.length,
  totalPairs: pairs.length,
  sampleAssets: assets.slice(0, 10).map(a => a.symbol),
  samplePairs: pairs.slice(0, 10).map(p => p.symbol),
}, null, 2));