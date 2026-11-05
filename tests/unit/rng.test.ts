import { describe, expect, it } from "vitest";
import {
  deriveChance,
  deriveGaussian,
  deriveInt,
  deriveUniform,
} from "@/domain/rng";

describe("deriveUniform", () => {
  it("is reproducible for identical inputs", () => {
    const expected = deriveUniform(42n, "market", 0, 0);
    for (let i = 0; i < 50; i++) {
      expect(deriveUniform(42n, "market", 0, 0)).toBe(expected);
    }
  });

  it("matches a fixed HMAC snapshot across machines", () => {
    expect(deriveUniform(42n, "market", 0, 0)).toBe(0.654125202809207);
    expect(deriveUniform(12345n, "market", 0, 0)).not.toBe(
      deriveUniform(42n, "market", 0, 0),
    );
  });

  it("stays within [0, 1)", () => {
    for (let tick = 0; tick < 500; tick++) {
      const value = deriveUniform(7n, "market", tick);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("separates draws by seed, label, tick and index", () => {
    expect(deriveUniform(1n, "a", 0)).not.toBe(deriveUniform(2n, "a", 0));
    expect(deriveUniform(1n, "a", 0)).not.toBe(deriveUniform(1n, "b", 0));
    expect(deriveUniform(1n, "a", 0)).not.toBe(deriveUniform(1n, "a", 1));
    expect(deriveUniform(1n, "a", 0, 0)).not.toBe(deriveUniform(1n, "a", 0, 1));
  });

  it("rejects negative ticks and indexes", () => {
    expect(() => deriveUniform(1n, "a", -1)).toThrow(RangeError);
    expect(() => deriveUniform(1n, "a", 0, -1)).toThrow(RangeError);
  });
});

describe("deriveGaussian", () => {
  it("is reproducible", () => {
    expect(deriveGaussian(42n, "market", 3)).toBe(
      deriveGaussian(42n, "market", 3),
    );
  });

  it("has approximately standard normal moments over many draws", () => {
    const samples = Array.from({ length: 4000 }, (_, tick) =>
      deriveGaussian(99n, "market", tick),
    );
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance =
      samples.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
      samples.length;

    expect(Math.abs(mean)).toBeLessThan(0.06);
    expect(Math.sqrt(variance)).toBeGreaterThan(0.93);
    expect(Math.sqrt(variance)).toBeLessThan(1.07);
  });
});

describe("deriveInt", () => {
  it("honours the exclusive upper bound and covers the range", () => {
    const seen = new Set<number>();
    for (let tick = 0; tick < 2000; tick++) {
      const value = deriveInt(5n, "event", tick, 0, 4);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(4);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it("supports negative ranges", () => {
    for (let tick = 0; tick < 200; tick++) {
      const value = deriveInt(5n, "event", tick, -3, -1);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(-1);
    }
  });

  it("rejects invalid ranges", () => {
    expect(() => deriveInt(1n, "x", 0, 5, 5)).toThrow(RangeError);
    expect(() => deriveInt(1n, "x", 0, 0, 2.5)).toThrow(RangeError);
  });
});

describe("deriveChance", () => {
  it("is always false at 0 and always true at 1", () => {
    for (let tick = 0; tick < 100; tick++) {
      expect(deriveChance(3n, "event", tick, 0)).toBe(false);
      expect(deriveChance(3n, "event", tick, 1)).toBe(true);
    }
  });

  it("is reproducible and roughly matches its probability", () => {
    const draws = Array.from({ length: 2000 }, (_, tick) =>
      deriveChance(3n, "event", tick, 0.25),
    );
    const hits = draws.filter(Boolean).length / draws.length;
    expect(hits).toBeGreaterThan(0.21);
    expect(hits).toBeLessThan(0.29);
  });

  it("rejects probabilities outside [0, 1]", () => {
    expect(() => deriveChance(1n, "x", 0, -0.1)).toThrow(RangeError);
    expect(() => deriveChance(1n, "x", 0, 1.1)).toThrow(RangeError);
  });
});
