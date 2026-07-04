/**
 * DEX pool discovery with Alchemy (10-block range limit on free tier).
 * Uses recent blocks to find newly created pools.
 */
import { RpcDexSource } from '../packages/dex/src/rpc-source.js';
import { CONFIG } from '../packages/dex/src/config.js';

const chains = [
  { name: 'Ethereum', rpcUrl: CONFIG.alchemy.eth, factory: CONFIG.factories.uniswapV3, topic: CONFIG.poolTopics.uniswapV3, chainId: 1 },
  { name: 'Polygon', rpcUrl: CONFIG.alchemy.polygon, factory: CONFIG.factories.uniswapV3, topic: CONFIG.poolTopics.uniswapV3, chainId: 137 },
  { name: 'Arbitrum', rpcUrl: CONFIG.alchemy.arbitrum, factory: CONFIG.factories.uniswapV3, topic: CONFIG.poolTopics.uniswapV3, chainId: 42161 },
  { name: 'Base', rpcUrl: CONFIG.alchemy.base, factory: CONFIG.factories.uniswapV3, topic: CONFIG.poolTopics.uniswapV3, chainId: 8453 },
];

async function main() {
  console.log('=== DEX Pool Discovery via Alchemy (10-block range) ===\n');

  for (const chain of chains) {
    console.log(`\n--- ${chain.name} ---`);
    try {
      const source = new RpcDexSource({
        rpcUrl: chain.rpcUrl,
        factoryAddress: chain.factory,
        poolCreatedTopic: chain.topic,
        chainId: chain.chainId,
        maxBlockRange: 10,
      });

      const blockNumber = await source.getBlockNumber();
      console.log(`  Current block: ${blockNumber}`);

      // Scan last 10 blocks
      const fromBlock = Math.max(0, blockNumber - 10);
      const pools = await source.getPools(fromBlock, blockNumber);
      console.log(`  Pools in last 10 blocks: ${pools.length}`);

      if (pools.length > 0) {
        const p = pools[0];
        const sym0 = await source.getTokenSymbol(p.token0);
        const sym1 = await source.getTokenSymbol(p.token1);
        const liq = await source.getPoolLiquidity(p.poolAddress);
        const slot0 = await source.getPoolSlot0(p.poolAddress);
        console.log(`  Pool: ${sym0}/${sym1} (fee=${p.fee}bps)`);
        console.log(`  Liquidity: ${BigInt(liq).toString()}`);
        console.log(`  Tick: ${slot0.tick}`);
      } else {
        console.log(`  No pools created in last 10 blocks (normal — pools aren't created every block)`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }

  // Also test The Graph subgraph with API key
  console.log('\n--- The Graph Subgraph (Uniswap V3) ---');
  try {
    const graphUrl = `https://gateway.thegraph.com/api/${CONFIG.graphApiKey}/subgraphs/id/5zvR82doa4kPZJ3RjP1iMqdq8Qm3T3E4wK9KjGmJXK`;
    const res = await fetch(graphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
    });
    const body = await res.json();
    if (body.data) {
      console.log(`  Connected! Block: ${body.data._meta?.block?.number}`);
    } else {
      console.log(`  Error: ${JSON.stringify(body.errors?.[0]?.message)}`);
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  console.log('\n=== Test Complete ===');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });