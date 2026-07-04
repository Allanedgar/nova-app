/**
 * Comprehensive DEX discovery test using Alchemy RPC.
 * Tests pool discovery across Ethereum, Polygon, Arbitrum, and Base.
 */
import { RpcDexSource } from '../packages/dex/src/rpc-source.js';
import { CONFIG } from '../packages/dex/src/config.js';

const chains = [
  {
    name: 'Ethereum',
    rpcUrl: CONFIG.alchemy.eth,
    factory: CONFIG.factories.uniswapV3,
    topic: CONFIG.poolTopics.uniswapV3,
    chainId: 1,
  },
  {
    name: 'Polygon',
    rpcUrl: CONFIG.alchemy.polygon,
    factory: CONFIG.factories.uniswapV3,
    topic: CONFIG.poolTopics.uniswapV3,
    chainId: 137,
  },
  {
    name: 'Arbitrum',
    rpcUrl: CONFIG.alchemy.arbitrum,
    factory: CONFIG.factories.uniswapV3,
    topic: CONFIG.poolTopics.uniswapV3,
    chainId: 42161,
  },
  {
    name: 'Base',
    rpcUrl: CONFIG.alchemy.base,
    factory: CONFIG.factories.uniswapV3,
    topic: CONFIG.poolTopics.uniswapV3,
    chainId: 8453,
  },
];

async function main() {
  console.log('=== DEX Pool Discovery via Alchemy RPC ===\n');

  for (const chain of chains) {
    console.log(`\n--- ${chain.name} (chain ${chain.chainId}) ---`);
    try {
      const source = new RpcDexSource({
        rpcUrl: chain.rpcUrl,
        factoryAddress: chain.factory,
        poolCreatedTopic: chain.topic,
        chainId: chain.chainId,
        maxBlockRange: 2000,
      });

      const started = Date.now();
      const blockNumber = await source.getBlockNumber();
      console.log(`  Block: ${blockNumber} (${Date.now() - started}ms)`);

      const fromBlock = Math.max(0, blockNumber - 2000);
      const pools = await source.getPools(fromBlock, blockNumber);
      console.log(`  Pools in last 2000 blocks: ${pools.length}`);

      if (pools.length > 0) {
        const p = pools[0];
        const sym0 = await source.getTokenSymbol(p.token0);
        const sym1 = await source.getTokenSymbol(p.token1);
        const liq = await source.getPoolLiquidity(p.poolAddress);
        const slot0 = await source.getPoolSlot0(p.poolAddress);
        console.log(`  Sample pool: ${sym0}/${sym1} (fee=${p.fee}bps)`);
        console.log(`  Liquidity: ${BigInt(liq).toString()}`);
        console.log(`  Tick: ${slot0.tick}`);
      }

      console.log(`  Total time: ${Date.now() - started}ms`);
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }

  console.log('\n=== Test Complete ===');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });