/**
 * All 20 DEX connectors, defined via configuration.
 * Each entry specifies subgraph URL, factory address, fee tiers, and chain.
 */
import { BaseDexConnector, type BaseDexDeps } from './base.js';
import type { DexInfo, DexPool, DexPoolSnapshot } from './types.js';

interface DexConfig {
  id: string;
  info: DexInfo;
  poolQuery: string;
  parsePool: (raw: unknown) => DexPool | null;
  parseSnapshot: (raw: unknown) => DexPoolSnapshot | null;
}

const defaultPoolQuery = `{
  pools(first: 1000, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    liquidity
    volumeUSD
    totalValueLockedUSD
    feeTier
    token0 { id symbol decimals }
    token1 { id symbol decimals }
    createdAtBlockNumber
    createdAtTimestamp
  }
}`;

const defaultParsePool = (raw: unknown): DexPool | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const t0 = r.token0 as Record<string, unknown> | undefined;
  const t1 = r.token1 as Record<string, unknown> | undefined;
  if (!t0 || !t1) return null;
  return {
    id: String(r.id ?? ''),
    address: String(r.id ?? ''),
    token0: { id: String(t0.id ?? ''), symbol: String(t0.symbol ?? ''), decimals: Number(t0.decimals ?? 18) },
    token1: { id: String(t1.id ?? ''), symbol: String(t1.symbol ?? ''), decimals: Number(t1.decimals ?? 18) },
    feeTier: Number(r.feeTier ?? 3000),
    liquidity: String(r.liquidity ?? '0'),
    volumeUSD: String(r.volumeUSD ?? '0'),
    totalValueLockedUSD: String(r.totalValueLockedUSD ?? '0'),
    createdAtBlock: Number(r.createdAtBlockNumber ?? 0),
    createdAtTimestamp: Number(r.createdAtTimestamp ?? 0),
  };
};

const defaultParseSnapshot = (raw: unknown): DexPoolSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pool = r.pool as Record<string, unknown> | undefined;
  return {
    id: String(r.id ?? ''),
    pool: { id: String(pool?.id ?? r.id ?? '') },
    liquidity: String(r.liquidity ?? '0'),
    volumeUSD: String(r.volumeUSD ?? '0'),
    totalValueLockedUSD: String(r.totalValueLockedUSD ?? '0'),
    token0Price: String(r.token0Price ?? '0'),
    token1Price: String(r.token1Price ?? '0'),
    timestamp: Number(r.timestamp ?? Date.now()),
  };
};

const DEX_CONFIGS: DexConfig[] = [
  {
    id: 'uniswap-v2', info: { name: 'Uniswap V2', code: 'uniswap-v2', url: 'https://uniswap.org', chain: 'ethereum', version: '2', factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', feeTiers: [30] },
    poolQuery: `{ pairs(first: 1000, orderBy: reserveUSD, orderDirection: desc) { id reserve0 reserve1 volumeUSD reserveUSD token0 { id symbol decimals } token1 { id symbol decimals } createdAtBlockNumber createdAtTimestamp } }`,
    parsePool: (raw) => { if (!raw || typeof raw !== 'object') return null; const r = raw as Record<string, unknown>; const t0 = r.token0 as Record<string, unknown> | undefined; const t1 = r.token1 as Record<string, unknown> | undefined; if (!t0 || !t1) return null; return { id: String(r.id ?? ''), address: String(r.id ?? ''), token0: { id: String(t0.id ?? ''), symbol: String(t0.symbol ?? ''), decimals: Number(t0.decimals ?? 18) }, token1: { id: String(t1.id ?? ''), symbol: String(t1.symbol ?? ''), decimals: Number(t1.decimals ?? 18) }, feeTier: 30, liquidity: String(r.reserve0 ?? '0'), volumeUSD: String(r.volumeUSD ?? '0'), totalValueLockedUSD: String(r.reserveUSD ?? '0'), createdAtBlock: Number(r.createdAtBlockNumber ?? 0), createdAtTimestamp: Number(r.createdAtTimestamp ?? 0) }; },
    parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'uniswap-v3', info: { name: 'Uniswap V3', code: 'uniswap-v3', url: 'https://uniswap.org', chain: 'ethereum', version: '3', factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3', feeTiers: [5, 30, 100, 1000] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'uniswap-v4', info: { name: 'Uniswap V4', code: 'uniswap-v4', url: 'https://uniswap.org', chain: 'ethereum', version: '4', factoryAddress: '0x0000000000000000000000000000000000000000', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v4', feeTiers: [1, 5, 10, 30, 100, 1000] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'pancakeswap', info: { name: 'PancakeSwap', code: 'pancakeswap', url: 'https://pancakeswap.finance', chain: 'bsc', version: '3', factoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc', feeTiers: [25, 100, 250, 1000] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'curve', info: { name: 'Curve', code: 'curve', url: 'https://curve.fi', chain: 'ethereum', version: '2', factoryAddress: '0x0000000000000000000000000000000000000000', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/curvefi/curve', feeTiers: [1] },
    poolQuery: `{ pools(first: 1000) { id address name symbol underlyingCoins { id symbol decimals } baseAPR virtualPrice liquidity volumeUSD createdAt } }`,
    parsePool: (raw) => { if (!raw || typeof raw !== 'object') return null; const r = raw as Record<string, unknown>; return { id: String(r.id ?? ''), address: String(r.address ?? r.id ?? ''), token0: { id: '', symbol: String(r.symbol ?? ''), decimals: 18 }, token1: { id: '', symbol: String(r.name ?? ''), decimals: 18 }, feeTier: 1, liquidity: String(r.liquidity ?? '0'), volumeUSD: String(r.volumeUSD ?? '0'), totalValueLockedUSD: String(r.liquidity ?? '0'), createdAtBlock: 0, createdAtTimestamp: Number(r.createdAt ?? 0) }; },
    parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'balancer', info: { name: 'Balancer', code: 'balancer', url: 'https://balancer.fi', chain: 'ethereum', version: '2', factoryAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2', feeTiers: [1, 5, 10, 30, 100] },
    poolQuery: `{ pools(first: 1000, orderBy: totalLiquidity, orderDirection: desc) { id address poolType swapFee totalLiquidity volume tokens { address symbol decimals } createTime } }`,
    parsePool: (raw) => { if (!raw || typeof raw !== 'object') return null; const r = raw as Record<string, unknown>; const tokens = (r.tokens as unknown[]) ?? []; const t0 = tokens[0] as Record<string, unknown> | undefined; const t1 = tokens[1] as Record<string, unknown> | undefined; return { id: String(r.id ?? ''), address: String(r.address ?? r.id ?? ''), token0: { id: String(t0?.address ?? ''), symbol: String(t0?.symbol ?? ''), decimals: Number(t0?.decimals ?? 18) }, token1: { id: String(t1?.address ?? ''), symbol: String(t1?.symbol ?? ''), decimals: Number(t1?.decimals ?? 18) }, feeTier: Number(r.swapFee ?? 30) * 10000, liquidity: String(r.totalLiquidity ?? '0'), volumeUSD: String(r.volume ?? '0'), totalValueLockedUSD: String(r.totalLiquidity ?? '0'), createdAtBlock: 0, createdAtTimestamp: Number(r.createTime ?? 0) }; },
    parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'sushi', info: { name: 'SushiSwap', code: 'sushi', url: 'https://sushi.com', chain: 'ethereum', version: '2', factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/sushi/trident', feeTiers: [30] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'aerodrome', info: { name: 'Aerodrome', code: 'aerodrome', url: 'https://aerodrome.finance', chain: 'base', version: '1', factoryAddress: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/aerodrome/aerodrome', feeTiers: [1, 5, 10, 30, 100] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'raydium', info: { name: 'Raydium', code: 'raydium', url: 'https://raydium.io', chain: 'solana', version: '4', factoryAddress: '', subgraphUrl: 'https://api.raydium.io/v2/main/pools', feeTiers: [25] },
    poolQuery: '', parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'orca', info: { name: 'Orca', code: 'orca', url: 'https://www.orca.so', chain: 'solana', version: '2', factoryAddress: '', subgraphUrl: 'https://api.orca.so/v1/pools', feeTiers: [3, 5, 10, 30, 100, 200] },
    poolQuery: '', parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'trader-joe', info: { name: 'Trader Joe', code: 'trader-joe', url: 'https://traderjoexyz.com', chain: 'avalanche', version: '2.1', factoryAddress: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange', feeTiers: [5, 10, 25, 50, 100, 200] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'camelot', info: { name: 'Camelot', code: 'camelot', url: 'https://camelot.exchange', chain: 'arbitrum', version: '3', factoryAddress: '0x6EcCab422D763aC031210895C81787E87B43A652', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/camelot/exchange', feeTiers: [1, 5, 10, 30, 100] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'velodrome', info: { name: 'Velodrome', code: 'velodrome', url: 'https://velodrome.finance', chain: 'optimism', version: '2', factoryAddress: '0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/velodrome-finance/velodrome-v2', feeTiers: [1, 5, 10, 30, 100] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'syncswap', info: { name: 'SyncSwap', code: 'syncswap', url: 'https://syncswap.xyz', chain: 'zksync-era', version: '1', factoryAddress: '0x0000000000000000000000000000000000000000', subgraphUrl: 'https://api.studio.thegraph.com/query/1234/syncswap/v0.0.1', feeTiers: [1, 5, 30, 100] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'hyperliquid-spot', info: { name: 'Hyperliquid Spot', code: 'hyperliquid-spot', url: 'https://hyperliquid.xyz', chain: 'arbitrum', version: '1', factoryAddress: '', subgraphUrl: 'https://api.hyperliquid.xyz/info', feeTiers: [1] },
    poolQuery: '', parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'dydx', info: { name: 'dYdX', code: 'dydx', url: 'https://dydx.exchange', chain: 'ethereum', version: '4', factoryAddress: '', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/dydx/dydx-v4', feeTiers: [1, 5] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: '1inch', info: { name: '1inch', code: '1inch', url: 'https://1inch.io', chain: 'ethereum', version: '5', factoryAddress: '', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/1inch/1inch', feeTiers: [1, 3, 5, 10, 30] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'gmx', info: { name: 'GMX', code: 'gmx', url: 'https://gmx.io', chain: 'arbitrum', version: '2', factoryAddress: '', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/gmx-io/gmx-arbitrum', feeTiers: [5] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'cetus', info: { name: 'Cetus', code: 'cetus', url: 'https://cetus.zone', chain: 'sui', version: '1', factoryAddress: '', subgraphUrl: 'https://api.cetus.zone/v1/pools', feeTiers: [1, 5, 10, 30, 100] },
    poolQuery: '', parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
  {
    id: 'thruster', info: { name: 'Thruster', code: 'thruster', url: 'https://thruster.fi', chain: 'blast', version: '1', factoryAddress: '0x0000000000000000000000000000000000000000', subgraphUrl: 'https://api.thegraph.com/subgraphs/name/thrusterfi/thruster', feeTiers: [1, 5, 10, 30, 100] },
    poolQuery: defaultPoolQuery, parsePool: defaultParsePool, parseSnapshot: defaultParseSnapshot,
  },
];

export function createAllDexConnectors(fetchImpl?: typeof fetch): BaseDexConnector[] {
  return DEX_CONFIGS.map((cfg) => new BaseDexConnector({
    id: cfg.id,
    info: cfg.info,
    fetchImpl,
    subgraphUrl: cfg.info.subgraphUrl,
    factoryAddress: cfg.info.factoryAddress,
    poolQuery: cfg.poolQuery,
    parsePool: cfg.parsePool,
    parseSnapshot: cfg.parseSnapshot,
  }));
}