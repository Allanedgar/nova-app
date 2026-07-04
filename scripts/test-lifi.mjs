/**
 * Test Li.Fi bridge aggregator connector.
 */
import { LiFiConnector } from '../packages/bridge/src/lifi.js';

async function main() {
  console.log('=== Li.Fi Bridge Aggregator Test ===\n');

  const lifi = new LiFiConnector();

  // Health
  const health = await lifi.health();
  console.log(`Health: ${health.status} (${health.latencyMs}ms)`);

  // Chains
  const chains = await lifi.getChains();
  console.log(`Chains: ${chains.length}`);
  console.log(`Sample: ${chains.slice(0, 5).map(c => `${c.name}(${c.id})`).join(', ')}`);

  // Routes
  const routes = await lifi.getRoutes();
  console.log(`\nRoutes: ${routes.length}`);
  const bridgeCounts = {};
  for (const r of routes) {
    bridgeCounts[r.bridgeId] = (bridgeCounts[r.bridgeId] || 0) + 1;
  }
  console.log('Bridges with routes:');
  for (const [bridge, count] of Object.entries(bridgeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bridge}: ${count} routes`);
  }

  // Token prices
  const tokens = await lifi.getTokenPrices(1);
  console.log(`\nTokens on Ethereum: ${tokens.length}`);
  console.log(`Sample: ${tokens.slice(0, 5).map(t => `${t.symbol}=$${t.priceUSD}`).join(', ')}`);

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);