/**
 * Test the new Hyperliquid DEX and Across bridge connectors.
 */
import { HyperliquidConnector } from '../packages/connectors/src/dex/hyperliquid.js';
import { AcrossConnector } from '../packages/bridge/src/across.js';

async function main() {
  console.log('=== New Connector Tests ===\n');

  // Test Hyperliquid
  console.log('--- Hyperliquid DEX ---');
  const hl = new HyperliquidConnector();
  const hlHealth = await hl.health();
  console.log(`  Health: ${hlHealth.status} (${hlHealth.latencyMs}ms)`);

  const pools = await hl.discoverPools();
  console.log(`  Pools discovered: ${pools.length}`);
  const sample = pools.slice(0, 5);
  for (const p of sample) {
    console.log(`  ${p.id}: ${p.sqrtPrice}`);
  }

  // Test Across
  console.log('\n--- Across Bridge ---');
  const across = new AcrossConnector();
  const acHealth = await across.health();
  console.log(`  Health: ${acHealth.status} (${acHealth.latencyMs}ms)`);

  const pools2 = await across.getPools();
  console.log(`  Pools: ${pools2.length}`);
  for (const p of pools2) {
    const size = (BigInt(p.totalPoolSize) / BigInt(10**6)).toString();
    console.log(`  Token ${p.token.slice(0,10)}: $${size} pool, ${(Number(p.apy)*100).toFixed(2)}% APY`);
  }

  console.log('\n=== Test Complete ===');
}

main().catch((e) => { console.error(e); process.exit(1); });