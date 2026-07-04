/**
 * All 20 bridge connectors, defined via configuration.
 */
import { BaseBridgeConnector } from './base.js';
import type { BridgeInfo, BridgeRoute, BridgeQuote } from './types.js';

interface BridgeConfig {
  id: string;
  info: BridgeInfo;
  baseUrl: string;
  routesPath: string;
  quotePath: string;
  parseRoute: (raw: unknown) => BridgeRoute | null;
  parseQuote: (raw: unknown) => BridgeQuote | null;
}

const defaultParseRoute = (raw: unknown): BridgeRoute | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? r.routeId ?? ''),
    sourceChain: String(r.sourceChain ?? r.fromChain ?? ''),
    destinationChain: String(r.destinationChain ?? r.toChain ?? ''),
    tokenSymbol: String(r.tokenSymbol ?? r.symbol ?? ''),
    tokenAddress: String(r.tokenAddress ?? r.address ?? ''),
    estimatedFee: String(r.estimatedFee ?? r.fee ?? '0'),
    estimatedFeeUsd: Number(r.estimatedFeeUsd ?? r.feeUsd ?? 0),
    estimatedTimeMs: Number(r.estimatedTimeMs ?? r.timeMs ?? 60000),
    minAmount: String(r.minAmount ?? r.min ?? '0'),
    maxAmount: String(r.maxAmount ?? r.max ?? '0'),
    liquidity: String(r.liquidity ?? '0'),
    isActive: r.isActive !== false,
  };
};

const defaultParseQuote = (raw: unknown): BridgeQuote | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    routeId: String(r.routeId ?? r.id ?? ''),
    amount: String(r.amount ?? '0'),
    estimatedFee: String(r.estimatedFee ?? r.fee ?? '0'),
    estimatedFeeUsd: Number(r.estimatedFeeUsd ?? r.feeUsd ?? 0),
    estimatedTimeMs: Number(r.estimatedTimeMs ?? r.timeMs ?? 60000),
    maxSlippage: Number(r.maxSlippage ?? r.slippage ?? 0.005),
    bridgeFee: String(r.bridgeFee ?? r.fee ?? '0'),
    gasFee: String(r.gasFee ?? r.gas ?? '0'),
    totalFee: String(r.totalFee ?? String(Number(r.bridgeFee ?? 0) + Number(r.gasFee ?? 0))),
  };
};

const BRIDGE_CONFIGS: BridgeConfig[] = [
  { id: 'across', info: { name: 'Across', code: 'across', url: 'https://across.to', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon'], feeStructure: 'variable', avgTransferTimeMs: 60000, hasNativeToken: true }, baseUrl: 'https://api.across.to', routesPath: '/routes', quotePath: '/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'stargate', info: { name: 'Stargate', code: 'stargate', url: 'https://stargate.finance', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'avalanche', 'bsc'], feeStructure: 'fixed+variable', avgTransferTimeMs: 120000, hasNativeToken: true }, baseUrl: 'https://api.stargate.finance', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'layerzero', info: { name: 'LayerZero', code: 'layerzero', url: 'https://layerzero.network', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'avalanche', 'bsc', 'solana'], feeStructure: 'variable', avgTransferTimeMs: 60000, hasNativeToken: true }, baseUrl: 'https://api.layerzero.network', routesPath: '/v2/routes', quotePath: '/v2/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'wormhole', info: { name: 'Wormhole', code: 'wormhole', url: 'https://wormhole.com', supportedChains: ['ethereum', 'solana', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'optimism', 'base'], feeStructure: 'fixed', avgTransferTimeMs: 15000, hasNativeToken: true }, baseUrl: 'https://api.wormhole.com', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'hyperlane', info: { name: 'Hyperlane', code: 'hyperlane', url: 'https://hyperlane.xyz', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'moonbeam'], feeStructure: 'variable', avgTransferTimeMs: 120000, hasNativeToken: false }, baseUrl: 'https://api.hyperlane.xyz', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'axelar', info: { name: 'Axelar', code: 'axelar', url: 'https://axelar.network', supportedChains: ['ethereum', 'polygon', 'avalanche', 'moonbeam', 'fantom'], feeStructure: 'fixed+variable', avgTransferTimeMs: 180000, hasNativeToken: true }, baseUrl: 'https://api.axelar.network', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'debridge', info: { name: 'deBridge', code: 'debridge', url: 'https://debridge.finance', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc'], feeStructure: 'variable', avgTransferTimeMs: 60000, hasNativeToken: true }, baseUrl: 'https://api.debridge.finance', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'hop', info: { name: 'Hop', code: 'hop', url: 'https://hop.exchange', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'gnosis'], feeStructure: 'fixed', avgTransferTimeMs: 60000, hasNativeToken: true }, baseUrl: 'https://api.hop.exchange', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'ccip', info: { name: 'Chainlink CCIP', code: 'ccip', url: 'https://chain.link/cross-chain', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'avalanche', 'base'], feeStructure: 'fixed+variable', avgTransferTimeMs: 120000, hasNativeToken: false }, baseUrl: 'https://api.ccip.chain.link', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'relay', info: { name: 'Relay', code: 'relay', url: 'https://relay.link', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base'], feeStructure: 'variable', avgTransferTimeMs: 60000, hasNativeToken: false }, baseUrl: 'https://api.relay.link', routesPath: '/routes', quotePath: '/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'rhino', info: { name: 'Rhino', code: 'rhino', url: 'https://rhino.fi', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'zksync'], feeStructure: 'variable', avgTransferTimeMs: 60000, hasNativeToken: false }, baseUrl: 'https://api.rhino.fi', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'symbiosis', info: { name: 'Symbiosis', code: 'symbiosis', url: 'https://symbiosis.finance', supportedChains: ['ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum', 'optimism', 'tron'], feeStructure: 'variable', avgTransferTimeMs: 120000, hasNativeToken: true }, baseUrl: 'https://api.symbiosis.finance', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'polygon-bridge', info: { name: 'Polygon Bridge', code: 'polygon-bridge', url: 'https://bridge.polygon.technology', supportedChains: ['ethereum', 'polygon'], feeStructure: 'fixed', avgTransferTimeMs: 1800000, hasNativeToken: false }, baseUrl: 'https://api-bridge.polygon.technology', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'arbitrum-bridge', info: { name: 'Arbitrum Bridge', code: 'arbitrum-bridge', url: 'https://bridge.arbitrum.io', supportedChains: ['ethereum', 'arbitrum'], feeStructure: 'fixed', avgTransferTimeMs: 600000, hasNativeToken: false }, baseUrl: 'https://api-bridge.arbitrum.io', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'optimism-bridge', info: { name: 'Optimism Bridge', code: 'optimism-bridge', url: 'https://app.optimism.io/bridge', supportedChains: ['ethereum', 'optimism'], feeStructure: 'fixed', avgTransferTimeMs: 600000, hasNativeToken: false }, baseUrl: 'https://api-bridge.optimism.io', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'base-bridge', info: { name: 'Base Bridge', code: 'base-bridge', url: 'https://bridge.base.org', supportedChains: ['ethereum', 'base'], feeStructure: 'fixed', avgTransferTimeMs: 600000, hasNativeToken: false }, baseUrl: 'https://api-bridge.base.org', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'mayan', info: { name: 'Mayan', code: 'mayan', url: 'https://mayan.finance', supportedChains: ['solana', 'ethereum', 'arbitrum', 'polygon'], feeStructure: 'variable', avgTransferTimeMs: 30000, hasNativeToken: true }, baseUrl: 'https://api.mayan.finance', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'butter', info: { name: 'Butter', code: 'butter', url: 'https://butter.xyz', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon'], feeStructure: 'variable', avgTransferTimeMs: 60000, hasNativeToken: false }, baseUrl: 'https://api.butter.xyz', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'usdt0', info: { name: 'USDT0', code: 'usdt0', url: 'https://usdt0.com', supportedChains: ['ethereum', 'tron', 'solana', 'polygon', 'avalanche', 'bsc'], feeStructure: 'fixed', avgTransferTimeMs: 120000, hasNativeToken: false }, baseUrl: 'https://api.usdt0.com', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
  { id: 'cctp', info: { name: 'Circle CCTP', code: 'cctp', url: 'https://www.circle.com/en/cross-chain-transfer', supportedChains: ['ethereum', 'arbitrum', 'optimism', 'base', 'avalanche', 'solana'], feeStructure: 'fixed', avgTransferTimeMs: 30000, hasNativeToken: false }, baseUrl: 'https://api.circle.com/cctp', routesPath: '/v1/routes', quotePath: '/v1/quote?routeId={routeId}&amount={amount}', parseRoute: defaultParseRoute, parseQuote: defaultParseQuote },
];

export function createAllBridgeConnectors(fetchImpl?: typeof fetch): BaseBridgeConnector[] {
  return BRIDGE_CONFIGS.map((cfg) => new BaseBridgeConnector({
    id: cfg.id,
    info: cfg.info,
    fetchImpl,
    baseUrl: cfg.baseUrl,
    routesPath: cfg.routesPath,
    quotePath: cfg.quotePath,
    parseRoute: cfg.parseRoute,
    parseQuote: cfg.parseQuote,
  }));
}