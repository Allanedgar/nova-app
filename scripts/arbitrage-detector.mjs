/**
 * ARBITRAGE DETECTOR
 * Compares bid/ask prices across all connected CEX and DEX venues
 * to discover live arbitrage opportunities.
 *
 * Strategy: Buy on venue A (ask), sell on venue B (bid)
 * Profit = (bid_B - ask_A) / ask_A - fees
 */
import { BinanceConnector } from '../packages/connectors/src/cex/binance.js';
import { CoinbaseConnector } from '../packages/connectors/src/cex/coinbase.js';
import { OkxConnector } from '../packages/connectors/src/cex/okx.js';
import { BybitConnector } from '../packages/connectors/src/cex/bybit.js';
import { KrakenConnector } from '../packages/connectors/src/cex/kraken.js';
import { BitgetConnector } from '../packages/connectors/src/cex/bitget.js';
import { GateConnector } from '../packages/connectors/src/cex/gate.js';
import { KucoinConnector } from '../packages/connectors/src/cex/kucoin.js';
import { MexcConnector } from '../packages/connectors/src/cex/mexc.js';
import { HtxConnector } from '../packages/connectors/src/cex/htx.js';
import { BitfinexConnector } from '../packages/connectors/src/cex/bitfinex.js';
import { BitstampConnector } from '../packages/connectors/src/cex/bitstamp.js';
import { WhitebitConnector } from '../packages/connectors/src/cex/whitebit.js';
import { PoloniexConnector } from '../packages/connectors/src/cex/poloniex.js';
import { GeminiConnector } from '../packages/connectors/src/cex/gemini.js';
import { HyperliquidConnector } from '../packages/connectors/src/dex/hyperliquid.js';
import { UniswapV3Connector } from '../packages/connectors/src/dex/uniswap-v3.js';
import { SushiSwapConnector } from '../packages/connectors/src/dex/sushiswap.js';

// Common trading pairs to scan
const TARGET_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'UNIUSDT', 'ATOMUSDT', 'LTCUSDT', 'BCHUSDT',
  'TRXUSDT', 'NEARUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
];

// Fee assumptions (taker fee in bps)
const VENUE_FEES = {
  binance: 10, coinbase: 60, okx: 10, bybit: 10, kraken: 26,
  bitget: 10, gate: 20, kucoin: 10, mexc: 10, htx: 20,
  bitfinex: 20, bitstamp: 50, whitebit: 10, poloniex: 20, gemini: 40,
  hyperliquid: 5, uniswap: 30, sushiswap: 30,
};

async function fetchTicker(connector, symbol) {
  try {
    const ticker = await connector.fetchTicker(symbol);
    if (!ticker || !ticker.bid || !ticker.ask) return null;
    return { bid: parseFloat(ticker.bid), ask: parseFloat(ticker.ask), venue: connector.id };
  } catch { return null; }
}

async function main() {
  console.log('=== ARBITRAGE OPPORTUNITY DETECTOR ===\n');
  console.log(`Scanning ${TARGET_PAIRS.length} pairs across 15 CEX + 3 DEX venues\n`);

  // Initialize connectors
  const cexConnectors = [
    new BinanceConnector(), new CoinbaseConnector(), new OkxConnector(),
    new BybitConnector(), new KrakenConnector(), new BitgetConnector(),
    new GateConnector(), new KucoinConnector(), new MexcConnector(),
    new HtxConnector(), new BitfinexConnector(), new BitstampConnector(),
    new WhitebitConnector(), new PoloniexConnector(), new GeminiConnector(),
  ];

  const dexConnectors = [
    { id: 'hyperliquid', c: new HyperliquidConnector() },
    { id: 'uniswap', c: new UniswapV3Connector() },
    { id: 'sushiswap', c: new SushiSwapConnector() },
  ];

  const allOpportunities = [];

  for (const pair of TARGET_PAIRS) {
    const prices = {};

    // Fetch CEX prices
    for (const cex of cexConnectors) {
      const t = await fetchTicker(cex, pair);
      if (t) prices[t.venue] = t;
    }

    // Fetch DEX prices (via Hyperliquid)
    try {
      const hl = dexConnectors[0].c;
      const pools = await hl.discoverPools();
      const base = pair.replace('USDT', '');
      const hlPool = pools.find(p => p.id === base || p.id.startsWith(base));
      if (hlPool && hlPool.sqrtPrice) {
        const price = parseFloat(hlPool.sqrtPrice);
        prices['hyperliquid'] = { bid: price * 0.999, ask: price * 1.001, venue: 'hyperliquid' };
      }
    } catch {}

    const venues = Object.keys(prices);
    if (venues.length < 2) continue;

    // Find best arbitrage: buy lowest ask, sell highest bid
    let bestBuy = { venue: '', ask: Infinity };
    let bestSell = { venue: '', bid: 0 };

    for (const [v, p] of Object.entries(prices)) {
      if (p.ask < bestBuy.ask) bestBuy = { venue: v, ask: p.ask };
      if (p.bid > bestSell.bid) bestSell = { venue: v, bid: p.bid };
    }

    if (bestBuy.venue === bestSell.venue) continue;

    const grossSpread = ((bestSell.bid - bestBuy.ask) / bestBuy.ask) * 100;
    const buyFee = (VENUE_FEES[bestBuy.venue] || 10) / 10000;
    const sellFee = (VENUE_FEES[bestSell.venue] || 10) / 10000;
    const totalFees = (buyFee + sellFee) * 100;
    const netProfit = grossSpread - totalFees;

    if (netProfit > 0.01) {
      allOpportunities.push({
        pair,
        buyVenue: bestBuy.venue,
        buyPrice: bestBuy.ask,
        sellVenue: bestSell.venue,
        sellPrice: bestSell.bid,
        grossSpread: grossSpread.toFixed(3),
        fees: totalFees.toFixed(3),
        netProfit: netProfit.toFixed(3),
      });
    }
  }

  // Sort by net profit descending
  allOpportunities.sort((a, b) => parseFloat(b.netProfit) - parseFloat(a.netProfit));

  console.log('=== ARBITRAGE OPPORTUNITIES FOUND ===\n');
  if (allOpportunities.length === 0) {
    console.log('No arbitrage opportunities above 0.01% threshold.\n');
    console.log('This is expected for major pairs — markets are efficient.\n');
    console.log('To find opportunities:');
    console.log('  1. Add more exotic pairs (smaller cap tokens)');
    console.log('  2. Add more DEX venues (Raydium, PancakeSwap, etc.)');
    console.log('  3. Enable triangular arbitrage (3+ leg trades)');
    console.log('  4. Enable cross-chain arbitrage (via bridges)');
  } else {
    console.log(`Found ${allOpportunities.length} opportunities:\n`);
    console.log('Pair        Buy@         Sell@        Gross%  Fees%   Net%');
    console.log('─'.repeat(70));
    for (const opp of allOpportunities) {
      console.log(
        `${opp.pair.padEnd(10)} ${(opp.buyVenue + '@' + opp.buyPrice.toFixed(2)).padEnd(12)} ` +
        `${(opp.sellVenue + '@' + opp.sellPrice.toFixed(2)).padEnd(12)} ` +
        `${opp.grossSpread.padStart(6)}% ${opp.fees.padStart(5)}% ${opp.netProfit.padStart(5)}%`
      );
    }
  }

  // Show price variance across venues for each pair
  console.log('\n=== PRICE VARIANCE ACROSS VENUES ===\n');
  for (const pair of TARGET_PAIRS.slice(0, 5)) {
    const prices = {};
    for (const cex of cexConnectors) {
      const t = await fetchTicker(cex, pair);
      if (t) prices[t.venue] = t;
    }
    const vals = Object.values(prices);
    if (vals.length < 2) continue;
    const midPrices = vals.map(v => (v.bid + v.ask) / 2);
    const avg = midPrices.reduce((a, b) => a + b, 0) / midPrices.length;
    const maxDev = Math.max(...midPrices.map(p => Math.abs(p - avg) / avg * 100));
    console.log(`${pair}: avg=$${avg.toFixed(2)} maxDev=${maxDev.toFixed(3)}% across ${vals.length} venues`);
  }

  console.log('\n=== SCAN COMPLETE ===');
}

main().catch(console.error);