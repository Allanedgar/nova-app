import type { AssetOpportunityRow, OpportunitySummary } from './types.js';

const DEFAULT_ASSETS = [
  'IOTX', 'HNT', 'IOTA', 'REP', 'XNO', 'ACH', 'UTK', 'STPT', 'MLN', 'AUTO',
  'ATM', 'MDX', 'DODO', 'JASMY', 'BADGER', 'OG', 'DREP', 'SCRT', 'DOCK', 'FIS',
  'BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'AVAX', 'MATIC', 'ADA', 'DOGE', 'LTC',
  'BNB', 'TRX', 'TON', 'DOT', 'UNI', 'AAVE', 'COMP', 'CRV', 'SUSHI', 'MKR',
  'ARB', 'OP', 'APT', 'SUI', 'SEI', 'INJ', 'FET', 'RNDR', 'GRT', 'LDO',
  'PEPE', 'SHIB', 'FLOKI', 'WIF', 'BONK', 'ENA', 'PENDLE', 'TIA', 'JUP', 'WLD',
  'FIL', 'ETC', 'ATOM', 'ALGO', 'NEAR', 'EGLD', 'VET', 'ICP', 'KAS', 'XLM',
] as const;

const QUOTE_PRIORITY = ['USDT', 'USD', 'USDC'] as const;

interface LiveQuote {
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly venueId: string;
  readonly venueName: string;
  readonly bid: number;
  readonly ask: number;
  readonly feeBps: number;
}

interface PublicVenueAdapter {
  readonly id: string;
  readonly name: string;
  readonly feeBps: number;
  fetchAllTickers?(): Promise<readonly LiveQuote[]>;
  fetchTicker(baseAsset: string, quoteAsset: string): Promise<{ bid: number; ask: number } | null>;
}

const isUsablePrice = (value: number): boolean => Number.isFinite(value) && value > 0;
const isSupportedQuote = (quoteAsset: string): boolean =>
  QUOTE_PRIORITY.includes(quoteAsset.toUpperCase() as (typeof QUOTE_PRIORITY)[number]);

function quoteFromRaw(
  venue: Pick<PublicVenueAdapter, 'id' | 'name' | 'feeBps'>,
  baseAsset: string,
  quoteAsset: string,
  bid: unknown,
  ask: unknown,
): LiveQuote | null {
  const normalizedBase = baseAsset.toUpperCase();
  const normalizedQuote = quoteAsset.toUpperCase();
  const bidNumber = Number(bid);
  const askNumber = Number(ask);

  if (!normalizedBase || !isSupportedQuote(normalizedQuote)) return null;
  if (!isUsablePrice(bidNumber) || !isUsablePrice(askNumber)) return null;

  return {
    baseAsset: normalizedBase,
    quoteAsset: normalizedQuote,
    venueId: venue.id,
    venueName: venue.name,
    bid: bidNumber,
    ask: askNumber,
    feeBps: venue.feeBps,
  };
}

function splitConcatenatedSymbol(symbol: string): { base: string; quote: string } | null {
  const upper = symbol.toUpperCase().replace(/[_-]/g, '');
  for (const quote of QUOTE_PRIORITY) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }
  return null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(4_000),
    headers: {
      'User-Agent': 'nova-live-opportunity-scanner/1.0',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

const venues: readonly PublicVenueAdapter[] = [
  {
    id: 'binance',
    name: 'Binance',
    feeBps: 10,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.binance.com/api/v3/ticker/bookTicker');
      if (!Array.isArray(body)) return [];
      return body.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const pair = splitConcatenatedSymbol(String(rec.symbol ?? ''));
        if (!pair) return [];
        const quote = quoteFromRaw(venues[0]!, pair.base, pair.quote, rec.bidPrice, rec.askPrice);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${base}${quote}`);
      const rec = body as Record<string, unknown> | null;
      return rec ? { bid: Number(rec.bidPrice), ask: Number(rec.askPrice) } : null;
    },
  },
  {
    id: 'okx',
    name: 'OKX',
    feeBps: 10,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      const data = (body as Record<string, unknown> | null)?.data;
      if (!Array.isArray(data)) return [];
      return data.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const [base, quoteAsset] = String(rec.instId ?? '').toUpperCase().split('-');
        const quote = quoteFromRaw(venues[1]!, base ?? '', quoteAsset ?? '', rec.bidPx, rec.askPx);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${base}-${quote}`);
      const rec = ((body as Record<string, unknown> | null)?.data as Record<string, unknown>[] | undefined)?.[0];
      return rec ? { bid: Number(rec.bidPx), ask: Number(rec.askPx) } : null;
    },
  },
  {
    id: 'bybit',
    name: 'Bybit',
    feeBps: 10,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot');
      const data = ((body as Record<string, unknown> | null)?.result as Record<string, unknown> | undefined)?.list;
      if (!Array.isArray(data)) return [];
      return data.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const pair = splitConcatenatedSymbol(String(rec.symbol ?? ''));
        if (!pair) return [];
        const quote = quoteFromRaw(venues[2]!, pair.base, pair.quote, rec.bid1Price, rec.ask1Price);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${base}${quote}`);
      const rec = (((body as Record<string, unknown> | null)?.result as Record<string, unknown> | undefined)?.list as Record<string, unknown>[] | undefined)?.[0];
      return rec ? { bid: Number(rec.bid1Price), ask: Number(rec.ask1Price) } : null;
    },
  },
  {
    id: 'kucoin',
    name: 'KuCoin',
    feeBps: 10,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.kucoin.com/api/v1/market/allTickers');
      const data = ((body as Record<string, unknown> | null)?.data as Record<string, unknown> | undefined)?.ticker;
      if (!Array.isArray(data)) return [];
      return data.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const [base, quoteAsset] = String(rec.symbol ?? '').toUpperCase().split('-');
        const quote = quoteFromRaw(venues[3]!, base ?? '', quoteAsset ?? '', rec.buy, rec.sell);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${base}-${quote}`);
      const rec = (body as Record<string, unknown> | null)?.data as Record<string, unknown> | undefined;
      return rec ? { bid: Number(rec.bestBid), ask: Number(rec.bestAsk) } : null;
    },
  },
  {
    id: 'mexc',
    name: 'MEXC',
    feeBps: 10,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.mexc.com/api/v3/ticker/bookTicker');
      if (!Array.isArray(body)) return [];
      return body.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const pair = splitConcatenatedSymbol(String(rec.symbol ?? ''));
        if (!pair) return [];
        const quote = quoteFromRaw(venues[4]!, pair.base, pair.quote, rec.bidPrice, rec.askPrice);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.mexc.com/api/v3/ticker/bookTicker?symbol=${base}${quote}`);
      const rec = body as Record<string, unknown> | null;
      return rec ? { bid: Number(rec.bidPrice), ask: Number(rec.askPrice) } : null;
    },
  },
  {
    id: 'gate',
    name: 'Gate.io',
    feeBps: 20,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.gateio.ws/api/v4/spot/tickers');
      if (!Array.isArray(body)) return [];
      return body.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const [base, quoteAsset] = String(rec.currency_pair ?? '').toUpperCase().split('_');
        const quote = quoteFromRaw(venues[5]!, base ?? '', quoteAsset ?? '', rec.highest_bid, rec.lowest_ask);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${base}_${quote}`);
      const rec = Array.isArray(body) ? body[0] as Record<string, unknown> | undefined : undefined;
      return rec ? { bid: Number(rec.highest_bid), ask: Number(rec.lowest_ask) } : null;
    },
  },
  {
    id: 'htx',
    name: 'Huobi',
    feeBps: 20,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.huobi.pro/market/tickers');
      const data = (body as Record<string, unknown> | null)?.data;
      if (!Array.isArray(data)) return [];
      return data.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const pair = splitConcatenatedSymbol(String(rec.symbol ?? ''));
        if (!pair) return [];
        const quote = quoteFromRaw(venues[6]!, pair.base, pair.quote, rec.bid, rec.ask);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.huobi.pro/market/detail/merged?symbol=${base.toLowerCase()}${quote.toLowerCase()}`);
      const tick = (body as Record<string, unknown> | null)?.tick as Record<string, unknown> | undefined;
      const bid = Array.isArray(tick?.bid) ? Number(tick.bid[0]) : 0;
      const ask = Array.isArray(tick?.ask) ? Number(tick.ask[0]) : 0;
      return { bid, ask };
    },
  },
  {
    id: 'bitget',
    name: 'Bitget',
    feeBps: 10,
    fetchAllTickers: async () => {
      const body = await fetchJson('https://api.bitget.com/api/v2/spot/market/tickers');
      const data = (body as Record<string, unknown> | null)?.data;
      if (!Array.isArray(data)) return [];
      return data.flatMap((item) => {
        const rec = item as Record<string, unknown>;
        const pair = splitConcatenatedSymbol(String(rec.symbol ?? ''));
        if (!pair) return [];
        const quote = quoteFromRaw(venues[7]!, pair.base, pair.quote, rec.bidPr, rec.askPr);
        return quote ? [quote] : [];
      });
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${base}${quote}`);
      const rec = ((body as Record<string, unknown> | null)?.data as Record<string, unknown>[] | undefined)?.[0];
      return rec ? { bid: Number(rec.bidPr), ask: Number(rec.askPr) } : null;
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase Exchange',
    feeBps: 12,
    fetchAllTickers: async () => {
      const products = await fetchJson('https://api.exchange.coinbase.com/products');
      if (!Array.isArray(products)) return [];
      const selected = products
        .map((item) => item as Record<string, unknown>)
        .filter((rec) => isSupportedQuote(String(rec.quote_currency ?? '')))
        .slice(0, 120);

      const rows = await Promise.allSettled(selected.map(async (rec) => {
        const productId = String(rec.id ?? '');
        const ticker = await fetchJson(`https://api.exchange.coinbase.com/products/${productId}/ticker`);
        const tick = ticker as Record<string, unknown> | null;
        if (!tick) return null;
        const price = Number(tick.price);
        return quoteFromRaw(
          venues[8]!,
          String(rec.base_currency ?? ''),
          String(rec.quote_currency ?? ''),
          Number(tick.bid) || price,
          Number(tick.ask) || price,
        );
      }));

      return rows
        .filter((result): result is PromiseFulfilledResult<LiveQuote | null> => result.status === 'fulfilled')
        .map((result) => result.value)
        .filter((quote): quote is LiveQuote => quote !== null);
    },
    fetchTicker: async (base, quote) => {
      const body = await fetchJson(`https://api.exchange.coinbase.com/products/${base}-${quote}/ticker`);
      const rec = body as Record<string, unknown> | null;
      if (!rec) return null;
      const price = Number(rec.price);
      return { bid: Number(rec.bid) || price, ask: Number(rec.ask) || price };
    },
  },
];

async function firstSupportedQuote(
  venue: PublicVenueAdapter,
  baseAsset: string,
): Promise<LiveQuote | null> {
  for (const quoteAsset of QUOTE_PRIORITY) {
    try {
      const snapshot = await venue.fetchTicker(baseAsset, quoteAsset);
      if (!snapshot || !isUsablePrice(snapshot.bid) || !isUsablePrice(snapshot.ask)) continue;

      return {
        baseAsset,
        quoteAsset,
        venueId: venue.id,
        venueName: venue.name,
        bid: snapshot.bid,
        ask: snapshot.ask,
        feeBps: venue.feeBps,
      };
    } catch {
      // Try the next quote currency. Missing pairs are normal across venues.
    }
  }
  return null;
}

export async function scanLiveAssetOpportunities(options?: {
  readonly assets?: readonly string[];
  readonly venues?: readonly PublicVenueAdapter[];
  readonly minGrossSpreadBps?: number;
  readonly maxRows?: number;
}): Promise<AssetOpportunityRow[]> {
  const adapters = options?.venues ?? venues;
  const assets = options?.assets ?? DEFAULT_ASSETS;
  const minGrossSpreadBps = options?.minGrossSpreadBps ?? 0;
  const maxRows = options?.maxRows ?? 50;
  const detectedAt = Date.now();
  const { quotes } = await collectLiveQuotes(adapters, assets);

  const byAsset = new Map<string, LiveQuote[]>();
  for (const quote of quotes) {
    const key = quote.baseAsset.toUpperCase();
    byAsset.set(key, [...(byAsset.get(key) ?? []), quote]);
  }

  const opportunities: AssetOpportunityRow[] = [];
  for (const [baseAsset, assetQuotes] of byAsset) {
    if (assetQuotes.length < 2) continue;

    const buy = assetQuotes.reduce((best, quote) => quote.ask < best.ask ? quote : best);
    const sell = assetQuotes.reduce((best, quote) => quote.bid > best.bid ? quote : best);
    if (buy.venueId === sell.venueId) continue;

    const grossSpreadBps = ((sell.bid - buy.ask) / buy.ask) * 10_000;
    if (grossSpreadBps < minGrossSpreadBps) continue;

    const estimatedFeeBps = buy.feeBps + sell.feeBps;
    const netSpreadBps = grossSpreadBps - estimatedFeeBps;

    opportunities.push({
      index: 0,
      baseAsset,
      buyHereName: buy.venueName,
      buyHerePrice: buy.ask,
      sellHereName: sell.venueName,
      sellHerePrice: sell.bid,
      arbitrage: grossSpreadBps / 100,
      grossSpreadBps,
      estimatedFeeBps,
      netSpreadBps,
      routeType: 'cex-cex',
      buyQuoteAsset: buy.quoteAsset,
      sellQuoteAsset: sell.quoteAsset,
      detectedAt,
    });
  }

  return opportunities
    .sort((a, b) => b.arbitrage - a.arbitrage)
    .slice(0, maxRows)
    .map((row, index) => ({ ...row, index }));
}

let cachedRows: { readonly expiresAt: number; readonly rows: readonly AssetOpportunityRow[] } | null = null;

export interface LiveScannerDiagnostics {
  readonly quoteCount: number;
  readonly assetCount: number;
  readonly venueCounts: Readonly<Record<string, number>>;
  readonly errors: readonly string[];
}

async function collectLiveQuotes(
  adapters: readonly PublicVenueAdapter[],
  assets: readonly string[],
): Promise<{ readonly quotes: readonly LiveQuote[]; readonly errors: readonly string[] }> {
  const errors: string[] = [];
  const bulkRows = await Promise.allSettled(adapters.map(async (venue) => {
    if (!venue.fetchAllTickers) return [];
    try {
      return await venue.fetchAllTickers();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${venue.id}: ${message}`);
      return [];
    }
  }));

  const bulkQuotes = bulkRows
    .filter((result): result is PromiseFulfilledResult<readonly LiveQuote[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  const targetedRows = await Promise.allSettled(
    assets.flatMap((baseAsset) =>
      adapters.map((venue) => firstSupportedQuote(venue, baseAsset)),
    ),
  );

  const targetedQuotes = targetedRows
    .filter((result): result is PromiseFulfilledResult<LiveQuote | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((quote): quote is LiveQuote => quote !== null);

  const uniqueQuotes = new Map<string, LiveQuote>();
  for (const quote of [...bulkQuotes, ...targetedQuotes]) {
    uniqueQuotes.set(`${quote.venueId}:${quote.baseAsset}:${quote.quoteAsset}`, quote);
  }

  return { errors, quotes: [...uniqueQuotes.values()] };
}

export async function getLiveScannerDiagnostics(): Promise<LiveScannerDiagnostics> {
  const collected = await collectLiveQuotes(venues, DEFAULT_ASSETS);
  const venueCounts: Record<string, number> = {};
  const assets = new Set<string>();
  for (const quote of collected.quotes) {
    venueCounts[quote.venueId] = (venueCounts[quote.venueId] ?? 0) + 1;
    assets.add(quote.baseAsset);
  }
  return {
    quoteCount: collected.quotes.length,
    assetCount: assets.size,
    venueCounts,
    errors: collected.errors,
  };
}

export async function getCachedLiveAssetOpportunities(options?: {
  readonly ttlMs?: number;
}): Promise<readonly AssetOpportunityRow[]> {
  const now = Date.now();
  if (cachedRows && cachedRows.expiresAt > now) return cachedRows.rows;

  const rows = await scanLiveAssetOpportunities();
  cachedRows = {
    expiresAt: now + (options?.ttlMs ?? 15_000),
    rows,
  };
  return rows;
}

export function toOpportunitySummary(row: AssetOpportunityRow): OpportunitySummary {
  return {
    id: `${row.routeType}-${row.baseAsset}-${row.buyHereName}-${row.sellHereName}-${row.detectedAt}`,
    symbol: row.baseAsset,
    type: row.routeType,
    route: `${row.buyHereName} -> ${row.sellHereName}`,
    buyVenue: row.buyHereName,
    sellVenue: row.sellHereName,
    netProfitBps: row.netSpreadBps,
    netProfitUsd: row.netSpreadBps / 10,
    confidenceScore: row.netSpreadBps > 0 ? 0.65 : 0.35,
    riskScore: row.netSpreadBps > 0 ? 35 : 70,
    detectedAt: row.detectedAt,
    status: row.netSpreadBps > 0 ? 'fee-positive' : 'gross-spread',
  };
}
