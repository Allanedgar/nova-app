/**
 * Real-Data Arbitrage Scan
 *
 * Connects to live CEX connectors and runs the arbitrage engine with real data.
 */
import {
  ENGINE_VERSION,
  DefaultStrategyRegistry,
  CexCrossExchangeStrategy,
  CrossVenueStrategy,
  CompositeBridgeManager,
  EventBus,
  PipelineOrchestrator,
  EngineScheduler,
} from '../packages/engine/src/index.js';

// CEX connectors
import { BinanceConnector, toBinanceSymbol } from '../packages/connectors/src/cex/binance.js';
import { CoinbaseConnector, toCoinbaseSymbol } from '../packages/connectors/src/cex/coinbase.js';
import { OkxConnector, toOkxSymbol } from '../packages/connectors/src/cex/okx.js';

const PAIRS = [
  { id: 'BTCUSDT', base: 'BTC', quote: 'USDT', binanceSym: toBinanceSymbol({ base: 'BTC', quote: 'USDT' }), okxSym: toOkxSymbol({ base: 'BTC', quote: 'USDT' }), coinbaseSym: toCoinbaseSymbol({ base: 'BTC', quote: 'USDT' }) },
  { id: 'ETHUSDT', base: 'ETH', quote: 'USDT', binanceSym: toBinanceSymbol({ base: 'ETH', quote: 'USDT' }), okxSym: toOkxSymbol({ base: 'ETH', quote: 'USDT' }), coinbaseSym: toCoinbaseSymbol({ base: 'ETH', quote: 'USDT' }) },
];

async function main() {
  console.log(`=== REAL-DATA ARBITRAGE SCAN v${ENGINE_VERSION} ===\n`);

  // We already know connectors export classes; use dynamic require/import fallback
  const connectorsToUse: Array<{ id: string; connector: any }> = [];

  for (const [id, Cls] of [
    ['binance', BinanceConnector],
    ['coinbase', CoinbaseConnector],
    ['okx', OKXConnector],
  ] as [string, any][]) {
    try {
      const instance = new Cls();
      connectorsToUse.push({ id, connector: instance });
    } catch (e: any) {
      console.log(`  ${id} connector init failed: ${e.message}`);
    }
  }

  const snapshots = [];

  for (const { id, connector } of connectorsToUse) {
    const prices: any = {};
    for (const pair of PAIRS) {
      try {
        let sym = pair.binanceSym;
        if (id === 'coinbase') sym = pair.coinbaseSym;
        if (id === 'okx') sym = pair.okxSym;
        const result = await (connector as any).fetchTicker?.({ base: pair.base, quote: pair.quote }) ?? null;
        if (result) {
          prices[pair.id] = result;
        }
      } catch (e: any) {
        // ignore single-pair errors
      }
    }
    if (Object.keys(prices).length > 0) {
      snapshots.push({
        venueId: id,
        venueKind: 'cex' as const,
        timestamp: Date.now(),
        pairs: PAIRS.filter(p => prices[p.id]).map(pair => ({
          venueId: id,
          normalizedSymbol: pair.id,
          baseAsset: pair.base,
          quoteAsset: pair.quote,
          bid: prices[pair.id].bid ?? prices[pair.id].price,
          ask: prices[pair.id].ask ?? prices[pair.id].price,
          last: String(prices[pair].price ?? prices[pair].last ?? '0'),
          volume24h: String(prices[pair].volume ?? '0'),
          bidDepth: '10',
          askDepth: '10',
        })),
      });
      console.log(`  ${id}: ${Object.keys(prices).length} pairs`);
    }
  }

  if (snapshots.length < 2) {
    console.log('\nInsufficient data — less than 2 connectors returned prices');
    process.exit(0);
  }

  console.log(`\nTotal snapshots: ${snapshots.length}`);

  const registry = new DefaultStrategyRegistry();
  registry.register(new CexCrossExchangeStrategy({ minNetProfitPct: 0.01 }));
  registry.register(new CrossVenueStrategy({ minNetProfitPct: 0.05 }));

  let totalCandidates = 0;

  for (const strategy of registry.getAll()) {
    console.log(`\n${strategy.displayName}:`);
    try {
      const candidates = await strategy.detect(snapshots);
      console.log(`  Candidates: ${candidates.length}`);
      totalCandidates += candidates.length;

      for (const c of candidates.slice(0, 5)) {
        console.log(`  ${c.kind}: net=${c.netProfitPct.toFixed(4)}% gross=${c.grossProfitPct.toFixed(4)}% fees=${c.estimatedFeesPct.toFixed(4)}%`);
        console.log(`    Legs:`);
        for (const leg of c.legs) {
          console.log(`      ${leg.action} ${leg.asset} on ${leg.venueId} @ ${leg.expectedPrice}`);
        }
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log(`\nTotal opportunities found: ${totalCandidates}`);
  process.exit(totalCandidates > 0 ? 0 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});