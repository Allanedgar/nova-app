import { describe, expect, it } from 'vitest';
import { NOVA_SHARED_VERSION } from '../index.js';
import type { Connector, ExchangeInfo, PriceSnapshot, TradingPair } from '../index.js';

describe('@nova-app/shared smoke', () => {
  it('exports the correct version', () => {
    expect(NOVA_SHARED_VERSION).toBe('0.1.0');
  });

  it('Connector type compiles with a stub implementation', () => {
    const info: ExchangeInfo = {
      code: 'stub',
      name: 'Stub',
      url: 'https://stub.local',
      rateLimitMs: 1000,
      takerFeeBps: 10,
      makerFeeBps: 8,
    };
    const pair: TradingPair = { base: 'BTC', quote: 'USDT' };
    const stub: Pick<Connector, 'id' | 'kind' | 'info' | 'fetchSnapshot' | 'fetchHealth'> = {
      id: 'stub',
      kind: 'cex',
      info,
      fetchSnapshot: async () => null,
      fetchHealth: async () => ({ status: 'active', latencyMs: 1, checkedAt: Date.now() }),
    };
    expect(stub.id).toBe('stub');
    // Type-only assertion: PriceSnapshot is constructible
    const snap: PriceSnapshot = {
      bid: 100, ask: 101, bidQty: 1, askQty: 1,
      timestamp: Date.now(), venue: info, pair,
    };
    expect(snap.ask - snap.bid).toBe(1);
  });
});
