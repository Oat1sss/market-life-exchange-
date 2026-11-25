/**
 * Ownership & control: turns a player's share count into a stake percentage
 * and a control tier. Thresholds live in the catalog so the UI and the future
 * board-action rules read the same numbers.
 */
import { CONTROL_TIERS, type ControlTierKey } from "./catalog";
import type { CompanyState } from "./types";

export interface ControlTierView {
  key: ControlTierKey;
  label: string;
  thresholdPct: number;
  note: string;
}

export function tierFor(stakePct: number): ControlTierView {
  let current: ControlTierView = CONTROL_TIERS[0];
  for (const tier of CONTROL_TIERS) {
    if (stakePct >= tier.thresholdPct) current = tier;
  }
  return current;
}

export function nextTierFor(stakePct: number): ControlTierView | null {
  const next = CONTROL_TIERS.find((tier) => tier.thresholdPct > stakePct);
  return next ?? null;
}

export function stakePct(quantity: number, sharesOutstanding: number): number {
  if (sharesOutstanding <= 0) return 0;
  return Math.min(100, (quantity / sharesOutstanding) * 100);
}

/** Share count needed to reach the given tier. */
export function sharesForTier(sharesOutstanding: number, tierKey: ControlTierKey): number {
  const tier = CONTROL_TIERS.find((entry) => entry.key === tierKey) ?? CONTROL_TIERS[0];
  return Math.ceil((sharesOutstanding * tier.thresholdPct) / 100);
}

export interface StakeView {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  sharesOutstanding: number;
  stakePct: number;
  valueMinor: bigint;
  tier: ControlTierView;
  next: ControlTierView | null;
  /** Shares still needed for the next tier, 0 when maxed out. */
  sharesToNext: number;
}

export function stakeViews(
  companies: CompanyState[],
  holdings: Array<{ symbol: string; quantity: number }>,
): StakeView[] {
  const bySymbol = new Map(holdings.map((holding) => [holding.symbol, holding.quantity]));
  return companies
    .map((company) => {
      const quantity = bySymbol.get(company.symbol) ?? 0;
      const percent = stakePct(quantity, company.sharesOutstanding);
      const tier = tierFor(percent);
      const next = nextTierFor(percent);
      return {
        symbol: company.symbol,
        name: company.name,
        sector: company.sector,
        quantity,
        sharesOutstanding: company.sharesOutstanding,
        stakePct: percent,
        valueMinor: company.priceMinor * BigInt(quantity),
        tier,
        next,
        sharesToNext: next
          ? Math.max(0, sharesForTier(company.sharesOutstanding, next.key) - quantity)
          : 0,
      };
    })
    .filter((view) => view.quantity > 0)
    .sort((a, b) => b.valueMinor > a.valueMinor ? 1 : -1);
}
