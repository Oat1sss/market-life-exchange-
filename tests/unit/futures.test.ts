import { describe, expect, it } from "vitest";
import {
  closePayoutMinor,
  equityMinor,
  futuresPnlMinor,
  isLiquidatable,
  liquidationPriceMinor,
  marginFor,
  notionalMinor,
} from "@/domain/futures";

describe("futures margin", () => {
  it("rounds initial margin up so the position is fully collateralized", () => {
    expect(marginFor(10_000n, 10)).toBe(1_000n);
    expect(marginFor(10_001n, 10)).toBe(1_001n);
    expect(marginFor(1n, 20)).toBe(1n);
  });

  it("rejects invalid leverage and quantities", () => {
    expect(() => marginFor(100n, 0)).toThrow(RangeError);
    expect(() => marginFor(100n, 21)).toThrow(RangeError);
    expect(() => notionalMinor(100n, 0)).toThrow(RangeError);
    expect(() => notionalMinor(100n, 1.5)).toThrow(RangeError);
  });

  it("computes notional in minor units", () => {
    expect(notionalMinor(4_500_000n, 3)).toBe(13_500_000n);
  });
});

describe("futures P&L", () => {
  it("is signed by side", () => {
    expect(futuresPnlMinor("LONG", 100n, 110n, 5)).toBe(50n);
    expect(futuresPnlMinor("SHORT", 100n, 110n, 5)).toBe(-50n);
    expect(futuresPnlMinor("SHORT", 100n, 90n, 5)).toBe(50n);
  });

  it("adds to margin for equity", () => {
    expect(equityMinor(1_000n, -400n)).toBe(600n);
  });

  it("liquidates exactly at zero equity", () => {
    expect(isLiquidatable(1_000n, -999n)).toBe(false);
    expect(isLiquidatable(1_000n, -1_000n)).toBe(true);
    expect(isLiquidatable(1_000n, -1_500n)).toBe(true);
  });
});

describe("liquidation price", () => {
  it("sits one inverse-leverage move from entry", () => {
    expect(liquidationPriceMinor("LONG", 100_000n, 10)).toBe(90_000n);
    expect(liquidationPriceMinor("SHORT", 100_000n, 10)).toBe(110_000n);
    expect(liquidationPriceMinor("LONG", 100_000n, 1)).toBe(1n);
  });

  it("never returns a price below one minor unit", () => {
    expect(liquidationPriceMinor("LONG", 2n, 20)).toBe(1n);
  });
});

describe("close payout", () => {
  it("returns margin plus profit minus the close fee", () => {
    expect(closePayoutMinor(1_000n, 250n, 10n)).toBe(1_240n);
  });

  it("floors at zero rather than making the portfolio owe money", () => {
    expect(closePayoutMinor(1_000n, -2_000n, 10n)).toBe(0n);
    expect(closePayoutMinor(1_000n, 0n, 1_001n)).toBe(0n);
  });
});
