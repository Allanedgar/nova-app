/**
 * Provider configuration for DEX, RPC, and subgraph endpoints.
 * Configure with your own API keys.
 */
export const CONFIG = {
  // Alchemy RPC endpoints
  alchemy: {
    eth: 'https://eth-mainnet.g.alchemy.com/v2/YSNXIukLT6gsJCetBsI0Z',
    polygon: 'https://polygon-mainnet.g.alchemy.com/v2/YSNXIukLT6gsJCetBsI0Z',
    arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/YSNXIukLT6gsJCetBsI0Z',
    base: 'https://base-mainnet.g.alchemy.com/v2/YSNXIukLT6gsJCetBsI0Z',
    optimism: 'https://opt-mainnet.g.alchemy.com/v2/YSNXIukLT6gsJCetBsI0Z',
  },
  // Infura as fallback
  infura: {
    eth: 'https://mainnet.infura.io/v3/c2e01af4a56e4a798ded77a76b80f3d3',
    polygon: 'https://polygon-mainnet.infura.io/v3/c2e01af4a56e4a798ded77a76b80f3d3',
    arbitrum: 'https://arbitrum-mainnet.infura.io/v3/c2e01af4a56e4a798ded77a76b80f3d3',
  },
  // dRPC endpoints
  drpc: {
    hyperliquid: 'https://lb.drpc.live/hyperliquid/AjqoIQ55VEBaqkA8pXsz8vH-46fLdzMR8avLVjewFaCJ',
  },
  // Hyperliquid direct API
  hyperliquid: {
    info: 'https://api.hyperliquid.xyz/info',
    exchange: 'https://api.hyperliquid.xyz/exchange',
  },
  // Across bridge API
  across: {
    apiKey: 'acx_lnUV9Ze7WOCy42QM0VKY-I1Q2xIjI0Ou',
    baseUrl: 'https://across.to/api',
  },
  // Li.Fi bridge aggregator API (covers 20+ bridges)
  lifi: {
    apiKey: 'f9e0f97a-7d56-47dc-b62c-2ce0aa8cd35d.95fbe9c4-b7ec-4407-83b0-bd8642b1f4e5',
    baseUrl: 'https://li.quest/v1',
  },
  // The Graph API (decentralized network)
  graphApiKey: 'd75dc37422039e26da48515512a2b11a',
  graphApiKeyFull: 'graph_d75dc37422039e26da48515512a2b11a',
  graphGateway: 'https://gateway.thegraph.com/api',
  // Uniswap V3 subgraph
  uniswapV3SubgraphId: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  // Uniswap API
  uniswap: {
    apiKey: 'IxpQj5VhvGOSoHsRL8sIugoCXt0xA50QDOXkEEvY54E',
    baseUrl: 'https://gateway.thegraph.com/api',
  },
  // Jupiter API
  jupiter: {
    apiKey: 'jup_f776fbd7cbb74168900ff35d2a8c18ade79b70b2536873d30ebcafa655187132',
    baseUrl: 'https://api.jup.ag/swap/v1',
  },
  // Balancer v3 subgraph
  balancerV3SubgraphId: 'FFK9Fa8fdBrAugNVFqRZVAtrej7FjsQNq1s9LVBhF4FX',
  // SushiSwap subgraph (corrected ID)
  sushiswapSubgraphId: '2tGWMrDha4164KkFAfkU3rDCtuxGb4q1emXmFdLLzJ8x',
  // Axelar endpoints
  axelar: {
    rpc: 'https://axelar-rpc.pops.one:443',
    ws: 'wss://axelar-rpc.pops.one/websocket',
    publicnode: 'https://axelar.publicnode.com:443',
  },
  // DEX factory addresses
  factories: {
    uniswapV3: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    uniswapV2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    pancakeswap: '0x1097053Fd2ea711dad45caCcc45EfF7548fCB362',
    sushiswap: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    curve: '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5',
    balancer: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  },
  // PoolCreated event topics
  poolTopics: {
    uniswapV3: '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b9d9b7b0e4c9b',
    uniswapV2: '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9',
    pancakeswap: '0x0bbcb2f346b3dc1e8d5e9fcc1a04a3552400e0ab',
  },
} as const;