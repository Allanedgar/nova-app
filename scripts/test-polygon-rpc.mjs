import { RpcDexSource } from '../packages/dex/src/rpc-source.js';
import { POLYGON_RPC, QUICKSWAP_FACTORY, QUICKSWAP_POOL_TOPIC } from '../packages/dex/src/polygon-rpc.js';

async function main() {
  console.log('=== Polygon RPC DEX Test ===\n');
  console.log('RPC:', POLYGON_RPC);
  console.log('Factory:', QUICKSWAP_FACTORY);

  const source = new RpcDexSource({
    rpcUrl: POLYGON_RPC,
    factoryAddress: QUICKSWAP_FACTORY,
    poolCreatedTopic: QUICKSWAP_POOL_TOPIC,
    chainId: 137,
    maxBlockRange: 500,
  });

  const blockNumber = await source.getBlockNumber();
  console.log('Block:', blockNumber);

  const fromBlock = Math.max(0, blockNumber - 500);
  const pools = await source.getPools(fromBlock, blockNumber);
  console.log('Pools found:', pools.length);

  if (pools.length > 0) {
    const p = pools[0];
    console.log('Sample:', p.poolAddress, p.fee, p.token0.slice(0,10), p.token1.slice(0,10));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });