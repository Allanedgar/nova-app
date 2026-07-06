/**
 * Risk Scorer — per docs/11_RISK_ENGINE.md.
 *
 * Scores an opportunity across multiple dimensions and produces
 * a weighted total score (0-100). Higher = safer.
 */

import type { PriceSnapshot, RiskBreakdown } from '@nova-app/shared';

export interface RiskScorerDeps {
  readonly clock?: () => number;
}

const WEIGHTS = {
  liquidity: 0.20,
  depth: 0.20,
  volatility: 0.15,
  exchangeReliability: 0.20,
  mevRisk: 0.15,
  networkCongestion: 0.10,
};

// Reliability scores for known exchanges (0-100)
const EXCHANGE_RELIABILITY: Record<string, number> = {
  binance: 95,
  coinbase: 95,
  okx: 90,
  kraken: 90,
  bybit: 85,
  bitget: 80,
  kucoin: 75,
  gateio: 70,
  mexc: 65,
};

/**
 * Score an opportunity based on its source snapshots.
 */
export function scoreRisk(
  askSnapshot: PriceSnapshot,
  bidSnapshot: PriceSnapshot,
  deps?: RiskScorerDeps,
): RiskBreakdown {
  const now = deps?.clock ? deps.clock() : Date.now();

  // 1. Liquidity Score — higher 24h volume = safer
  const askVolume = askSnapshot.volume24h * askSnapshot.last;
  const bidVolume = bidSnapshot.volume24h * bidSnapshot.last;
  const minVolume = Math.min(askVolume, bidVolume);
  const liquidityScore = normalizeScore(minVolume, 0, 10_000_000); // $0-$10M range

  // 2. Depth Score — spread tightness (tighter = safer)
  const buySpreadBps = ((askSnapshot.ask - askSnapshot.bid) / askSnapshot.bid) * 10_000;
  const sellSpreadBps = ((bidSnapshot.ask - bidSnapshot.bid) / bidSnapshot.bid) * 10_000;
  const avgSpreadBps = (buySpreadBps + sellSpreadBps) / 2;
  const depthScore = Math.max(0, 100 - avgSpreadBps * 5); // 5 bps spread = 75, 20 bps = 0

  // 3. Volatility Score — snapshot age proxy (fresher = less volatile)
  const askAge = now - askSnapshot.timestamp;
  const bidAge = now - bidSnapshot.timestamp;
  const maxAge = Math.max(askAge, bidAge);
  const volatilityScore = Math.max(0, 100 - (maxAge / 50)); // 5s = 90, 50s = 0

  // 4. Exchange Reliability
  const askReliability = EXCHANGE_RELIABILITY[askSnapshot.venue.code] ?? 50;
  const bidReliability = EXCHANGE_RELIABILITY[bidSnapshot.venue.code] ?? 50;
  const exchangeReliability = (askReliability + bidReliability) / 2;

  // 5. MEV Risk — higher for tight spreads on congested venues
  const spreadFactor = avgSpreadBps / 10; // Normalize: 10 bps = 1.0
  const mevRisk = Math.max(0, 100 - spreadFactor * 20); // Tighter spread = higher MEV risk

  // 6. Network Congestion — venue reliability proxy (reliable = less congested)
  const networkCongestion = Math.max(0, 100 - (askReliability * 0.5 + bidReliability * 0.5));

  // Weighted total
  const totalScore = Math.round(
    liquidityScore * WEIGHTS.liquidity +
    depthScore * WEIGHTS.depth +
    volatilityScore * WEIGHTS.volatility +
    exchangeReliability * WEIGHTS.exchangeReliability +
    mevRisk * WEIGHTS.mevRisk +
    networkCongestion * WEIGHTS.networkCongestion
  );

  return {
    liquidityScore: Math.round(liquidityScore),
    depthScore: Math.round(depthScore),
    volatilityScore: Math.round(volatilityScore),
    exchangeReliability: Math.round(exchangeReliability),
    mevRisk: Math.round(mevRisk),
    networkCongestion: Math.round(networkCongestion),
    totalScore: Math.max(0, Math.min(100, totalScore)),
  };
}

/** Normalize a value to 0-100 based on expected min/max range. */
function normalizeScore(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return (value / max) * 100;
}