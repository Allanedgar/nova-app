import { describe, expect, it } from 'vitest';
import { BinanceConnector } from '../cex/binance.js';
import { OkxConnector } from '../cex/okx.js';
import { KrakenConnector } from '../cex/kraken.js';
import { BybitConnector } from '../cex/bybit.js';
import { BitgetConnector } from '../cex/bitget.js';
import { KucoinConnector } from '../cex/kucoin.js';
import { CoinbaseConnector } from '../cex/coinbase.js';
import { GateConnector } from '../cex/gate.js';
import { MexcConnector } from '../cex/mexc.js';
import { HtxConnector } from '../cex/htx.js';
import { BitfinexConnector } from '../cex/bitfinex.js';
import { BitstampConnector } from '../cex/bitstamp.js';
import { CryptocomConnector } from '../cex/cryptocom.js';
import { WhitebitConnector } from '../cex/whitebit.js';
import { BingxConnector } from '../cex/bingx.js';
import { PhemexConnector } from '../cex/phemex.js';
import { LbankConnector } from '../cex/lbank.js';
import { PoloniexConnector } from '../cex/poloniex.js';
import { BackpackConnector } from '../cex/backpack.js';
import { GeminiConnector } from '../cex/gemini.js';

const all = [
  ['Binance', () => new BinanceConnector()],
  ['OKX', () => new OkxConnector()],
  ['Kraken', () => new KrakenConnector()],
  ['Bybit', () => new BybitConnector()],
  ['Bitget', () => new BitgetConnector()],
  ['KuCoin', () => new KucoinConnector()],
  ['Coinbase', () => new CoinbaseConnector()],
  ['Gate', () => new GateConnector()],
  ['MEXC', () => new MexcConnector()],
  ['HTX', () => new HtxConnector()],
  ['Bitfinex', () => new BitfinexConnector()],
  ['Bitstamp', () => new BitstampConnector()],
  ['CryptoCom', () => new CryptocomConnector()],
  ['WhiteBIT', () => new WhitebitConnector()],
  ['BingX', () => new BingxConnector()],
  ['Phemex', () => new PhemexConnector()],
  ['LBank', () => new LbankConnector()],
  ['Poloniex', () => new PoloniexConnector()],
  ['Backpack', () => new BackpackConnector()],
  ['Gemini', () => new GeminiConnector()],
] as const;

describe.each(all)('%s contract', (name, factory) => {
  const c = factory();

  it('has id matching info.code', () => {
    expect(c.id).toBe(c.info.code);
  });

  it('is a CEX connector', () => {
    expect(c.kind).toBe('cex');
  });

  it('has non-negative rateLimitMs', () => {
    expect(c.info.rateLimitMs).toBeGreaterThanOrEqual(0);
  });

  it('has non-negative fees', () => {
    expect(c.info.takerFeeBps).toBeGreaterThanOrEqual(0);
    expect(c.info.makerFeeBps).toBeGreaterThanOrEqual(0);
  });

  it('returns exchange info', async () => {
    const info = await c.fetchExchangeInfo();
    expect(info.code).toBe(c.id);
  });

  it('returns fee schedule', async () => {
    const f = await c.fetchFees();
    expect(f.venue.code).toBe(c.id);
  });

  it('health returns a valid status', async () => {
    const h = await c.health();
    expect(['active', 'degraded', 'maintenance']).toContain(h.status);
    expect(typeof h.latencyMs).toBe('number');
  });
});