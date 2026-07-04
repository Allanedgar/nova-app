/**
 * Full Engine Test — TypeScript version.
 * Tests all components of the arbitrage engine.
 */
import {
  ENGINE_VERSION,
  DefaultStrategyRegistry,
  CexCrossExchangeStrategy,
  CrossVenueStrategy,
  CrossChainStrategy,
  GraphArbitrageStrategy,
  CompositeBridgeManager,
  DefaultRiskEngine,
  EventBus,
  Publisher,
  EngineScheduler,
  PipelineOrchestrator,
  ExecutionSimulator,
} from '../packages/engine/src/index.js';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`=== ARBITRAGE ENGINE v${ENGINE_VERSION} — FULL TEST ===\n`);

  // 1. Test Version
  console.log('1. Engine Version');
  assert('ENGINE_VERSION is defined', ENGINE_VERSION === '1.0.0');
  assert('ENGINE_VERSION is string', typeof ENGINE_VERSION === 'string');

  // 2. Test Strategy Registration
  console.log('\n2. Strategy Registration');
  const registry = new DefaultStrategyRegistry();
  assert('Registry created', registry !== null);
  assert('Registry count 0 initially', registry.count() === 0);

  const cexStrategy = new CexCrossExchangeStrategy();
  registry.register(cexStrategy);
  assert('CEX↔CEX registered', registry.count() === 1);
  assert('Get by ID works', registry.get('cex-cross-exchange')?.id === 'cex-cross-exchange');
  assert('Get by kind works', registry.getByKind('cex-cex').length === 1);

  const crossVenue = new CrossVenueStrategy();
  registry.register(crossVenue);
  assert('Cross-Venue registered', registry.count() === 2);

  const graphStrategy = new GraphArbitrageStrategy();
  registry.register(graphStrategy);
  assert('Graph Arbitrage registered', registry.count() === 3);

  const bridgeManager = new CompositeBridgeManager();
  const crossChain = new CrossChainStrategy(bridgeManager);
  registry.register(crossChain);
  assert('Cross-Chain registered', registry.count() === 4);

  assert('Get all returns 4', registry.getAll().length === 4);
  assert('Unregister works', (() => { registry.unregister('cross-chain'); return registry.count() === 3; })());
  registry.register(crossChain);
  assert('Re-registered cross-chain', registry.count() === 4);

  // 3. Test Strategy Interface Compliance
  console.log('\n3. Strategy Interface');
  for (const s of registry.getAll()) {
    assert(`${s.id} has detect()`, typeof s.detect === 'function');
    assert(`${s.id} has score()`, typeof s.score === 'function');
    assert(`${s.id} has validate()`, typeof s.validate === 'function');
    assert(`${s.id} has id`, typeof s.id === 'string' && s.id.length > 0);
    assert(`${s.id} has kind`, typeof s.kind === 'string');
    assert(`${s.id} has version`, s.version === '1.0.0');
  }

  // 4. Test Snapshot Detection with Mock Data
  console.log('\n4. Detection with Mock Data');
  const mockSnapshots = [
    {
      venueId: 'binance',
      venueKind: 'cex' as const,
      timestamp: Date.now(),
      pairs: [
        { venueId: 'binance', normalizedSymbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
          bid: '62000.00', ask: '62010.00', last: '62005', volume24h: '1000000', bidDepth: '50', askDepth: '50' },
        { venueId: 'binance', normalizedSymbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT',
          bid: '1750.00', ask: '1752.00', last: '1751', volume24h: '500000', bidDepth: '100', askDepth: '100' },
      ],
    },
    {
      venueId: 'coinbase',
      venueKind: 'cex' as const,
      timestamp: Date.now(),
      pairs: [
        { venueId: 'coinbase', normalizedSymbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
          bid: '62500.00', ask: '62520.00', last: '62510', volume24h: '800000', bidDepth: '30', askDepth: '30' },
        { venueId: 'coinbase', normalizedSymbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT',
          bid: '1760.00', ask: '1763.00', last: '1761', volume24h: '300000', bidDepth: '50', askDepth: '50' },
      ],
    },
    {
      venueId: 'okx',
      venueKind: 'cex' as const,
      timestamp: Date.now(),
      pairs: [
        { venueId: 'okx', normalizedSymbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
          bid: '62430.00', ask: '62450.00', last: '62440', volume24h: '600000', bidDepth: '40', askDepth: '40' },
      ],
    },
  ];

  const cexCandidates = await cexStrategy.detect(mockSnapshots as any);
  assert(`CEX↔CEX found ${cexCandidates.length} candidates`, cexCandidates.length > 0);
  if (cexCandidates.length > 0) {
    const best = cexCandidates[0];
    assert('Candidate has ID', !!best.id);
    assert('Candidate has net profit > 0', best.netProfitPct > 0);
    assert('Candidate has 2 legs', best.legs.length === 2);
    assert('Candidate kind is cex-cex', best.kind === 'cex-cex');
    assert('First leg is buy', best.legs[0].action === 'buy');
    assert('Second leg is sell', best.legs[1].action === 'sell');

    const scored = await cexStrategy.score(best, mockSnapshots as any);
    assert('Scored has confidenceScore', scored.confidenceScore >= 0 && scored.confidenceScore <= 100);
    assert('Scored has riskScore', scored.riskScore >= 0 && scored.riskScore <= 100);
    assert('Scored has rankingScore', scored.rankingScore > 0);
    assert('Scored has executionProbability', scored.executionProbability > 0);
    assert('Scored has expiresAt', scored.expiresAt > Date.now());
    assert('Scored has expectedSlippage', scored.expectedSlippage > 0);

    const validation = await cexStrategy.validate(scored);
    assert('Validation returns object', !!validation);
    assert('Validation has valid field', typeof validation.valid === 'boolean');
  }

  // 5. Test Cross-Venue Strategy
  console.log('\n5. Cross-Venue Strategy');
  const dexMock = [
    ...mockSnapshots,
    {
      venueId: 'hyperliquid',
      venueKind: 'dex' as const,
      timestamp: Date.now(),
      pairs: [
        { venueId: 'hyperliquid', normalizedSymbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
          bid: '63200.00', ask: '63300.00', last: '63250', volume24h: '200000', bidDepth: '10', askDepth: '10' },
        { venueId: 'hyperliquid', normalizedSymbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT',
          bid: '85.00', ask: '85.50', last: '85.25', volume24h: '50000', bidDepth: '20', askDepth: '20' },
      ],
    },
  ];
  const crossVenueCandidates = await crossVenue.detect(dexMock as any);
  assert(`Cross-Venue found ${crossVenueCandidates.length} candidates`, crossVenueCandidates.length > 0);

  // 6. Test Graph Strategy
  console.log('\n6. Graph Arbitrage Strategy');
  await graphStrategy.detect(dexMock as any);
  assert('Graph strategy runs without error', true);

  // 7. Test Bridge Manager
  console.log('\n7. Bridge Manager');
  assert('Bridge Manager has getQuote', typeof bridgeManager.getQuote === 'function');
  assert('Bridge Manager has getRoutes', typeof bridgeManager.getRoutes === 'function');

  // 8. Test Risk Engine
  console.log('\n8. Risk Engine');
  const risk = new DefaultRiskEngine();
  assert('Risk Engine has assess', typeof risk.assess === 'function');
  if (cexCandidates.length > 0) {
    const scored = await cexStrategy.score(cexCandidates[0], mockSnapshots as any);
    const riskResult = await risk.assess(scored);
    assert('Risk assessment has overallRiskScore', riskResult.overallRiskScore >= 0);
    assert('Risk assessment has counterpartyRisk', riskResult.counterpartyRisk >= 0);
    assert('Risk has maxDrawdown', riskResult.maxDrawdown > 0);
    assert('Risk has sharpeRatio', riskResult.sharpeRatio !== 0);
  }

  // 9. Test Event Bus & Publisher
  console.log('\n9. Event Bus & Publisher');
  const eventBus = new EventBus();
  const publisher = new Publisher(eventBus);
  let eventReceived = false;
  eventBus.on('opportunity.published', () => { eventReceived = true; });
  if (cexCandidates.length > 0) {
    const scored = await cexStrategy.score(cexCandidates[0], mockSnapshots as any);
    await publisher.publish({ ...scored, status: 'published' as const, publishedAt: Date.now(), version: 1 });
    assert('Publisher count > 0', publisher.getPublishedCount() > 0);
    assert('Event received', eventReceived);
  }

  // 10. Test Scheduler
  console.log('\n10. Engine Scheduler');
  const scheduler = new EngineScheduler({ pipelineIntervalMs: 5000 });
  assert('Scheduler not running initially', !scheduler.isRunning());
  scheduler.start();
  assert('Scheduler running after start', scheduler.isRunning());
  scheduler.stop();
  assert('Scheduler stopped after stop', !scheduler.isRunning());

  // 11. Test Execution Simulator
  console.log('\n11. Execution Simulator');
  const simulator = new ExecutionSimulator(new EventBus());
  assert('Simulator has simulate', typeof simulator.simulate === 'function');
  assert('Simulator active = 0', simulator.getActiveTrades() === 0);
  assert('Simulator daily loss = 0', simulator.getDailyLoss() === 0);

  if (cexCandidates.length > 0) {
    const scored = await cexStrategy.score(cexCandidates[0], mockSnapshots as any);
    const result = await simulator.simulate(scored);
    assert('Simulation has fills', result.fills.length > 0);
    assert('Simulation has netProfitPct', typeof result.netProfitPct === 'number');

    const execResult = await simulator.execute(scored);
    assert('Execution returned result', !!execResult);
  }

  // Summary
  const total = passed + failed;
  console.log(`\n=== RESULTS: ${passed}/${total} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});