/**
 * Test RPC-based DEX data source against real Ethereum RPC.
 * Tests Uniswap V3 pool discovery via on-chain events.
 * Uses multiple public RPC endpoints and small block ranges.
 */
import { RpcDexSource } from '../packages/dex/src/rpc-source.js';

const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const POOL_CREATED_TOPIC = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b9d9b7b0e4c9b';

async function main() {
  console.log('=== RPC DEX Source Test ===\n');

  const rpcUrls = [
    { url: 'https://1rpc.io/eth', range: 50 },
    { url: 'https://eth.drpc.org', range: 500 },
    { url: 'https://ethereum-rpc.publicnode.com', range: 500 },
  ];

  for (const { url, range } of rpcUrls) {
    console.log(`Testing RPC: ${url}`);
    try {
      const source = new RpcDexSource({
        rpcUrl: url,
        factoryAddress: UNISWAP_V3_FACTORY,
        poolCreatedTopic: POOL_CREATED_TOPIC,
        chainId: 1,
      });

      const started = Date.now();
      const blockNumber = await source.getBlockNumber();
      const blockTime = Date.now() - started;
      console.log(`  Block number: ${blockNumber} (${blockTime}ms)`);

      const fromBlock = Math.max(0, blockNumber - range);
      const pools = await source.getPools(fromBlock, blockNumber);
      console.log(`  Pools in last ${range} blocks: ${pools.length}`);

      if (pools.length > 0) {
        const pool = pools[0];
        const now = Date.now();
        const symbol0 = await source.getTokenSymbol(pool.token0);
        const symbol1 = await source.getTokenSymbol(pool.token1);
        const elapsed = Date.now() - now;

        console.log(`  Pool: ${pool.poolAddress}`);
        console.log(`  ${symbol0} / ${symbol1} (fee=${pool.fee}bps)`);
        console.log(`  Token symbols resolved in ${elapsed}ms`);

        const liq = await source.getPoolLiquidity(pool.poolAddress);
        const slot0 = await source.getPoolSlot0(pool.poolAddress);
        console.log(`  Liquidity: ${BigInt(liq).toString()}`);
        console.log(`  Tick: ${slot0.tick}`);
      }

      console.log(`  RPC OK (total ${Date.now() - started}ms)\n`);
    } catch (e) {
      console.log(`  RPC ERROR: ${e.message}\n`);
    }
  }

  console.log('=== Test Complete ===');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });