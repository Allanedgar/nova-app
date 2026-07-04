/**
 * Metadata Resolver — resolves asset metadata from on-chain contracts or external APIs.
 * Uses official APIs only: Etherscan, CoinGecko, Blockscout, etc.
 */
import type { AssetEntry, MetadataResolver } from '../types.js';

export class DefaultMetadataResolver implements MetadataResolver {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async resolveAsset(symbol: string, chainId?: number): Promise<AssetEntry | null> {
    try {
      const chainParam = chainId ? `&chain_id=${chainId}` : '';
      const resp = await this.fetchImpl(`https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}?localization=false${chainParam}`);
      if (!resp.ok) return null;
      const data = (await resp.json()) as Record<string, unknown>;
      const detail = data as {
        id?: string; symbol?: string; name?: string; detail_platforms?: Record<string, unknown>;
        contract_address?: string; decimals?: number;
      };
      if (!detail.symbol) return null;
      const entry: AssetEntry = {
        id: `${chainId ?? 1}:${symbol.toUpperCase()}`,
        symbol: symbol.toUpperCase(),
        name: detail.name ?? symbol,
        decimals: detail.decimals ?? 18,
        contractAddress: detail.contract_address ?? undefined,
        chainId: chainId ?? undefined,
        firstSeenAt: Date.now(),
        lastObservedAt: Date.now(),
        venues: [],
      };
      return entry;
    } catch {
      return null;
    }
  }

  async resolveContract(chainId: number, address: string): Promise<AssetEntry | null> {
    const chainName = this.chainIdToName(chainId);
    const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}`;
    try {
      const resp = await this.fetchImpl(url);
      if (!resp.ok) return null;
      const data = (await resp.json()) as Record<string, unknown>;
      if (data.status !== '1') return null;
      return {
        id: `${chainId}:${address.toLowerCase()}`,
        symbol: '',
        name: '',
        decimals: 18,
        contractAddress: address.toLowerCase(),
        chainId,
        firstSeenAt: Date.now(),
        lastObservedAt: Date.now(),
        venues: [],
      };
    } catch {
      return null;
    }
  }

  private chainIdToName(id: number): string {
    const names: Record<number, string> = {
      1: 'ethereum', 137: 'polygon', 56: 'bsc', 43114: 'avalanche', 10: 'optimism',
      42161: 'arbitrum', 8453: 'base', 250: 'fantom', 100: 'gnosis', 324: 'zksync-era',
    };
    return names[id] ?? 'unknown';
  }
}