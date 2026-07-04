/**
 * RPC-based DEX data source.
 * Queries DEX pools directly from the blockchain via public RPC endpoints.
 * No subgraph dependency. Works with any EVM-compatible chain.
 */
import type { DexPool, DexPoolSnapshot } from './types.js';

export interface RpcDexConfig {
  readonly rpcUrl: string;
  readonly factoryAddress: string;
  readonly poolCreatedTopic: string;
  readonly chainId: number;
  readonly maxBlockRange?: number;
}

const ERC20_ABI_SYMBOL = '0x95d89b41'; // keccak256("symbol()") first 4 bytes
const ERC20_ABI_DECIMALS = '0x313ce567'; // keccak256("decimals()") first 4 bytes
const ERC20_ABI_NAME = '0x06fdde03'; // keccak256("name()") first 4 bytes

export class RpcDexSource {
  private readonly rpcUrl: string;
  private readonly factoryAddress: string;
  private readonly poolCreatedTopic: string;
  private readonly chainId: number;
  private readonly maxBlockRange: number;
  private requestId = 0;

  constructor(config: RpcDexConfig) {
    this.rpcUrl = config.rpcUrl;
    this.factoryAddress = config.factoryAddress;
    this.poolCreatedTopic = config.poolCreatedTopic;
    this.chainId = config.chainId;
    this.maxBlockRange = config.maxBlockRange ?? 2000;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: ++this.requestId }),
    });
    const body = await res.json() as { result?: unknown; error?: { message: string } };
    if (body.error) throw new Error(`RPC error: ${body.error.message}`);
    return body.result;
  }

  async getBlockNumber(): Promise<number> {
    const result = await this.rpcCall('eth_blockNumber', []);
    return Number(result);
  }

  async getLogs(fromBlock: number, toBlock: number): Promise<Array<{ address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string }>> {
    if (toBlock - fromBlock > this.maxBlockRange) {
      throw new Error(`Block range ${toBlock - fromBlock} exceeds max ${this.maxBlockRange}`);
    }
    // Infura requires 32-byte padded addresses
    const paddedAddr = `0x${'000000000000000000000000'}${this.factoryAddress.slice(2)}`;
    const result = await this.rpcCall('eth_getLogs', [{
      address: paddedAddr,
      topics: [[this.poolCreatedTopic]],
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    }]) as Array<{ address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string }>;
    return result ?? [];
  }

  async getPools(fromBlock: number, toBlock: number): Promise<Array<{ poolAddress: string; token0: string; token1: string; fee: number; blockNumber: number; txHash: string }>> {
    const logs = await this.getLogs(fromBlock, toBlock);
    return logs.map((log) => {
      // Uniswap V3 PoolCreated event: token0, token1, fee, tickSpacing, pool
      const data = log.data.slice(2); // remove 0x
      const token0 = `0x${data.slice(24, 64)}`;
      const token1 = `0x${data.slice(88, 128)}`;
      const fee = parseInt(data.slice(128, 192), 16);
      return {
        poolAddress: `0x${log.topics[1]?.slice(26) ?? ''}`,
        token0: token0.toLowerCase(),
        token1: token1.toLowerCase(),
        fee,
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
      };
    });
  }

  async getTokenSymbol(tokenAddress: string): Promise<string> {
    try {
      const result = await this.rpcCall('eth_call', [{
        to: tokenAddress,
        data: ERC20_ABI_SYMBOL,
      }, 'latest']);
      const hex = (result as string).slice(2);
      const bytes = Buffer.from(hex, 'hex');
      return bytes.toString('utf8').replace(/\0/g, '').trim();
    } catch {
      return tokenAddress.slice(0, 6);
    }
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const result = await this.rpcCall('eth_call', [{
        to: tokenAddress,
        data: ERC20_ABI_DECIMALS,
      }, 'latest']);
      return Number(result);
    } catch {
      return 18;
    }
  }

  async getTokenName(tokenAddress: string): Promise<string> {
    try {
      const result = await this.rpcCall('eth_call', [{
        to: tokenAddress,
        data: ERC20_ABI_NAME,
      }, 'latest']);
      const hex = (result as string).slice(2);
      const bytes = Buffer.from(hex, 'hex');
      return bytes.toString('utf8').replace(/\0/g, '').trim();
    } catch {
      return tokenAddress.slice(0, 6);
    }
  }

  async getPoolLiquidity(poolAddress: string): Promise<string> {
    try {
      const result = await this.rpcCall('eth_call', [{
        to: poolAddress,
        data: '0xbfe0b7a8', // keccak256("liquidity()") first 4 bytes
      }, 'latest']);
      return (result as string) ?? '0x0';
    } catch {
      return '0x0';
    }
  }

  async getPoolSlot0(poolAddress: string): Promise<{ sqrtPrice: string; tick: number }> {
    try {
      const result = await this.rpcCall('eth_call', [{
        to: poolAddress,
        data: '0x3850c7bd', // keccak256("slot0()") first 4 bytes
      }, 'latest']);
      const hex = (result as string).slice(2);
      return {
        sqrtPrice: `0x${hex.slice(0, 64)}`,
        tick: parseInt(hex.slice(64, 128), 16),
      };
    } catch {
      return { sqrtPrice: '0x0', tick: 0 };
    }
  }
}