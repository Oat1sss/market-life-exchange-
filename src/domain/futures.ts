/**
 * Perpetual-style futures rules — pure integer math.
 *
 * A position posts `margin = notional / leverage` in cash when it opens.
 * P&L is linear in the underlying: `(mark − entry) × quantity` for longs and
 * the negated amount for shorts. The position is liquidated when margin plus
 * unrealized P&L would be zero or negative. Closing returns
 * `max(0, margin + pnl − closeFee)` to cash, so a position can never make the
 * portfolio owe money.
 */
export type FuturesSide = "LONG" | "SHORT";

export const MIN_LEVERAGE = 1;
export const MAX_LEVERAGE = 20;
export const LEVERAGE_OPTIONS = [2, 5, 10, 20] as const;

export function notionalMinor(priceMinor: bigint, quantity: number): bigint {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError("Quantity must be a positive integer");
  }
  return priceMinor * BigInt(quantity);
}

/** Initial margin, rounded up so a position is always fully collateralized. */
export function marginFor(notional: bigint, leverage: number): bigint {
  if (!Number.isInteger(leverage) || leverage < MIN_LEVERAGE || leverage > MAX_LEVERAGE) {
    throw new RangeError(`Leverage must be ${MIN_LEVERAGE}–${MAX_LEVERAGE}`);
  }
  if (notional <= 0n) return 0n;
  return (notional + BigInt(leverage) - 1n) / BigInt(leverage);
}

/** Signed unrealized P&L at `markMinor`. */
export function futuresPnlMinor(
  side: FuturesSide,
  entryPriceMinor: bigint,
  markPriceMinor: bigint,
  quantity: number,
): bigint {
  const delta = (markPriceMinor - entryPriceMinor) * BigInt(quantity);
  return side === "LONG" ? delta : -delta;
}

/** Mark price at which equity reaches zero (before fees). */
export function liquidationPriceMinor(
  side: FuturesSide,
  entryPriceMinor: bigint,
  leverage: number,
): bigint {
  if (leverage < MIN_LEVERAGE) throw new RangeError("Invalid leverage");
  const l = BigInt(leverage);
  if (side === "LONG") {
    const price = (entryPriceMinor * (l - 1n)) / l;
    return price < 1n ? 1n : price;
  }
  return (entryPriceMinor * (l + 1n)) / l;
}

export function equityMinor(marginMinor: bigint, pnlMinor: bigint): bigint {
  return marginMinor + pnlMinor;
}

export function isLiquidatable(marginMinor: bigint, pnlMinor: bigint): boolean {
  return equityMinor(marginMinor, pnlMinor) <= 0n;
}

/** Cash returned when a position closes; never negative. */
export function closePayoutMinor(
  marginMinor: bigint,
  pnlMinor: bigint,
  closeFeeMinor: bigint,
): bigint {
  const payout = marginMinor + pnlMinor - closeFeeMinor;
  return payout > 0n ? payout : 0n;
}
