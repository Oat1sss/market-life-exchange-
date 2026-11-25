/**
 * Board directives: the actions a controlling shareholder can order.
 *
 * A directive is a *replay input*, not a mutation: it is stored with the game
 * month it takes effect in, and `simulateWorld` applies it when the replay
 * passes that month. That keeps the world a pure function of
 * (seed, assets, pace, directives) — the same quote everywhere, and no drift
 * between the economy page, the trade preview and `advanceGame`.
 */
import { CONTROL_TIERS, type ControlTierKey } from "./catalog";
import type { CompanyState, NewsStory, World } from "./types";

export type DirectiveKind = "DIVIDEND" | "BUYBACK" | "EXPANSION" | "CUT_COSTS";

export const DIRECTIVE_COOLDOWN_MONTHS = 3;
/** Share of company cash distributed by a dividend resolution. */
export const DIVIDEND_PAYOUT_RATIO = 0.25;

export interface DirectiveDefinition {
  kind: DirectiveKind;
  label: string;
  hint: string;
  /** Minimum ownership tier required to force the resolution through. */
  tier: ControlTierKey;
  effect: string;
}

export const DIRECTIVES: DirectiveDefinition[] = [
  {
    kind: "DIVIDEND",
    label: "Bagikan dividen",
    hint: "25% kas perusahaan dibagikan ke pemegang saham.",
    tier: "BLOCKING",
    effect: "Kas masuk sesuai porsi saham, sentimen naik",
  },
  {
    kind: "BUYBACK",
    label: "Buyback saham",
    hint: "Perusahaan membeli sahamnya sendiri dan menariknya dari pasar.",
    tier: "CONTROLLING",
    effect: "Saham beredar turun, porsi kendali Anda naik",
  },
  {
    kind: "EXPANSION",
    label: "Ekspansi agresif",
    hint: "Belanja modal dan utang naik untuk mengejar pertumbuhan.",
    tier: "CONTROLLING",
    effect: "Pertumbuhan naik, margin tertekan, utang naik",
  },
  {
    kind: "CUT_COSTS",
    label: "Efisiensi biaya",
    hint: "Pemangkasan operasi dan tenaga kerja untuk memperbaiki margin.",
    tier: "OWNER",
    effect: "Margin naik, brand turun, sentimen negatif",
  },
];

export const DIRECTIVE_BY_KIND = Object.fromEntries(
  DIRECTIVES.map((definition) => [definition.kind, definition]),
) as Record<DirectiveKind, DirectiveDefinition>;

export function isDirectiveKind(value: string): value is DirectiveKind {
  return value in DIRECTIVE_BY_KIND;
}

export function tierRank(tier: ControlTierKey): number {
  return CONTROL_TIERS.findIndex((entry) => entry.key === tier);
}

/** The strongest tier the given stake qualifies for. */
export function tierForStake(stakePct: number): ControlTierKey {
  let current: ControlTierKey = CONTROL_TIERS[0].key;
  for (const tier of CONTROL_TIERS) {
    if (stakePct >= tier.thresholdPct) current = tier.key;
  }
  return current;
}

export function canIssue(kind: DirectiveKind, stakePct: number): boolean {
  return tierRank(tierForStake(stakePct)) >= tierRank(DIRECTIVE_BY_KIND[kind].tier);
}

export interface DirectiveInput {
  companySymbol: string;
  kind: DirectiveKind;
  /** Calendar month the resolution takes effect in. */
  atMonth: number;
  /** Company cash distributed; recorded when issued so replay stays stable. */
  payoutMinor?: bigint;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Company cash a dividend resolution would distribute right now. */
export function dividendPayout(company: CompanyState): bigint {
  const raw = Number(company.cashMinor) * DIVIDEND_PAYOUT_RATIO;
  return BigInt(Math.max(0, Math.round(raw)));
}

const rupiah = (minor: bigint): string => {
  const whole = Number(minor) / 100;
  return `Rp ${whole.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
};

function story(
  world: World,
  company: CompanyState,
  kind: DirectiveKind,
  headline: string,
  body: string,
): NewsStory {
  return {
    id: `d-${world.step}-${company.symbol}-${kind}`,
    step: world.step,
    outlet: "Kabar Pasar",
    outletBias: "BUSINESS",
    credibilityPct: 78,
    headline,
    body,
    subject: "COMPANY",
    subjectSymbol: company.symbol,
    kind: "GOVERNANCE",
    tone: kind === "CUT_COSTS" ? "NEGATIVE" : "POSITIVE",
    impactBp: 0,
  };
}

/**
 * Applies one board decision to the company. Returns a news story for the
 * boardroom coverage, or null when the company is not in this world.
 */
export function applyDirective(world: World, directive: DirectiveInput): NewsStory | null {
  const company = world.companies.find((entry) => entry.symbol === directive.companySymbol);
  if (!company) return null;

  switch (directive.kind) {
    case "DIVIDEND": {
      const recorded = directive.payoutMinor ?? dividendPayout(company);
      const payout = recorded > company.cashMinor ? company.cashMinor : recorded;
      company.cashMinor -= payout;
      company.sentimentBp = clamp(company.sentimentBp + 35, -400, 400);
      company.brandBp = clamp(company.brandBp + 1, 5, 95);
      return story(
        world,
        company,
        directive.kind,
        `RUPS ${company.name} setujui dividen ${rupiah(payout)}`,
        `Pemegang saham mayoritas mendorong pembagian kas. Kas perusahaan tersisa ${rupiah(company.cashMinor)}.`,
      );
    }

    case "BUYBACK": {
      const budget = company.cashMinor / 4n;
      const affordableShares =
        company.priceMinor > 0n ? Number(budget / company.priceMinor) : 0;
      const retired = Math.min(
        Math.max(0, affordableShares),
        Math.floor(company.sharesOutstanding * 0.1),
      );
      const spent = company.priceMinor * BigInt(retired);
      company.cashMinor -= spent;
      company.sharesOutstanding = Math.max(
        1_000,
        company.sharesOutstanding - retired,
      );
      company.sentimentBp = clamp(company.sentimentBp + 25, -400, 400);
      company.brandBp = clamp(company.brandBp + 1, 5, 95);
      return story(
        world,
        company,
        directive.kind,
        `${company.name} menarik ${retired.toLocaleString("id-ID")} saham dari pasar`,
        `Buyback senilai ${rupiah(spent)} menurunkan saham beredar menjadi ${company.sharesOutstanding.toLocaleString("id-ID")} lembar.`,
      );
    }

    case "EXPANSION": {
      const capex = company.revenueMinor / 6n;
      company.cashMinor -= capex;
      company.debtMinor += (company.revenueMinor * 2n) / 10n;
      company.growthBp = clamp(company.growthBp + 120, -600, 1_200);
      company.marginBp = clamp(company.marginBp - 20, -900, 7_000);
      company.brandBp = clamp(company.brandBp + 2, 5, 95);
      company.sentimentBp = clamp(company.sentimentBp + 15, -400, 400);
      return story(
        world,
        company,
        directive.kind,
        `${company.name} umumkan ekspansi senilai ${rupiah(capex)}`,
        `Belanja modal didanai kas dan utang baru untuk mengejar pertumbuhan pendapatan.`,
      );
    }

    case "CUT_COSTS": {
      const cut = Math.max(1, Math.round(company.employees * 0.05));
      company.employees = Math.max(5, company.employees - cut);
      company.marginBp = clamp(company.marginBp + 150, -900, 7_000);
      company.brandBp = clamp(company.brandBp - 4, 5, 95);
      company.sentimentBp = clamp(company.sentimentBp - 25, -400, 400);
      company.scandalRiskBp = clamp(company.scandalRiskBp + 3, 0, 100);
      world.government.unemploymentBp = clamp(world.government.unemploymentBp + 2, 150, 2_000);
      return story(
        world,
        company,
        directive.kind,
        `${company.name} pangkas ${cut.toLocaleString("id-ID")} karyawan demi margin`,
        `Manajemen menargetkan margin lebih tebal; serikat pekerja menolak langkah efisiensi ini.`,
      );
    }
  }
}

/**
 * Applies every directive whose month has arrived. Directives are applied in
 * chronological order, and each one only once per replay.
 */
export function applyDueDirectives(
  world: World,
  directives: DirectiveInput[],
  applied: Set<number>,
): NewsStory[] {
  const stories: NewsStory[] = [];
  for (let index = 0; index < directives.length; index += 1) {
    if (applied.has(index)) continue;
    const directive = directives[index];
    if (directive.atMonth > Math.floor(world.calendarMonths)) continue;
    applied.add(index);
    const result = applyDirective(world, directive);
    if (result) stories.push(result);
  }
  return stories;
}
