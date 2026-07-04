/**
 * Live verification test for all bridge connectors.
 * Tests Li.Fi aggregator + dedicated connectors.
 */
import { LiFiConnector } from '../packages/bridge/src/lifi.js';
import { AcrossConnector } from '../packages/bridge/src/across.js';
import { WormholeConnector } from '../packages/bridge/src/wormhole.js';

async function main() {
  console.log('=== Live Bridge Verification ===\n');

  // Li.Fi aggregator
  console.log('--- Li.Fi Bridge Aggregator ---');
  const lifi = new LiFiConnector();
  const lifiHealth = await lifi.health();
  console.log(`Health: ${lifiHealth.status} (${lifiHealth.latencyMs}ms)`);

  const lifiRoutes = await lifi.getRoutes();
  console.log(`Routes generated: ${lifiRoutes.length}`);

  // Show bridge coverage
  const bridgeCounts = {};
  for (const r of lifiRoutes) {
    bridgeCounts[r.bridgeId] = (bridgeCounts[r.bridgeId] || 0) + 1;
  }
  console.log('Bridges covered:');
  const sortedBridges = Object.entries(bridgeCounts).sort((a, b) => b[1] - a[1]);
  for (const [bridge, count] of sortedBridges) {
    console.log(`  ${bridge}: ${count} routes`);
  }

  // Get chains
  const chains = await lifi.getChains();
  console.log(`\nChains: ${chains.length}`);
  console.log(`Sample chains: ${chains.slice(0, 10).map(c => c.name).join(', ')}`);

  // Get token prices
  const tokens = await lifi.getTokenPrices(1);
  console.log(`Tokens on Ethereum: ${tokens.length}`);
  console.log(`Sample tokens: ${tokens.slice(0, 5).map(t => `${t.symbol}=$${parseFloat(t.priceUSD).toFixed(4)}`).join(', ')}`);

  // Test dedicated connectors
  console.log('\n--- Dedicated Bridge Connectors ---');

  // Across
  console.log('\nAcross Protocol:');
  const across = new AcrossConnector();
  const acrossHealth = await across.health();
  console.log(`Health: ${acrossHealth.status} (${acrossHealth.latencyMs}ms)`);
  const acrossRoutes = await across.getRoutes();
  console.log(`Routes: ${acrossRoutes.length}`);
  const acrossPools = await across.getPools();
  console.log(`Pools: ${acrossPools.length}`);
  for (const pool of acrossPools) {
    const sizeUSDM = (BigInt(pool.totalPoolSize) / BigInt(10**18)).toLocaleString();
    const apy = (parseFloat(pool.apy) * 100).toFixed(2);
    console.log(`  Token: ${pool.token.slice(0,10)} Pool: $${sizeUSDM} APY: ${apy}%`);
  }

  // Wormhole
  console.log('\nWormhole:');
  const worm = new WormholeConnector();
  const wormHealth = await worm.health();
  console.log(`Health: ${wormHealth.status} (${wormHealth.latencyMs}ms)`);
  const wormRoutes = await worm.getRoutes();
  console.log(`Routes: ${wormRoutes.length}`);

  console.log('\n=== Bridge Verification Complete ===');
  console.log(`Total bridge connectors verified: 3 (Li.Fi, Across, Wormhole)`);
  console.log(`Li.Fi route coverage: ${sortedBridges.length} bridge protocols across ${chains.length} chains`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });