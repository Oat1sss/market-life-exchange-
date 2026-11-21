/**
 * Read-only price analytics for the crypto screens. Pure and deterministic:
 * it consumes the same integer price points the engine stores and never feeds
 * back into trading decisions.
 */
export interface PriceSample {
  tick: number;
  priceMinor: bigint;
}

export type Trend = "UP" | "DOWN" | "SIDEWAYS";

export interface MarketAnalysis {
  samples: number;
  changeBp: number;
  highMinor: bigint;
  lowMinor: bigint;
  averageMinor: bigint;
  volatilityBp: number;
  smaShortMinor: bigint;
  smaLongMinor: bigint;
  trend: Trend;
  trendLabel: string;
}

export interface CryptoTechnicalInsight {
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  signalLabel: string;
  valuationGapBp: number;
  valuationLabel: "Premium" | "Discount" | "Fair Value";
  volatilityRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  spotAdvice: string;
  futuresAdvice: string;
}

function average(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  return values.reduce((total, value) => total + value, 0n) / BigInt(values.length);
}

export function analyzePrices(points: readonly PriceSample[]): MarketAnalysis {
  const sorted = [...points].sort((a, b) => a.tick - b.tick);
  if (sorted.length === 0) {
    return {
      samples: 0,
      changeBp: 0,
      highMinor: 0n,
      lowMinor: 0n,
      averageMinor: 0n,
      volatilityBp: 0,
      smaShortMinor: 0n,
      smaLongMinor: 0n,
      trend: "SIDEWAYS",
      trendLabel: "No price history",
    };
  }

  const prices = sorted.map((sample) => sample.priceMinor);
  const first = prices[0]!;
  const last = prices[prices.length - 1]!;

  let high = prices[0]!;
  let low = prices[0]!;
  for (const price of prices) {
    if (price > high) high = price;
    if (price < low) low = price;
  }

  const changeBp =
    first > 0n ? Number(((last - first) * 10_000n) / first) : 0;

  const returnsBp: number[] = [];
  for (let index = 1; index < prices.length; index += 1) {
    const previous = prices[index - 1]!;
    if (previous > 0n) {
      returnsBp.push(Number(((prices[index]! - previous) * 10_000n) / previous));
    }
  }
  let volatilityBp = 0;
  if (returnsBp.length > 1) {
    const mean = returnsBp.reduce((total, value) => total + value, 0) / returnsBp.length;
    const variance =
      returnsBp.reduce((total, value) => total + (value - mean) ** 2, 0) /
      (returnsBp.length - 1);
    volatilityBp = Math.round(Math.sqrt(variance));
  }

  const shortWindow = prices.slice(-5);
  const longWindow = prices.slice(-20);
  const smaShort = average(shortWindow);
  const smaLong = average(longWindow);

  let trend: Trend = "SIDEWAYS";
  if (smaLong > 0n) {
    const gapBp = Number(((smaShort - smaLong) * 10_000n) / smaLong);
    if (gapBp > 50) trend = "UP";
    else if (gapBp < -50) trend = "DOWN";
  }

  const trendLabel =
    trend === "UP" ? "Uptrend" : trend === "DOWN" ? "Downtrend" : "Range-bound";

  return {
    samples: sorted.length,
    changeBp,
    highMinor: high,
    lowMinor: low,
    averageMinor: average(prices),
    volatilityBp,
    smaShortMinor: smaShort,
    smaLongMinor: smaLong,
    trend,
    trendLabel,
  };
}

export function calculateSMASeries(
  points: readonly PriceSample[],
  window: number,
): { tick: number; valueMinor: bigint }[] {
  const sorted = [...points].sort((a, b) => a.tick - b.tick);
  if (sorted.length === 0 || window <= 0) return [];

  return sorted.map((sample, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = sorted.slice(start, index + 1).map((s) => s.priceMinor);
    return {
      tick: sample.tick,
      valueMinor: average(slice),
    };
  });
}

export function generateCryptoInsight(
  analysis: MarketAnalysis,
  fundamentalMinor: bigint,
  currentPriceMinor: bigint,
): CryptoTechnicalInsight {
  let valuationGapBp = 0;
  if (fundamentalMinor > 0n) {
    valuationGapBp = Number(
      ((currentPriceMinor - fundamentalMinor) * 10_000n) / fundamentalMinor,
    );
  }

  let valuationLabel: "Premium" | "Discount" | "Fair Value" = "Fair Value";
  if (valuationGapBp > 500) valuationLabel = "Premium";
  else if (valuationGapBp < -500) valuationLabel = "Discount";

  let volatilityRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME" = "MODERATE";
  if (analysis.volatilityBp < 500) volatilityRisk = "LOW";
  else if (analysis.volatilityBp < 1500) volatilityRisk = "MODERATE";
  else if (analysis.volatilityBp < 2500) volatilityRisk = "HIGH";
  else volatilityRisk = "EXTREME";

  let signal: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let signalLabel = "Consolidation / Range-bound";
  let spotAdvice = "Accumulate gradually or wait for a confirmed breakout above resistance.";
  let futuresAdvice = "Caution on high leverage; market is currently ranging.";

  const isAboveShort = currentPriceMinor >= analysis.smaShortMinor;
  const isAboveLong = currentPriceMinor >= analysis.smaLongMinor;
  const goldenCross = analysis.smaShortMinor > analysis.smaLongMinor;

  if (analysis.trend === "UP" && goldenCross && isAboveShort) {
    signal = "BULLISH";
    signalLabel = "Strong Bullish Momentum";
    spotAdvice =
      "Momentum favours holding or taking incremental profits near key resistance levels.";
    futuresAdvice =
      "Long setups favorable with 2x–5x leverage. Avoid excessive 10x+ leverage.";
  } else if (analysis.trend === "DOWN" && !goldenCross) {
    signal = "BEARISH";
    signalLabel = "Bearish Trend Pressure";
    spotAdvice =
      "Downtrend active. Limit buy orders at key discounts or wait for stabilization.";
    futuresAdvice =
      "Short hedges favorable. Keep tight margin buffer to prevent liquidation.";
  } else if (isAboveLong && !isAboveShort) {
    signal = "NEUTRAL";
    signalLabel = "Healthy Pullback in Uptrend";
    spotAdvice = "Good candidate for spot dip accumulation near the 20-month average.";
    futuresAdvice = "Wait for price to reclaim the 5-month SMA before opening new longs.";
  }

  return {
    signal,
    signalLabel,
    valuationGapBp,
    valuationLabel,
    volatilityRisk,
    spotAdvice,
    futuresAdvice,
  };
}
