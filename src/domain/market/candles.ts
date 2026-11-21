/**
 * Candlestick synthesis for the realtime chart screen.
 *
 * Stored ticks are monthly prices; the chart expands them into OHLC candles
 * and then keeps a client-side live tape running between server ticks. Every
 * asset uses its `chart-profile` personality, so BTC and a micro-cap (or a
 * stock) never share the same wick depth, volume scale or volatility rhythm.
 */
import { profileFor, seededRandom, type ChartProfile } from "./chart-profile";

export interface CandlePoint {
  tick: number;
  priceMinor: bigint;
}

export interface Candle {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True for candles produced by the client-side live tape. */
  live?: boolean;
  /** Number of live samples folded into this candle (live candles only). */
  samples?: number;
}

/** Price points are integer minor units; candles render in whole credits. */
function toCredits(priceMinor: bigint): number {
  return Number(priceMinor) / 100;
}

/** Cheap stable hash used for the per-symbol accent hue. */
function hashSymbol(symbol: string): number {
  let value = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) {
    value ^= symbol.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A stable accent colour (0–359) so each pair's chart chrome is recognisable. */
export function accentHue(symbol: string): number {
  return hashSymbol(symbol) % 360;
}

/**
 * Group consecutive price points into OHLC candles. The asset's profile sets
 * how far wicks reach beyond the sampled range and how heavy volume looks.
 */
export function buildCandles(
  points: readonly CandlePoint[],
  symbol: string,
  group: number,
  profile: ChartProfile = profileFor(symbol),
): Candle[] {
  const size = Math.max(1, Math.floor(group));
  const sorted = [...points].sort((a, b) => a.tick - b.tick);
  const candles: Candle[] = [];

  for (let start = 0; start < sorted.length; start += size) {
    const slice = sorted.slice(start, start + size);
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    const prices = slice.map((point) => toCredits(point.priceMinor));
    const open = prices[0]!;
    const close = prices[prices.length - 1]!;
    const sampledHigh = Math.max(...prices);
    const sampledLow = Math.min(...prices);

    const rand = seededRandom(
      profile.seed ^ Math.imul(last.tick + 1, 0x9e3779b1),
    );
    const span = Math.max(Math.abs(close - open), close * profile.volatility);
    const high =
      Math.max(sampledHigh, open, close) +
      span * profile.wick * (0.1 + rand() * 0.45);
    const low = Math.max(
      0.01,
      Math.min(sampledLow, open, close) - span * profile.wick * (0.1 + rand() * 0.45),
    );
    const volume = profile.volume * (700 + rand() * 1600);

    candles.push({
      tick: last.tick > first.tick ? last.tick : first.tick,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

/** One extra client-side sample: update the live candle or open a new one. */
export function applyLiveSample(
  liveCandles: readonly Candle[],
  price: number,
  profile: ChartProfile,
  step: number,
  samplesPerCandle = 8,
): Candle[] {
  const next = [...liveCandles];
  const last = next[next.length - 1];
  const rand = seededRandom(profile.seed ^ Math.imul(step + 1, 0x85ebca6b));

  if (!last || (last.samples ?? 0) >= samplesPerCandle) {
    next.push({
      tick: (last?.tick ?? 0) + 1,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: profile.volume * (140 + rand() * 120),
      live: true,
      samples: 1,
    });
    return next;
  }

  next[next.length - 1] = {
    ...last,
    close: price,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    volume: last.volume + profile.volume * (90 + rand() * 130),
    samples: (last.samples ?? 0) + 1,
  };
  return next;
}

/** Simple moving average over candle closes; null until the window fills. */
export function movingAverage(
  candles: readonly Candle[],
  window: number,
): Array<number | null> {
  return candles.map((_, index) => {
    if (index < window - 1) return null;
    let sum = 0;
    for (let i = index - window + 1; i <= index; i += 1) sum += candles[i]!.close;
    return sum / window;
  });
}
