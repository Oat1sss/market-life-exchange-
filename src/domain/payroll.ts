/**
 * Payroll math (docs/DATABASE.md §Rounding rule): annual salary splits into 12
 * integer monthly payments; the last month of each year-of-life carries the
 * remainder, so 12 payments always total the annual figure exactly.
 */
import { Money, formatMinor } from "./money";
import { monthOfYearIndex } from "./calendar";

export interface MonthlyPay {
  minor: bigint;
  carriesRemainder: boolean;
}

export function monthlyPay(annualSalaryMinor: bigint, tick: number): MonthlyPay {
  if (annualSalaryMinor < 0n) {
    throw new RangeError("Annual salary cannot be negative");
  }
  const base = annualSalaryMinor / 12n;
  const remainder = annualSalaryMinor % 12n;
  const isLastMonth = monthOfYearIndex(tick) === 11;
  return {
    minor: isLastMonth ? base + remainder : base,
    carriesRemainder: isLastMonth && remainder > 0n,
  };
}

/** Net of any future taxes — MVP has no income tax. */
export function formatMonthlyPay(pay: MonthlyPay): string {
  return formatMinor(pay.minor, { symbol: "CR " });
}

export function annualToMoney(annual: bigint): Money {
  return Money.fromMinor(annual);
}
