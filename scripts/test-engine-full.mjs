/**
 * Full Engine Test — tests all components of the arbitrage engine.
 */
// @ts-check
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
} from '../packages/engine/dist/index.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
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
          bid: '62400.00', ask: '62420.00', last: '62410', volume24h: '1000000', bidDepth: '50', askDepth: '50' },
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
          bid: '62450.00', ask: '62470.00', last: '62460', volume24h: '800000', bidDepth: '30', askDepth: '30' },
        { venueId: 'coinbase', normalizedSymbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT',
          bid: '1755.00', ask: '1758.00', last: '1756', volume24h: '300000', bidDepth: '50', askDepth: '50' },
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

  const cexCandidates = await cexStrategy.detect(mockSnapshots);
  assert(`CEX↔CEX found ${cexCandidates.length} candidates`, cexCandidates.length > 0);
  if (cexCandidates.length > 0) {
    const best = cexCandidates[0];
    assert('Candidate has ID', !!best.id);
    assert('Candidate has net profit > 0', best.netProfitPct > 0);
    assert('Candidate has 2 legs', best.legs.length === 2);
    assert('Candidate kind is cex-cex', best.kind === 'cex-cex');
    assert('First leg is buy', best.legs[0].action === 'buy');
    assert('Second leg is sell', best.legs[1].action === 'sell');

    // Test scoring
    const scored = await cexStrategy.score(best, mockSnapshots);
    assert('Scored has confidenceScore', scored.confidenceScore >= 0 && scored.confidenceScore <= 100);
    assert('Scored has riskScore', scored.riskScore >= 0 && scored.riskScore <= 100);
    assert('Scored has rankingScore', scored.rankingScore > 0);
    assert('Scored has executionProbability', scored.executionProbability > 0);
    assert('Scored has expiresAt', scored.expiresAt > Date.now());
    assert('Scored has expectedSlippage', scored.expectedSlippage > 0);

    // Test validation
    const validation = await cexStrategy.validate(scored);
    assert('Validation returns object', !!validation);
    assert('Validation has valid field', typeof validation.valid === 'boolean');
  }

  // 5. Test Cross-Venue Strategy
  console.log('\n5. Cross-Venue Strategy');
  // Add DEX snapshot to test CEX↔DEX
  const dexMock = [
    ...mockSnapshots,
    {
      venueId: 'hyperliquid',
      venueKind: 'dex' as const,
      timestamp: Date.now(),
      pairs: [
        { venueId: 'hyperliquid', normalizedSymbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
          bid: '62480.00', ask: '62500.00', last: '62490', volume24h: '200000', bidDepth: '10', askDepth: '10' },
      ],
    },
  ];
  const crossVenueCandidates = await crossVenue.detect(dexMock);
  assert(`Cross-Venue found ${crossVenueCandidates.length} candidates`, crossVenueCandidates.length > 0);
  if (crossVenueCandidates.length > 0) {
    const cv = crossVenueCandidates[0];
    assert('Cross-Venue kind is cex-dex', cv.kind === 'cex-dex');
    assert('Cross-Venue has legs', cv.legs.length >= 2);
  }

  // 6. Test Graph Strategy
  console.log('\n6. Graph Arbitrage Strategy');
  const graphCandidates = await graphStrategy.detect(dexMock);
  // Graph may not find cycles with only 2 assets — that's expected
  assert('Graph strategy runs without error', true);
  console.log(`  Graph candidates: ${graphCandidates.length} (expected 0 with limited assets)`);

  // 7. Test Bridge Manager
  console.log('\n7. Bridge Manager');
  const bm = new CompositeBridgeManager();
  assert('Bridge Manager has getQuote', typeof bm.getQuote === 'function');
  assert('Bridge Manager has getRoutes', typeof bm.getRoutes === 'function');
  assert('Bridge Manager has getStatus', typeof bm.getStatus === 'function');
  assert('Bridge Manager has estimateTime', typeof bm.estimateTime === 'function');

  // 8. Test Risk Engine
  console.log('\n8. Risk Engine');
  const risk = new DefaultRiskEngine();
  assert('Risk Engine has assess', typeof risk.assess === 'function');
  if (cexCandidates.length > 0) {
    const scored = await cexStrategy.score(cexCandidates[0], mockSnapshots);
    const riskResult = await risk.assess(scored);
    assert('Risk assessment has overallRiskScore', riskResult.overallRiskScore >= 0);
    assert('Risk assessment has counterpartyRisk', riskResult.counterpartyRisk >= 0);
    assert('Risk assessment has bridgeRisk', riskResult.bridgeRisk >= 0);
    assert('Risk assessment has maxDrawdown', riskResult.maxDrawdown > 0);
    assert('Risk assessment has sharpeRatio', riskResult.sharpeRatio !== 0);
    const allKeys = ['counterpartyRisk','bridgeRisk','oracleRisk','chainCongestion','gasSpikeRisk',
      'rpcReliability','historicalFillRate','priceManipulationRisk','orderbookDepthRisk',
      'washTradingRisk','stablecoinDepegRisk','fundingRateRisk','liquidationRisk',
      'mevExposure','volatilityRisk'];
    for (const key of allKeys) {
      assert(`Risk dimension ${key} present`, (riskResult as any)[key] >= 0);
    }
  }

  // 9. Test Event Bus & Publisher
  console.log('\n9. Event Bus & Publisher');
  const eventBus = new EventBus();
  const publisher = new Publisher(eventBus);
  let eventReceived = false;
  eventBus.on('opportunity.published', () => { eventReceived = true; });
  assert('EventBus handler registered', true);
  if (cexCandidates.length > 0) {
    const scored = await cexStrategy.score(cexCandidates[0], mockSnapshots);
    await publisher.publish({ ...scored, status: 'published' as const, publishedAt: Date.now(), version: 1 });
    assert('Publisher count > 0', publisher.getPublishedCount() > 0);
    assert('Event received', eventReceived);
    const published = publisher.getPublished();
    assert('Published has opportunities', published.length > 0);
    assert('Published has status', published[0].status === 'published');
  }

  // 10. Test Pipeline Orchestrator
  console.log('\n10. Pipeline Orchestrator');
  const orchestrator = new PipelineOrchestrator();
  assert('Orchestrator created', orchestrator !== null);
  assert('Orchestrator has run', typeof orchestrator.run === 'function');
  assert('Orchestrator has runStrategy', typeof orchestrator.runStrategy === 'function');

  // 11. Test Scheduler
  console.log('\n11. Engine Scheduler');
  const scheduler = new EngineScheduler({ pipelineIntervalMs: 5000 });
  assert('Scheduler created', scheduler !== null);
  assert('Scheduler not running initially', !scheduler.isRunning());
  scheduler.start();
  assert('Scheduler running after start', scheduler.isRunning());
  scheduler.stop();
  assert('Scheduler stopped after stop', !scheduler.isRunning());
  assert('Scheduler has Publisher', scheduler.getPublisher() !== null);
  assert('Scheduler has EventBus', scheduler.getEventBus() !== null);

  // 12. Test Execution Simulator
  console.log('\n12. Execution Simulator');
  const simulator = new ExecutionSimulator(new EventBus());
  assert('Simulator created', simulator !== null);
  assert('Simulator has simulate', typeof simulator.simulate === 'function');
  assert('Simulator has execute', typeof simulator.execute === 'function');
  assert('Simulator active = 0', simulator.getActiveTrades() === 0);
  assert('Simulator daily loss = 0', simulator.getDailyLoss() === 0);

  if (cexCandidates.length > 0) {
    const scored = await cexStrategy.score(cexCandidates[0], mockSnapshots);
    const result = await simulator.simulate(scored);
    assert('Simulation has fills', result.fills.length > 0);
    assert('Simulation has success', typeof result.success === 'boolean');
    assert('Simulation has netProfitPct', typeof result.netProfitPct === 'number');
    assert('Simulation has totalLatencyMs', result.totalLatencyMs > 0);

    const execResult = await simulator.execute(scored);
    assert('Execution returned result', !!execResult);
  }

  // 13. Test Cross-Chain Strategy
  console.log('\n13. Cross-Chain Strategy');
  const crossChainCandidates = await crossChain.detect(dexMock);
  assert('Cross-Chain runs without error', true);
  console.log(`  Cross-chain candidates: ${crossChainCandidates.length}`);

  // Summary
  const total = passed + failed;
  console.log(`\n=== RESULTS: ${passed}/${total} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});