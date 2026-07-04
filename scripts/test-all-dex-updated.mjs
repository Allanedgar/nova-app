/**
 * Test all DEX connectors with corrected API keys and subgraph IDs.
 */
import { SushiSwapConnector } from '../packages/connectors/src/dex/sushiswap.js';
import { UniswapV3Connector } from '../packages/connectors/src/dex/uniswap-v3.js';
import { BalancerV3Connector } from '../packages/connectors/src/dex/balancer-v3.js';
import { JupiterConnector } from '../packages/connectors/src/dex/jupiter.js';
import { HyperliquidConnector } from '../packages/connectors/src/dex/hyperliquid.js';

const connectors = [
  { name: 'SushiSwap', c: new SushiSwapConnector() },
  { name: 'Uniswap V3', c: new UniswapV3Connector() },
  { name: 'Balancer v3', c: new BalancerV3Connector() },
  { name: 'Jupiter', c: new JupiterConnector() },
  { name: 'Hyperliquid', c: new HyperliquidConnector() },
];

async function main() {
  console.log('=== Updated DEX Connector Test ===\n');
  let ok = 0;
  for (const { name, c } of connectors) {
    const started = Date.now();
    try {
      const health = await c.health();
      if (health.status !== 'active') {
        console.log(`  ${name}: ${health.status} (${Date.now() - started}ms)`);
        continue;
      }
      const pools = await c.discoverPools();
      const elapsed = Date.now() - started;
      console.log(`  ${name}: ${pools.length} pools ✅ (${elapsed}ms)`);
      if (pools.length > 0) {
        const p = pools[0];
        console.log(`    Sample: ${p.token0.symbol}/${p.token1.symbol} TVL=$${p.totalValueLockedUSD}`);
      }
      ok++;
    } catch (e) {
      console.log(`  ${name}: ❌ ${e.message}`);
    }
  }
  console.log(`\n${ok}/${connectors.length} DEX connectors working`);
}

main().catch(console.error);