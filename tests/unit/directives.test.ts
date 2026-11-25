/**
 * Board directives are replay inputs: the same seed and the same directives
 * must produce the same world, and an effect may only appear from the month it
 * was ordered.
 */
import { describe, expect, it } from "vitest";
import { simulateWorld } from "@/domain/economy/engine";
import {
  DIRECTIVE_COOLDOWN_MONTHS,
  canIssue,
  dividendPayout,
  type DirectiveInput,
} from "@/domain/economy";
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
    symbol: "HELX",
    name: "Helix Pharmaceuticals",
    sector: "HEALTH",
    kind: "STOCK",
    fundamentalMinor: 220_000n,
    volatilityBp: 520,
    betaBp: 900,
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
];

function run(periods: number, directives?: DirectiveInput[]) {
  return simulateWorld({
    seed: 11n,
    assets: ASSETS,
    pace: "MONTH",
    startYear: 2026,
    startMonth: 1,
    periods,
    directives,
  });
}

const company = (world: ReturnType<typeof run>, symbol: string) =>
  world.companies.find((entry) => entry.symbol === symbol)!;

const serialize = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

describe("board directives", () => {
  it("gates each resolution behind its ownership tier", () => {
    expect(canIssue("DIVIDEND", 9.9)).toBe(false);
    expect(canIssue("DIVIDEND", 10)).toBe(true);
    expect(canIssue("BUYBACK", 10)).toBe(false);
    expect(canIssue("BUYBACK", 25)).toBe(true);
    expect(canIssue("EXPANSION", 25)).toBe(true);
    expect(canIssue("CUT_COSTS", 50.9)).toBe(false);
    expect(canIssue("CUT_COSTS", 51)).toBe(true);
  });

  it("does not change the world before the resolution month", () => {
    const baseline = run(3);
    const early = run(3, [{ companySymbol: "NOVA", kind: "DIVIDEND", atMonth: 3 }]);
    expect(serialize(early.companies)).toBe(serialize(baseline.companies));
  });

  it("distributes cash, covers the boardroom and stays deterministic", () => {
    const ordered = run(6, [
      { companySymbol: "NOVA", kind: "DIVIDEND", atMonth: 2, payoutMinor: 1_000_000n },
    ]);
    const repeat = run(6, [
      { companySymbol: "NOVA", kind: "DIVIDEND", atMonth: 2, payoutMinor: 1_000_000n },
    ]);
    expect(serialize(ordered)).toBe(serialize(repeat));

    const baseline = run(6);
    expect(company(ordered, "NOVA").cashMinor).not.toBe(
      company(baseline, "NOVA").cashMinor,
    );

    const story = ordered.news.find(
      (entry) => entry.kind === "GOVERNANCE" && entry.subjectSymbol === "NOVA",
    );
    expect(story).toBeDefined();
    expect(story!.headline).toContain("Nova Dynamics");
  });

  it("retires shares in a buyback so a stake percentage grows", () => {
    const baseline = run(5);
    const after = run(5, [{ companySymbol: "HELX", kind: "BUYBACK", atMonth: 2 }]);
    expect(company(after, "HELX").sharesOutstanding).toBeLessThan(
      company(baseline, "HELX").sharesOutstanding,
    );
    expect(company(after, "HELX").cashMinor).toBeGreaterThanOrEqual(0n);
  });

  it("raises growth on expansion and margin on cost cuts", () => {
    const growthBase = run(4).companies.find((entry) => entry.symbol === "NOVA")!;
    const expansion = run(4, [
      { companySymbol: "NOVA", kind: "EXPANSION", atMonth: 2 },
    ]).companies.find((entry) => entry.symbol === "NOVA")!;
    expect(expansion.growthBp).toBeGreaterThan(growthBase.growthBp);

    const marginBase = run(4).companies.find((entry) => entry.symbol === "NOVA")!;
    const cuts = run(4, [
      { companySymbol: "NOVA", kind: "CUT_COSTS", atMonth: 2 },
    ]).companies.find((entry) => entry.symbol === "NOVA")!;
    expect(cuts.marginBp).toBeGreaterThan(marginBase.marginBp);
  });

  it("keeps a whole board cycle inside the cooldown length", () => {
    expect(DIRECTIVE_COOLDOWN_MONTHS).toBe(3);
    const world = run(1);
    expect(dividendPayout(company(world, "GRAN"))).toBeGreaterThanOrEqual(0n);
  });
});
