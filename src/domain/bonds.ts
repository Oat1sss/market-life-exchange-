/**
 * Bonds — fixed-income math shared by the service, the page and the tests.
 *
 * One unit is one bond with 100 credits of face value. The coupon is paid
 * monthly out of the annual coupon rate, and the price is the present value of
 * the remaining coupons plus par, discounted at the macro yield for that line.
 * That makes prices fall when yields rise, and pull back to 100 as maturity
 * approaches, exactly like a plain-vanilla bond.
 */
import { BONDS, type BondMeta } from "./economy/catalog";
import type { BondQuote } from "./economy/types";

export const BOND_FACE_MINOR = 10_000n; // 100.00 credits
export const BOND_FEE_BP = 5n; // 0.05% of notional
export const BOND_FEE_MIN_MINOR = 10n; // 0.10 credits
export const MAX_BONDS_PER_ORDER = 50_000;

export function bondLine(key: string): BondMeta | undefined {
  return BONDS.find((line) => line.key === key);
}

/** Whole months until principal is repaid; never negative. */
export function monthsToMaturity(line: Pick<BondMeta, "maturityYears">, tick: number): number {
  return Math.max(0, line.maturityYears * 12 - tick);
}

/**
 * Price per bond in minor units for a 100-credit par bond.
 * `couponBp` / `yieldBp` are annual rates in basis points.
 */
export function bondPriceMinor(
  couponBp: number,
  yieldBp: number,
  monthsLeft: number,
): bigint {
  const n = Math.max(1, Math.min(monthsLeft, 600));
  const monthlyCoupon = (couponBp / 10_000) * 100 / 12;
  const rate = yieldBp / 10_000 / 12;
  const discount = Math.pow(1 + rate, -n);
  const per100 =
    rate > 0
      ? (monthlyCoupon * (1 - discount)) / rate + 100 * discount
      : monthlyCoupon * n + 100;
  const clamped = Math.min(Math.max(per100, 1), 1_000);
  return BigInt(Math.round(clamped * 100));
}

export function bondFeeMinor(grossMinor: bigint): bigint {
  const proportional = (grossMinor * BOND_FEE_BP + 9_999n) / 10_000n;
  return proportional < BOND_FEE_MIN_MINOR ? BOND_FEE_MIN_MINOR : proportional;
}

/** Coupon credited for one held bond for one month. */
export function couponPerBondMinor(couponBp: number): bigint {
  return (BOND_FACE_MINOR * BigInt(couponBp)) / 120_000n;
}

export interface BondInstrument {
  key: string;
  name: string;
  issuer: "GOVERNMENT" | "CORPORATE";
  rating: string;
  couponBp: number;
  maturityYears: number;
  yieldBp: number;
  prevYieldBp: number;
  /** Price per bond in minor units. */
  priceMinor: bigint;
  monthsLeft: number;
  /** Coupon cash per bond per month, minor units. */
  monthlyCouponMinor: bigint;
  quote: BondQuote | null;
}

/** Joins the static catalog with the macro yields of the current tick. */
export function buildBondMarket(quotes: BondQuote[], tick: number): BondInstrument[] {
  return BONDS.map((line) => {
    const quote = quotes.find((candidate) => candidate.key === line.key) ?? null;
    const yieldBp = quote?.yieldBp ?? line.couponBp + line.spreadBp;
    const monthsLeft = monthsToMaturity(line, tick);
    return {
      key: line.key,
      name: line.name,
      issuer: line.issuer,
      rating: line.rating,
      couponBp: line.couponBp,
      maturityYears: line.maturityYears,
      yieldBp,
      prevYieldBp: quote?.prevYieldBp ?? yieldBp,
      priceMinor: bondPriceMinor(line.couponBp, yieldBp, Math.max(1, monthsLeft)),
      monthsLeft,
      monthlyCouponMinor: couponPerBondMinor(line.couponBp),
      quote,
    };
  });
}

/** Annual coupon cash divided by price, in bp, for display next to the yield. */
export function currentYieldBp(
  instrument: Pick<BondInstrument, "couponBp" | "priceMinor">,
): number {
  if (instrument.priceMinor <= 0n) return 0;
  return Number((BOND_FACE_MINOR * BigInt(instrument.couponBp)) / instrument.priceMinor);
}
