import { describe, expect, it } from "vitest";
import { analyzePrices } from "@/domain/market/analysis";

const series = [100n, 110n, 120n, 130n, 140n].map((priceMinor, tick) => ({
  tick,
  priceMinor,
}));

describe("analyzePrices", () => {
  it("returns a neutral empty analysis", () => {
    const analysis = analyzePrices([]);
    expect(analysis.samples).toBe(0);
    expect(analysis.trend).toBe("SIDEWAYS");
    expect(analysis.highMinor).toBe(0n);
  });

  it("measures change, range and averages", () => {
    const analysis = analyzePrices(series);
    expect(analysis.samples).toBe(5);
    expect(analysis.changeBp).toBe(4_000);
    expect(analysis.highMinor).toBe(140n);
    expect(analysis.lowMinor).toBe(100n);
    expect(analysis.averageMinor).toBe(120n);
  });

  it("detects an uptrend from short vs long averages", () => {
    const analysis = analyzePrices([
      ...Array.from({ length: 15 }, (_, tick) => ({ tick, priceMinor: 100n })),
      ...series.map((sample, index) => ({ tick: index + 15, priceMinor: sample.priceMinor + 100n })),
    ]);
    expect(analysis.trend).toBe("UP");
    expect(analysis.smaShortMinor).toBeGreaterThan(analysis.smaLongMinor);
  });

  it("sorts unordered points by tick", () => {
    const analysis = analyzePrices([...series].reverse());
    expect(analysis.changeBp).toBe(4_000);
  });

  it("reports volatility of per-tick returns", () => {
    const flat = analyzePrices(
      Array.from({ length: 6 }, (_, tick) => ({ tick, priceMinor: 100n })),
    );
    expect(flat.volatilityBp).toBe(0);

    const jumpy = analyzePrices([
      { tick: 0, priceMinor: 100n },
      { tick: 1, priceMinor: 200n },
      { tick: 2, priceMinor: 100n },
    ]);
    expect(jumpy.volatilityBp).toBeGreaterThan(0);
  });
});
