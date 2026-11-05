/**
 * Deterministic price model (docs/ARCHITECTURE.md §5), fixed-point integers.
 *
 *   drift  = (fundamental - price) / fundamental * meanReversion
 *   ride   = sentiment' * beta              (sentiment in bp, beta in bp)
 *   noise  = gaussian * volatility          (volatility in bp)
 *   price' = floor(price * (SCALE + return) / SCALE), floor 1 minor unit
 *
 * All price math uses integer micro-units (SCALE = 10^6; 1bp = 100 micro).
 * Gaussian noise is the only floating-point intermediate (Box–Muller over the
 * seeded PRNG) and is converted to integer bp/micro before touching prices.
 */
import { Money } from "../money";
import { deriveGaussian } from "../rng";

export const PRICE_SCALE = 1_000_000n;

/** 1bp in micro-units of return. */
const BP = 100n;

/** Max ±25% move per tick; floor 1 minor unit (docs §5 sanity clamps). */
export const MAX_ABS_RETURN_BP = 2_500;
export const MAX_ABS_RETURN_MICRO = BigInt(MAX_ABS_RETURN_BP) * BP;
export const MIN_PRICE_MINOR = 1n;

/** Mean-reversion pull toward fundamental, micro per unit of fundamental gap. */
const MEAN_REVERSION = 200n;

export interface PriceInputs {
  seed: bigint;
  tick: number;
  assetIndex: number;
  symbol: string;
  previousPriceMinor: bigint;
  fundamentalMinor: bigint;
  /** Same asset's sentiment at the previous tick, 0 when unknown. */
  previousSentimentBp: number;
  volatilityBp: number;
  betaBp: number;
  eventShockMicro: number;
}

export interface PriceResult {
  priceMinor: bigint;
  sentimentBp: number;
  returnBp: number;
}

/** Sentiment rides seven-tenths of last month's level, plus noise plus shock. */
const SENTIMENT_DECAY = 0.7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nextPrice(inputs: PriceInputs): PriceResult {
  const {
    seed, tick, assetIndex, symbol,
    previousPriceMinor, fundamentalMinor,
    previousSentimentBp, volatilityBp, betaBp,
    eventShockMicro,
  } = inputs;

  if (previousPriceMinor < MIN_PRICE_MINOR) {
    throw new RangeError("Previous price below floor");
  }
  if (fundamentalMinor <= 0n) {
    throw new RangeError("Fundamental must be positive");
  }

  // 1) Sentiment state: prior level decayed ± seeded noise ± event shock.
  const noiseUniform = deriveGaussian(seed, `sentiment:${symbol}`, tick, assetIndex);
  const sentiment = clamp(
    Math.round(
      previousSentimentBp * SENTIMENT_DECAY + noiseUniform * 250 + eventShockMicro / Number(BP),
    ),
    -3_000,
    3_000,
  );

  // 2) Drift: integer micro-returns pulling toward the fundamental value.
  const gap = fundamentalMinor - previousPriceMinor;
  const driftMicro = (gap * MEAN_REVERSION * 10_000n) / (fundamentalMinor * PRICE_SCALE);

  // 3) Sentiment ride: sentiment(bp) * beta(bp) / 10^4, in micro.
  const rideMicro = (BigInt(sentiment) * BigInt(betaBp) * 100n) / PRICE_SCALE;

  // 4) Gaussian volatility in micro (volatility is bp → ×100 micro).
  const gauss = deriveGaussian(seed, `price:${symbol}`, tick, assetIndex);
  const volatilityMicro = BigInt(Math.round(gauss * Number(volatilityBp))) * BP;

  let returnMicro = driftMicro + rideMicro + volatilityMicro;
  if (returnMicro > MAX_ABS_RETURN_MICRO) returnMicro = MAX_ABS_RETURN_MICRO;
  if (returnMicro < -MAX_ABS_RETURN_MICRO) returnMicro = -MAX_ABS_RETURN_MICRO;

  const raw = (previousPriceMinor * (PRICE_SCALE + returnMicro)) / PRICE_SCALE;
  const priceMinor = raw < MIN_PRICE_MINOR ? MIN_PRICE_MINOR : raw;

  return {
    priceMinor,
    sentimentBp: sentiment,
    returnBp: Number(returnMicro / BP),
  };
}

/** Convenience for display paths; display never feeds back into the model. */
export function toDisplayMoney(minor: bigint): Money {
  return Money.fromMinor(minor);
}
