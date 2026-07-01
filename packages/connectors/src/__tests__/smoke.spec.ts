import { describe, expect, it } from 'vitest';
import {
  ConnectorRegistry,
  NOVA_CONNECTORS_VERSION,
  activeConnectorsOfKind,
  overallStatus,
  parseEnabledConnectors,
} from '../index.js';
import type { Connector, ExchangeInfo } from '@nova-app/shared';

const INFO: ExchangeInfo = {
  code: 'stub',
  name: 'Stub',
  url: 'https://stub.local',
  rateLimitMs: 1000,
  takerFeeBps: 10,
  makerFeeBps: 8,
};

const stubCex = (id: string): Connector => ({
  id,
  kind: 'cex',
  info: INFO,
  fetchSnapshot: async () => null,
  fetchHealth: async () => ({ status: 'active', latencyMs: 1, checkedAt: 0 }),
});

const stubDex = (id: string): Connector => ({
  id,
  kind: 'dex',
  info: INFO,
  fetchSnapshot: async () => null,
  fetchHealth: async () => ({ status: 'active', latencyMs: 1, checkedAt: 0 }),
});

describe('@nova-app/connectors smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_CONNECTORS_VERSION).toBe('0.1.0');
  });

  it('parseEnabledConnectors handles empty / missing / normal env', () => {
    expect(parseEnabledConnectors(undefined)).toEqual([]);
    expect(parseEnabledConnectors('')).toEqual([]);
    expect(parseEnabledConnectors('binance')).toEqual(['binance']);
    expect(parseEnabledConnectors(' binance , OKX ,uniswap-v3 ')).toEqual([
      'binance',
      'okx',
      'uniswap-v3',
    ]);
  });

  it('ConnectorRegistry registers, looks up, and reports', () => {
    const r = new ConnectorRegistry();
    r.registerAll([stubCex('binance'), stubCex('okx'), stubDex('uniswap-v3')]);
    expect(r.get('binance')?.id).toBe('binance');
    expect(r.get('kraken')).toBeUndefined();
    expect(r.unregister('binance')).toBe(true);
    expect(r.get('binance')).toBeUndefined();
    expect(r.unregister('binance')).toBe(false); // idempotent
    expect(r.healthSnapshot()).toEqual({ total: 2, cex: 1, dex: 1, bridge: 0 });
  });

  it('activeConnectorsOfKind + overallStatus filter correctly', () => {
    const r = new ConnectorRegistry();
    r.registerAll([stubCex('binance'), stubDex('uniswap-v3')]);
    expect(activeConnectorsOfKind(r, 'cex')).toHaveLength(1);
    expect(activeConnectorsOfKind(r, 'bridge')).toHaveLength(0);
    expect(overallStatus(r)).toBe('active');
    expect(overallStatus(new ConnectorRegistry())).toBe('maintenance');
  });

  it('hasOnly enforces allowlist', () => {
    const r = new ConnectorRegistry();
    r.register(stubCex('binance'));
    expect(r.hasOnly(['binance', 'okx'])).toBe(true);
    r.register(stubCex('kraken'));
    expect(r.hasOnly(['binance', 'okx'])).toBe(false);
  });
});
