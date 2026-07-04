/**
 * @nova-app/connectors — registry of all venue connectors.
 * Per docs/07_CONNECTOR_SPECIFICATION.md §1.2 + docs/05_MONOREPO_STRUCTURE.md.
 */

import type { Connector, ConnectorKind, ConnectorStatus } from '@nova-app/shared';
import { ConnectorRegistry } from './registry.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- re-exported below
import { NOVA_CONNECTORS_VERSION } from './version.js';
import { BinanceConnector } from './cex/binance.js';
import { OkxConnector } from './cex/okx.js';
import { KrakenConnector } from './cex/kraken.js';
import { BybitConnector } from './cex/bybit.js';
import { BitgetConnector } from './cex/bitget.js';
import { KucoinConnector } from './cex/kucoin.js';
import { CoinbaseConnector } from './cex/coinbase.js';
import { GateConnector } from './cex/gate.js';
import { MexcConnector } from './cex/mexc.js';
import { HtxConnector } from './cex/htx.js';
import { BitfinexConnector } from './cex/bitfinex.js';
import { BitstampConnector } from './cex/bitstamp.js';
import { CryptocomConnector } from './cex/cryptocom.js';
import { WhitebitConnector } from './cex/whitebit.js';
import { BingxConnector } from './cex/bingx.js';
import { PhemexConnector } from './cex/phemex.js';
import { LbankConnector } from './cex/lbank.js';
import { PoloniexConnector } from './cex/poloniex.js';
import { BackpackConnector } from './cex/backpack.js';
import { GeminiConnector } from './cex/gemini.js';

export { NOVA_CONNECTORS_VERSION } from './version.js';
export { ConnectorRegistry } from './registry.js';
export type { RegistryHealthReport } from './registry.js';

export function parseEnabledConnectors(env: string | undefined): readonly string[] {
  if (!env) return [];
  return env.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}

export function activeConnectorsOfKind(registry: ConnectorRegistry, kind: ConnectorKind): readonly Connector[] {
  const all = registry.all();
  return all.filter((c) => c.kind === kind && ((c as unknown as { info: { rateLimitMs: number } }).info.rateLimitMs ?? -1) >= 0);
}

export function overallStatus(registry: ConnectorRegistry): ConnectorStatus {
  const all = registry.all();
  if (all.length === 0) return 'maintenance';
  if (all.some((c) => ((c as unknown as { info: { code: string } }).info.code ?? '') === '')) return 'degraded';
  return 'active';
}

export async function fetchSnapshot(c: { fetchTicker(pair: { base: string; quote: string }): Promise<import('@nova-app/shared').PriceSnapshot | null> }, pair: { base: string; quote: string }): Promise<import('@nova-app/shared').PriceSnapshot | null> {
  return c.fetchTicker(pair);
}

export function createDefaultRegistry(): ConnectorRegistry {
  const registry = new ConnectorRegistry();
  registry.registerAll([
    new BinanceConnector(),
    new OkxConnector(),
    new KrakenConnector(),
    new BybitConnector(),
    new BitgetConnector(),
    new KucoinConnector(),
    new CoinbaseConnector(),
    new GateConnector(),
    new MexcConnector(),
    new HtxConnector(),
    new BitfinexConnector(),
    new BitstampConnector(),
    new CryptocomConnector(),
    new WhitebitConnector(),
    new BingxConnector(),
    new PhemexConnector(),
    new LbankConnector(),
    new PoloniexConnector(),
    new BackpackConnector(),
    new GeminiConnector(),
  ]);
  return registry;
}