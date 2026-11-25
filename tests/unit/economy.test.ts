/**
 * Macro-economy engine: determinism, stability across time paces, media,
 * policy bounds and the ownership/control thresholds the UI relies on.
 */
import { describe, expect, it } from "vitest";
import {
  PACES,
  CONTROL_TIERS,
  economySnapshot,
  sectorPressure,
  sharesForTier,
  stakePct,
  stakeViews,
  tierFor,
} from "@/domain/economy";
import { simulateWorld } from "@/domain/economy/engine";
import type { AssetLike } from "@/domain/economy/types";

const ASSETS: AssetLike[] = [
  {
    symbol: "NOVA",
    name: "Nova Dynamics",
    sector: "TECH",
    kind: "STOCK",
    fundamentalMinor: 120_000n,
    volatilityBp: 700,
    betaBp: 1_300,
  },
  {
    symbol: "BYTE",
    name: "Bytecraft Semiconductor",
    sector: "TECH",
    kind: "STOCK",
    fundamentalMinor: 540_000n,
    volatilityBp: 880,
    betaBp: 1_550,
  },
  {
    symbol: "HELX",
    name: "Helix Pharmaceuticals",
    sector: "HEALTH",
    kind: "STOCK",
    fundamentalMinor: 220_000n,
    volatilityBp: 520,
    betaBp: 900,
  },
  {
    symbol: "OILX",
    name: "Oilflex Energy",
    sector: "ENERGY",
    kind: "STOCK",
    fundamentalMinor: 190_000n,
    volatilityBp: 560,
    betaBp: 880,
  },
  {
    symbol: "GRAN",
    name: "Granary Foods",
    sector: "CONSUMER",
    kind: "STOCK",
    fundamentalMinor: 30_000n,
    volatilityBp: 240,
    betaBp: 550,
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    sector: "CRYPTO",
    kind: "CRYPTO",
    fundamentalMinor: 4_500_000n,
    volatilityBp: 1_900,
    betaBp: 2_100,
  },
];

const serialize = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

function run(periods: number, pace: "MONTH" | "YEAR" | "HOUR" = "MONTH", seed = 7n) {
  return simulateWorld({
    seed,
    assets: ASSETS,
    pace,
    startYear: 2026,
    startMonth: 1,
    periods,
  });
}

describe("macro-economy engine", () => {
  it("is deterministic for a given seed and pace", () => {
    expect(serialize(run(36))).toBe(serialize(run(36)));
    expect(serialize(run(12, "YEAR"))).toBe(serialize(run(12, "YEAR")));
  });

  it("different seeds produce different worlds", () => {
    expect(serialize(run(36, "MONTH", 7n))).not.toBe(serialize(run(36, "MONTH", 99n)));
  });

  it("only simulates listed stock sectors, not crypto", () => {
    const world = run(6);
    expect(world.companies).toHaveLength(5);
    expect(world.companies.map((company) => company.symbol)).not.toContain("BTC");
  });

  it("keeps every metric finite and inside its guards over 240 months", () => {
    const world = run(240);
    const government = world.government;

    expect(world.step).toBe(240);
    expect(world.calendarMonths).toBe(240);
    expect(world.monthLabel).toBe("January 2046");

    expect(government.policyRateBp).toBeGreaterThanOrEqual(0);
    expect(government.policyRateBp).toBeLessThanOrEqual(1_800);
    expect(government.inflationBp).toBeGreaterThanOrEqual(-50);
    expect(government.inflationBp).toBeLessThanOrEqual(2_200);
    expect(government.unemploymentBp).toBeGreaterThanOrEqual(150);
    expect(government.unemploymentBp).toBeLessThanOrEqual(2_000);
    expect(government.approvalPct).toBeGreaterThanOrEqual(5);
    expect(government.approvalPct).toBeLessThanOrEqual(95);
    expect(Number.isFinite(government.gdpGrowthBp)).toBe(true);

    for (const company of world.companies) {
      expect(company.priceMinor).toBeGreaterThan(0n);
      expect(company.fundamentalMinor).toBeGreaterThan(0n);
      expect(company.sharesOutstanding).toBeGreaterThan(0);
      expect(company.employees).toBeGreaterThan(0);
      expect(company.marginBp).toBeGreaterThanOrEqual(-900);
      expect(company.marginBp).toBeLessThanOrEqual(7_000);
      expect(Number.isFinite(company.changeBp)).toBe(true);
      expect(Number.isFinite(company.brandBp)).toBe(true);
    }

    for (const resource of world.resources) {
      expect(resource.priceMinor).toBeGreaterThan(0n);
      expect(Number.isFinite(resource.supplyIndex)).toBe(true);
      expect(Number.isFinite(resource.demandIndex)).toBe(true);
    }

    for (const quote of world.fx) {
      expect(Number.isFinite(quote.price)).toBe(true);
      expect(quote.price).toBeGreaterThan(0);
    }

    for (const bond of world.bonds) {
      expect(bond.yieldBp).toBeGreaterThanOrEqual(50);
      expect(bond.yieldBp).toBeLessThanOrEqual(3_000);
      expect(Number.isFinite(bond.price)).toBe(true);
    }

    const index = world.indices[0];
    expect(index.level).toBeGreaterThan(0);
    expect(Number.isFinite(index.changePct)).toBe(true);

    // Songs of history stay bounded even for long runs.
    expect(world.macro.length).toBeLessThanOrEqual(240);
    expect(world.news.length).toBeLessThanOrEqual(40);
  });

  it("advances the calendar according to the chosen pace", () => {
    const monthly = run(12, "MONTH");
    const yearly = run(1, "YEAR");
    const hourly = run(720, "HOUR");

    expect(monthly.calendarMonths).toBe(12);
    expect(monthly.monthLabel).toBe("January 2027");
    expect(yearly.monthLabel).toBe("January 2027");
    expect(hourly.calendarMonths).toBeCloseTo(1, 5);
    expect(PACES.HOUR.months * 720).toBeCloseTo(1, 10);
  });

  it("produces media coverage that is wired back into sentiment", () => {
    const world = run(24);
    expect(world.news.length).toBeGreaterThan(0);

    for (const story of world.news) {
      expect(story.headline.length).toBeGreaterThan(8);
      expect(story.body.length).toBeGreaterThan(8);
      expect(Number.isFinite(story.impactBp)).toBe(true);
      expect(story.credibilityPct).toBeGreaterThan(0);
      expect(["COMPANY", "COMMODITY", "GOVERNMENT"]).toContain(story.subject);
    }

    // Sentiment is bounded and actually moved by coverage.
    const moved = world.companies.filter((company) => company.sentimentBp !== 0);
    expect(moved.length).toBeGreaterThan(0);

    const touched = world.companies.filter((company) => company.lastEvent !== null);
    expect(touched.length).toBeGreaterThan(0);
  });

  it("exposes sector pressure for the price model within bounds", () => {
    const world = run(24);
    const pressure = sectorPressure(world);
    expect(Object.keys(pressure).sort()).toEqual(
      ["CONSUMER", "ENERGY", "HEALTH", "TECH"].sort(),
    );
    for (const value of Object.values(pressure)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThanOrEqual(400);
    }
  });

  it("replays to the same calendar month through economySnapshot", () => {
    const world = economySnapshot({
      seed: 42n,
      assets: ASSETS,
      pace: "MONTH",
      monthsElapsed: 30,
      startYear: 2026,
      startMonth: 7,
    });
    expect(world.step).toBe(30);
    expect(world.monthLabel).toBe("January 2029");
  });
});

describe("ownership & control", () => {
  it("maps a stake to the right control tier", () => {
    expect(tierFor(0).key).toBe("PASSIVE");
    expect(tierFor(0.9).key).toBe("PASSIVE");
    expect(tierFor(1).key).toBe("ACTIVE");
    expect(tierFor(10).key).toBe("BLOCKING");
    expect(tierFor(25).key).toBe("CONTROLLING");
    expect(tierFor(51).key).toBe("OWNER");
    expect(tierFor(100).key).toBe("OWNER");
  });

  it("thresholds match the control table and are reachable", () => {
    const shares = 200_000;
    for (const tier of CONTROL_TIERS) {
      const needed = sharesForTier(shares, tier.key);
      expect(needed).toBe(Math.ceil((shares * tier.thresholdPct) / 100));
      expect(stakePct(needed, shares)).toBeGreaterThanOrEqual(tier.thresholdPct);
    }
  });

  it("reports only held companies, with stake and next tier", () => {
    const world = run(6);
    const views = stakeViews(world.companies, [
      { symbol: "NOVA", quantity: 5_000 },
      { symbol: "GRAN", quantity: 100 },
      { symbol: "UNKNOWN", quantity: 10 },
    ]);

    expect(views.map((view) => view.symbol).sort()).toEqual(["GRAN", "NOVA"]);
    const nova = views.find((view) => view.symbol === "NOVA")!;
    expect(nova.sharesOutstanding).toBeGreaterThan(0);
    expect(nova.stakePct).toBeGreaterThan(0);
    expect(nova.tier.key).toBe(
      tierFor((5_000 / nova.sharesOutstanding) * 100).key,
    );
    expect(nova.sharesToNext).toBeGreaterThanOrEqual(0);
  });
});
