import { describe, expect, it } from "vitest";
import { Money, MoneyError, divRound, formatMinor } from "@/domain/money";

describe("Money.parse", () => {
  it.each([
    ["1,234.56", 123456n],
    ["12", 1200n],
    ["0.5", 50n],
    ["0.05", 5n],
    ["-0.50", -50n],
    ["+3.05", 305n],
    ["  7  ", 700n],
    ["0", 0n],
  ])("parses %s exactly", (input, expected) => {
    expect(Money.parse(input).minor).toBe(expected);
  });

  it.each([
    "1.234",
    "",
    "abc",
    "1,23",
    "1e5",
    ".50",
    "12.",
    "1,2345",
    "--1",
    "1,23.00",
  ])("rejects %s", (input) => {
    expect(() => Money.parse(input)).toThrow(MoneyError);
  });
});

describe("Money.fromMinor", () => {
  it("accepts exact integers", () => {
    expect(Money.fromMinor(100).minor).toBe(100n);
    expect(Money.fromMinor(-100).minor).toBe(-100n);
  });

  it("rejects fractional and unsafe numbers", () => {
    expect(() => Money.fromMinor(1.5)).toThrow(MoneyError);
    expect(() => Money.fromMinor(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });

  it("keeps bigint precision beyond the safe-integer range", () => {
    const big = Money.fromMinor(9007199254740993n);
    expect(big.add(Money.fromMinor(1n)).minor).toBe(9007199254740994n);
  });
});

describe("Money arithmetic", () => {
  it("adds decimals without floating-point drift", () => {
    const total = Money.parse("0.10").add(Money.parse("0.20"));
    expect(total.minor).toBe(30n);
    expect(total.format()).toBe("0.30");
  });

  it("multiplies by whole quantities exactly", () => {
    expect(Money.parse("19.99").times(3).minor).toBe(5997n);
    expect(Money.parse("0.01").times(1000).minor).toBe(1000n);
  });

  it("rejects fractional or negative quantities", () => {
    const price = Money.parse("10.00");
    expect(() => price.times(1.5)).toThrow(MoneyError);
    expect(() => price.times(-1)).toThrow(MoneyError);
  });

  it("is immutable", () => {
    const original = Money.parse("5.00");
    original.add(Money.parse("1.00"));
    original.subtract(Money.parse("1.00"));
    expect(original.minor).toBe(500n);
  });

  it("sums a list", () => {
    const total = Money.sum([
      Money.parse("1.00"),
      Money.parse("2.00"),
      Money.parse("-0.50"),
    ]);
    expect(total.minor).toBe(250n);
  });

  it("applies basis points with explicit rounding", () => {
    const notional = Money.fromMinor(123456);
    expect(notional.basisPoints(10, "down").minor).toBe(123n);
    expect(notional.basisPoints(10, "up").minor).toBe(124n);
    expect(notional.basisPoints(10, "nearest").minor).toBe(123n);
  });

  it("rounds .5 away from zero for 'nearest'", () => {
    expect(Money.fromMinor(2500).basisPoints(50, "nearest").minor).toBe(13n);
    expect(Money.fromMinor(2500).basisPoints(50, "down").minor).toBe(12n);
  });

  it("scales by an integer ratio", () => {
    const monthly = Money.parse("100.00");
    expect(monthly.scale(1n, 3n, "down").minor).toBe(3333n);
    expect(monthly.scale(1n, 3n, "up").minor).toBe(3334n);
  });

  it("compares amounts", () => {
    const a = Money.parse("1.00");
    const b = Money.parse("1.01");
    expect(a.compareTo(b)).toBe(-1);
    expect(b.compareTo(a)).toBe(1);
    expect(a.compareTo(a)).toBe(0);
    expect(a.equals(Money.fromMinor(100))).toBe(true);
  });

  it("exposes sign helpers", () => {
    expect(Money.zero.isZero()).toBe(true);
    expect(Money.parse("-1.00").isNegative()).toBe(true);
    expect(Money.parse("1.00").isPositive()).toBe(true);
  });
});

describe("formatting", () => {
  it("formats minor units for display", () => {
    expect(formatMinor(123456n)).toBe("1,234.56");
    expect(formatMinor(-50n)).toBe("-0.50");
    expect(formatMinor(0n)).toBe("0.00");
    expect(formatMinor(1234567890n)).toBe("12,345,678.90");
  });

  it("supports a currency symbol and explicit plus", () => {
    expect(formatMinor(123456n, { symbol: "$" })).toBe("$1,234.56");
    expect(formatMinor(-50n, { symbol: "$" })).toBe("-$0.50");
    expect(formatMinor(100n, { symbol: "$", showPlus: true })).toBe("+$1.00");
    expect(formatMinor(0n, { showPlus: true })).toBe("0.00");
  });

  it("serializes minor units as a string for JSON transport", () => {
    expect(Money.parse("12.34").toJSON()).toBe("1234");
    expect(JSON.stringify({ cash: Money.parse("1.00") })).toBe('{"cash":"100"}');
  });
});

describe("divRound", () => {
  it("throws on a non-positive denominator", () => {
    expect(() => divRound(10n, 0n)).toThrow(MoneyError);
    expect(() => divRound(10n, -2n)).toThrow(MoneyError);
  });

  it("returns exact results without rounding", () => {
    expect(divRound(100n, 4n, "nearest")).toBe(25n);
  });
});
