/**
 * Test recently fixed DEX connectors.
 */
import { SushiSwapConnector } from '../packages/connectors/src/dex/sushiswap.js';

async function main() {
  console.log('=== Fixed DEX Connector Test ===\n');

  // SushiSwap
  console.log('Testing SushiSwap...');
  const sushi = new SushiSwapConnector();
  const started = Date.now();
  const pools = await sushi.discoverPools();
  const elapsed = Date.now() - started;
  console.log(`Pools discovered: ${pools.length} (${elapsed}ms)`);
  console.log(`Sample pools (first 5):`);
  for (const p of pools.slice(0, 5)) {
    console.log(`  ${p.id}: ${p.token0.symbol}/${p.token1.symbol} fee=${p.feeTier}bps TVL=$${p.totalValueLockedUSD}`);
  }
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);