/**
 * Money — an immutable amount in integer minor units (1 rupiah = 100 sen).
 *
 * Authoritative accounting must never use floating point. Every amount in the
 * game database is a BIGINT of minor units; this module is the only place
 * allowed to do arithmetic on them.
 */
export const MINOR_UNITS_PER_UNIT = 100n;

export type RoundingMode = "down" | "up" | "nearest";

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Integer division with an explicit rounding mode.
 * `down` truncates toward zero, `up` rounds away from zero, `nearest` rounds
 * half away from zero. Denominators must be positive.
 */
export function divRound(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode = "down",
): bigint {
  if (denominator <= 0n) {
    throw new MoneyError("Denominator must be positive");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;

  switch (mode) {
    case "down":
      return quotient;
    case "up":
      return numerator > 0n ? quotient + 1n : quotient - 1n;
    case "nearest": {
      const distance = remainder < 0n ? -remainder : remainder;
      return distance * 2n >= denominator
        ? numerator > 0n
          ? quotient + 1n
          : quotient - 1n
        : quotient;
    }
  }
}

const PARSE_PATTERN = /^([+-]?)(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/;

export interface MoneyFormatOptions {
  /** Prefix such as "$" or "Rp ". Rendered after the sign. */
  symbol?: string;
  /** Render an explicit "+" for positive amounts. */
  showPlus?: boolean;
}

/**
 * Format minor units for display: 123456 -> "1,234.56".
 * Display only — never parse formatted output back into an authoritative value.
 */
export function formatMinor(
  minor: bigint,
  options: MoneyFormatOptions = {},
): string {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const units = absolute / MINOR_UNITS_PER_UNIT;
  const cents = absolute % MINOR_UNITS_PER_UNIT;
  const grouped = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = negative ? "-" : options.showPlus && minor > 0n ? "+" : "";
  return `${sign}${options.symbol ?? ""}${grouped},${cents
    .toString()
    .padStart(2, "0")}`;
}

/** Convenience formatter with currency symbol (default: "Rp ") */
export function currency(
  minor: bigint | number,
  symbolOrOptions?: string | MoneyFormatOptions,
): string {
  const m = typeof minor === "number" ? BigInt(minor) : minor;
  if (typeof symbolOrOptions === "string") {
    return formatMinor(m, { symbol: symbolOrOptions });
  }
  return formatMinor(m, { symbol: "Rp ", ...symbolOrOptions });
}

export class Money {
  private constructor(private readonly minorUnits: bigint) {}

  static readonly zero: Money = new Money(0n);

  /** Wrap an exact integer number of minor units. */
  static fromMinor(minor: bigint | number): Money {
    if (typeof minor === "number") {
      if (!Number.isSafeInteger(minor)) {
        throw new MoneyError(
          `Unsafe minor-unit amount: ${minor}. Use bigint for large values.`,
        );
      }
      return new Money(BigInt(minor));
    }
    return new Money(minor);
  }

  /**
   * Parse user input such as "1,234.56", "12", or "-0.50".
   * Rejects anything that cannot be represented exactly to the minor unit.
   */
  static parse(input: string): Money {
    const trimmed = input.trim();
    const match = PARSE_PATTERN.exec(trimmed);
    if (!match) {
      throw new MoneyError(
        `Invalid amount "${input}". Expected up to two decimals, e.g. 1,234.56`,
      );
    }
    const [, sign, whole, fraction = ""] = match;
    const wholeMinor = BigInt(whole.replaceAll(",", "")) * MINOR_UNITS_PER_UNIT;
    const fractionMinor = BigInt(fraction.padEnd(2, "0"));
    const magnitude = wholeMinor + fractionMinor;
    return new Money(sign === "-" ? -magnitude : magnitude);
  }

  /** Sum a list of amounts. */
  static sum(amounts: readonly Money[]): Money {
    return new Money(amounts.reduce((total, amount) => total + amount.minorUnits, 0n));
  }

  get minor(): bigint {
    return this.minorUnits;
  }

  add(other: Money): Money {
    return new Money(this.minorUnits + other.minorUnits);
  }

  subtract(other: Money): Money {
    return new Money(this.minorUnits - other.minorUnits);
  }

  negate(): Money {
    return new Money(-this.minorUnits);
  }

  abs(): Money {
    return this.minorUnits < 0n ? this.negate() : this;
  }

  /** Multiply by a whole, non-negative quantity (shares, units, months). */
  times(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new MoneyError(`Quantity must be a non-negative integer: ${quantity}`);
    }
    return new Money(this.minorUnits * BigInt(quantity));
  }

  /** Apply a basis-point rate (100 bp = 1%). */
  basisPoints(basisPoints: bigint | number, mode: RoundingMode = "down"): Money {
    const bp = typeof basisPoints === "number" ? BigInt(basisPoints) : basisPoints;
    return new Money(divRound(this.minorUnits * bp, 10_000n, mode));
  }

  /** Apply an arbitrary integer ratio with explicit rounding. */
  scale(
    numerator: bigint,
    denominator: bigint,
    mode: RoundingMode = "down",
  ): Money {
    return new Money(divRound(this.minorUnits * numerator, denominator, mode));
  }

  compareTo(other: Money): -1 | 0 | 1 {
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.minorUnits === other.minorUnits;
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  format(options: MoneyFormatOptions = {}): string {
    return formatMinor(this.minorUnits, options);
  }

  /** Serialize as a decimal string of minor units; safe for JSON transport. */
  toJSON(): string {
    return this.minorUnits.toString();
  }

  toString(): string {
    return this.format();
  }
}
