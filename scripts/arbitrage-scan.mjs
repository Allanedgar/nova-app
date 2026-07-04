/**
 * ARBITRAGE SCAN v2 — Direct HTTP-based detector
 * Compares bid/ask across 15 CEX venues for 20 pairs.
 * No connector imports needed — uses raw fetch calls.
 */
const CEX_ENDPOINTS = {
  binance: { ticker: (s) => `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${s}`, parse: (d) => ({ bid: parseFloat(d.bidPrice), ask: parseFloat(d.askPrice) }) },
  coinbase: { ticker: (s) => `https://api.exchange.coinbase.com/products/${s}/ticker`, parse: (d) => ({ bid: parseFloat(d.bid), ask: parseFloat(d.ask) }) },
  okx: { ticker: (s) => `https://www.okx.com/api/v5/market/ticker?instId=${s}`, parse: (d) => ({ bid: parseFloat(d.data?.[0]?.bidPx ?? 0), ask: parseFloat(d.data?.[0]?.askPx ?? 0) }) },
  bybit: { ticker: (s) => `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${s}`, parse: (d) => ({ bid: parseFloat(d.result?.list?.[0]?.bid1Price ?? 0), ask: parseFloat(d.result?.list?.[0]?.ask1Price ?? 0) }) },
  kraken: { ticker: (s) => `https://api.kraken.com/0/public/Ticker?pair=${s.slice(0, -4)}USD`, parse: (d) => { const p = Object.values(d.result || {})[0]; return { bid: parseFloat(p?.b?.[0] ?? 0), ask: parseFloat(p?.a?.[0] ?? 0) }; } },
  bitget: { ticker: (s) => `https://api.bitget.com/api/v2/spot/market/ticker?symbol=${s}`, parse: (d) => ({ bid: parseFloat(d.data?.[0]?.bidPx ?? 0), ask: parseFloat(d.data?.[0]?.askPx ?? 0) }) },
  gate: { ticker: (s) => `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${s.slice(0, -4)}_${s.slice(-4)}`, parse: (d) => ({ bid: parseFloat(d?.[0]?.highest_bid ?? 0), ask: parseFloat(d?.[0]?.lowest_ask ?? 0) }) },
  kucoin: { ticker: (s) => `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${s}`, parse: (d) => ({ bid: parseFloat(d.data?.bestBid ?? 0), ask: parseFloat(d.data?.bestAsk ?? 0) }) },
  mexc: { ticker: (s) => `https://api.mexc.com/api/v3/ticker/bookTicker?symbol=${s}`, parse: (d) => ({ bid: parseFloat(d.bidPrice), ask: parseFloat(d.askPrice) }) },
  htx: { ticker: (s) => `https://api.huobi.pro/market/depth?symbol=${s.toLowerCase()}&type=step0`, parse: (d) => ({ bid: parseFloat(d.tick?.bids?.[0]?.[0] ?? 0), ask: parseFloat(d.tick?.asks?.[0]?.[0] ?? 0) }) },
  bitfinex: { ticker: (s) => `https://api.bitfinex.com/v2/ticker/t${s.slice(0, -4)}${s.slice(-4)}`, parse: (d) => ({ bid: parseFloat(d?.[0] ?? 0), ask: parseFloat(d?.[2] ?? 0) }) },
  bitstamp: { ticker: (s) => `https://www.bitstamp.net/api/v2/ticker/${s.toLowerCase()}/`, parse: (d) => ({ bid: parseFloat(d.bid), ask: parseFloat(d.ask) }) },
  poloniex: { ticker: (s) => `https://api.poloniex.com/markets/${s.slice(0, -4)}_${s.slice(-4)}/price`, parse: (d) => ({ bid: parseFloat(d.price) * 0.999, ask: parseFloat(d.price) * 1.001 }) },
  gemini: { ticker: (s) => `https://api.gemini.com/v1/pubticker/${s.slice(0, -4).toLowerCase()}${s.slice(-4).toLowerCase()}`, parse: (d) => ({ bid: parseFloat(d.bid ?? 0), ask: parseFloat(d.ask ?? 0) }) },
};

const CEX_FEES = {
  binance: 0.10, coinbase: 0.60, okx: 0.10, bybit: 0.10, kraken: 0.26,
  bitget: 0.10, gate: 0.20, kucoin: 0.10, mexc: 0.10, htx: 0.20,
  bitfinex: 0.20, bitstamp: 0.50, poloniex: 0.20, gemini: 0.40,
  whitebit: 0.10, cryptocom: 0.10, phemex: 0.10, lbank: 0.10, bingx: 0.10, backpack: 0.10,
};

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'BCHUSDT', 'TRXUSDT', 'NEARUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT'];

async function fetchPrice(name, ep, symbol) {
  try {
    const url = ep.ticker(symbol);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const p = ep.parse(data);
    return p.bid > 0 && p.ask > 0 ? { name, bid: p.bid, ask: p.ask } : null;
  } catch { return null; }
}

async function main() {
  console.log('=== ARBITRAGE SCAN v2 ===\n');
  console.log(`Scanning ${PAIRS.length} pairs across 14 CEX venues\n`);

  const opportunities = [];

  for (const pair of PAIRS) {
    const prices = {};
    const fetches = Object.entries(CEX_ENDPOINTS).map(([name, ep]) => fetchPrice(name, ep, pair));
    const results = await Promise.allSettled(fetches);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) prices[r.value.name] = r.value;
    }

    const venues = Object.keys(prices);
    if (venues.length < 2) continue;

    // Find lowest ask and highest bid
    let lowAsk = { name: '', ask: Infinity };
    let highBid = { name: '', bid: 0 };
    let totalMid = 0;

    for (const [v, p] of Object.entries(prices)) {
      totalMid += (p.bid + p.ask) / 2;
      if (p.ask < lowAsk.ask) lowAsk = { name: v, ask: p.ask };
      if (p.bid > highBid.bid) highBid = { name: v, bid: p.bid };
    }

    const avgMid = totalMid / venues.length;
    const grossPct = ((highBid.bid - lowAsk.ask) / lowAsk.ask) * 100;
    const totalFeePct = (CEX_FEES[lowAsk.name] || 0.10) + (CEX_FEES[highBid.name] || 0.10);
    const netPct = grossPct - totalFeePct;

    // Price deviation
    const deviations = Object.values(prices).map(p => Math.abs(((p.bid + p.ask) / 2 - avgMid) / avgMid) * 100);
    const maxDev = Math.max(...deviations);

    if (netPct > 0.005) {
      opportunities.push({
        pair,
        buyVenue: lowAsk.name, buyPrice: lowAsk.ask,
        sellVenue: highBid.name, sellPrice: highBid.bid,
        grossPct: grossPct.toFixed(3),
        feesPct: totalFeePct.toFixed(3),
        netPct: netPct.toFixed(3),
        venues: venues.length,
        maxDev: maxDev.toFixed(3),
      });
    }
  }

  // Sort by net profit
  opportunities.sort((a, b) => parseFloat(b.netPct) - parseFloat(a.netPct));

  console.log('=== OPPORTUNITIES (net > 0.005%) ===\n');
  if (opportunities.length === 0) {
    console.log('No arbitrage opportunities above 0.005% threshold for major pairs.\n');
    console.log('Markets are efficient for BTC/ETH/SOL — profitable arb requires:');
    console.log('- Exotic pairs with lower liquidity');
    console.log('- Cross-chain bridges (CEX ↔ DEX)');
    console.log('- Triangular routes (3+ legs)');
    console.log('- Perpetual funding rate arbitrage');
  } else {
    console.log('Pair        Buy@sell@      Gross%  Fees%   Net%    Venues  MaxDev%');
    console.log('─'.repeat(85));
    for (const o of opportunities) {
      console.log(`${o.pair.padEnd(10)} ${(o.buyVenue + '@' + o.buyPrice.toFixed(2)).padEnd(12)}→${(o.sellVenue + '@' + o.sellPrice.toFixed(2)).padEnd(12)} ${o.grossPct.padStart(6)} ${o.feesPct.padStart(5)} ${o.netPct.padStart(6)}  ${o.venues} venues ${o.maxDev.padStart(6)}%`);
    }
  }

  // Summary table
  console.log('\n=== PRICE DEVIATION BY PAIR (top 5) ===\n');
  console.log('Pair       AvgPrice    MaxDev    Venues');
  console.log('─'.repeat(50));

  for (const pair of PAIRS.slice(0, 5)) {
    const prices = {};
    const fetches = Object.entries(CEX_ENDPOINTS).map(([name, ep]) => fetchPrice(name, ep, pair));
    const results = await Promise.allSettled(fetches);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) prices[r.value.name] = r.value;
    }
    const vals = Object.values(prices);
    if (vals.length < 2) continue;
    const mids = vals.map(v => (v.bid + v.ask) / 2);
    const avg = mids.reduce((a, b) => a + b, 0) / mids.length;
    const maxDev = Math.max(...mids.map(m => Math.abs(m - avg) / avg * 100));
    console.log(`${pair.padEnd(10)} $${avg.toFixed(2).padStart(10)} ${maxDev.toFixed(3).padStart(7)}%  ${vals.length}`);
  }

  console.log(`\n=== SCAN COMPLETE — ${opportunities.length} opportunities found ===`);
}

main().catch(console.error);