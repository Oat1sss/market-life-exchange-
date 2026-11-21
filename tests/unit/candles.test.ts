import { describe, expect, it } from "vitest";
import {
  accentHue,
  applyLiveSample,
  buildCandles,
  movingAverage,
  type CandlePoint,
} from "@/domain/market/candles";
import { profileFor } from "@/domain/market/chart-profile";

const points: CandlePoint[] = Array.from({ length: 8 }, (_, tick) => ({
  tick,
  priceMinor: BigInt(10_000 + tick * 250),
}));

describe("buildCandles", () => {
  it("groups points into OHLC candles with valid bounds", () => {
    const candles = buildCandles(points, "BTC", 4);
    expect(candles).toHaveLength(2);

    for (const candle of candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.low).toBeGreaterThan(0);
      expect(candle.volume).toBeGreaterThan(0);
    }

    expect(candles[0]!.open).toBeCloseTo(100, 5);
    expect(candles[0]!.close).toBeCloseTo(107.5, 5);
    expect(candles[1]!.open).toBeCloseTo(110, 5);
    expect(candles[1]!.close).toBeCloseTo(117.5, 5);
  });

  it("is deterministic for the same symbol and frame", () => {
    expect(buildCandles(points, "ETH", 3)).toEqual(buildCandles(points, "ETH", 3));
  });

  it("shapes a different chart per symbol from identical points", () => {
    const btc = buildCandles(points, "BTC", 4);
    const doge = buildCandles(points, "DOGE", 4);
    const nova = buildCandles(points, "NOVA", 4);

    // Same closes (they come from the stored prices)…
    expect(btc[0]!.close).toBe(doge[0]!.close);
    // …but wick depth and volume follow each asset's personality.
    const wick = (c: { high: number; close: number }) => c.high - c.close;
    expect(wick(btc[0]!)).not.toBeCloseTo(wick(doge[0]!), 6);
    expect(btc[0]!.volume).not.toBeCloseTo(nova[0]!.volume, 6);
    expect(profileFor("BTC").volatility).not.toBe(profileFor("DOGE").volatility);
  });

  it("gives each symbol its own accent hue", () => {
    expect(accentHue("BTC")).toBe(accentHue("BTC"));
    expect(accentHue("BTC")).not.toBe(accentHue("NOVA"));
  });
});

describe("applyLiveSample", () => {
  const profile = profileFor("SOL");

  it("updates the forming candle then rolls a new one", () => {
    const base = buildCandles(points, "SOL", 2);
    let live = applyLiveSample([], 20, profile, 1, 3);
    expect(live).toHaveLength(1);
    expect(live[0]!.live).toBe(true);
    expect(live[0]!.open).toBe(20);

    live = applyLiveSample(live, 22, profile, 2, 3);
    expect(live).toHaveLength(1);
    expect(live[0]!.close).toBe(22);
    expect(live[0]!.high).toBe(22);
    expect(live[0]!.low).toBe(20);

    live = applyLiveSample(live, 19, profile, 3, 3);
    expect(live[0]!.low).toBe(19);
    expect(live[0]!.close).toBe(19);

    live = applyLiveSample(live, 21, profile, 4, 3);
    expect(live).toHaveLength(2);
    expect(live[1]!.open).toBe(21);

    expect(base).toHaveLength(4);
  });
});

describe("movingAverage", () => {
  it("returns null until the window fills", () => {
    const candles = [10, 20, 30, 40].map((close, tick) => ({
      tick,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1,
    }));
    expect(movingAverage(candles, 3)).toEqual([null, null, 20, 30]);
  });
});
