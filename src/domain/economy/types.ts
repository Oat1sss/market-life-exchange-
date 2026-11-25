/**
 * Macro-economy state (docs-style module, pure domain).
 *
 * The world is a deterministic function of (seed, pace, elapsed time): every
 * step reads its randomness from `@/domain/rng` keyed by the step index, so a
 * game can be replayed from its seed and a page render never mutates anything.
 *
 * Money is bigint minor units (1 credit = 100 minor units). Rates, growth and
 * margins are basis points (100 bp = 1%). Time is measured in months; a step
 * lasts `PaceDefinition.months` (an hour is 1/720 month).
 */
export type PaceKey = "HOUR" | "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";

export interface PaceDefinition {
  key: PaceKey;
  label: string;
  short: string;
  /** Length of one simulation step, in months. */
  months: number;
  stepsPerYear: number;
}

/** Tradeable stock sectors; crypto is a separate market and not simulated here. */
export type SectorKey = "TECH" | "HEALTH" | "ENERGY" | "CONSUMER";

export type ResourceKey =
  | "OIL"
  | "GAS"
  | "COPPER"
  | "LITHIUM"
  | "SILICON"
  | "WHEAT"
  | "GOLD";

export type PartyKey = "PROGRESS" | "UNITY" | "LIBERTY";

export type CompanyStatus = "HEALTHY" | "STRESSED" | "DISTRESSED";

export type NewsSubject = "COMPANY" | "GOVERNMENT" | "COMMODITY";

export type NewsKind =
  | "RALLY"
  | "SELLOFF"
  | "SCANDAL"
  | "LAYOFF"
  | "EARNINGS"
  | "POLICY"
  | "SUPPLY"
  | "GOVERNANCE";

export type NewsTone = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface MacroPoint {
  step: number;
  label: string;
  gdpGrowthBp: number;
  inflationBp: number;
  policyRateBp: number;
  unemploymentBp: number;
  approvalPct: number;
  indexLevel: number;
}

export interface Government {
  party: PartyKey;
  partyLabel: string;
  leader: string;
  approvalPct: number;
  policyRateBp: number;
  inflationBp: number;
  gdpGrowthBp: number;
  unemploymentBp: number;
  debtMinor: bigint;
  budgetMinor: bigint;
  taxRateBp: number;
  tariffBp: number;
  stimulusBp: number;
  /** Sector regulation burden in bp of margin; higher = more costly. */
  regulationBp: Record<SectorKey, number>;
  /** Sector subsidy in bp of margin. */
  subsidyBp: Record<SectorKey, number>;
  electionInMonths: number;
  lastAction: string;
  history: MacroPoint[];
}

export interface ResourceState {
  key: ResourceKey;
  name: string;
  unit: string;
  priceMinor: bigint;
  prevPriceMinor: bigint;
  basePriceMinor: bigint;
  /** Index levels, 100 = long-run normal. */
  supplyIndex: number;
  demandIndex: number;
  stockpileIndex: number;
  volatilityBp: number;
  strategic: boolean;
  producers: SectorKey[];
  changeBp: number;
}

export interface CompanyInput {
  resource: ResourceKey;
  weight: number;
}

export interface CompanyState {
  symbol: string;
  name: string;
  sector: SectorKey;
  priceMinor: bigint;
  prevPriceMinor: bigint;
  fundamentalMinor: bigint;
  /** Fundamental at genesis, used to keep long runs from exploding. */
  baseFundamentalMinor: bigint;
  volatilityBp: number;
  betaBp: number;
  sharesOutstanding: number;
  /** Monthly revenue and net profit. */
  revenueMinor: bigint;
  earningsMinor: bigint;
  marginBp: number;
  baseMarginBp: number;
  growthBp: number;
  debtMinor: bigint;
  cashMinor: bigint;
  employees: number;
  brandBp: number;
  scandalRiskBp: number;
  lobbyBp: number;
  sentimentBp: number;
  status: CompanyStatus;
  inputs: CompanyInput[];
  supplierSymbol: string | null;
  customerSymbol: string | null;
  lastEvent: string | null;
  changeBp: number;
}

export interface SectorState {
  key: SectorKey;
  name: string;
  marginBp: number;
  avgChangeBp: number;
  /** Forward-looking pressure the price model consumes, ±400 bp. */
  pressureBp: number;
}

export interface FxQuote {
  pair: string;
  label: string;
  price: number;
  prevPrice: number;
  changePct: number;
}

export interface BondQuote {
  key: string;
  name: string;
  issuer: "GOVERNMENT" | "CORPORATE";
  rating: string;
  couponBp: number;
  maturityYears: number;
  yieldBp: number;
  prevYieldBp: number;
  /** Price per 100 par. */
  price: number;
}

export interface IndexQuote {
  key: string;
  name: string;
  level: number;
  prevLevel: number;
  changePct: number;
}

export interface NewsStory {
  id: string;
  step: number;
  outlet: string;
  outletBias: string;
  credibilityPct: number;
  headline: string;
  body: string;
  subject: NewsSubject;
  subjectSymbol: string | null;
  kind: NewsKind;
  tone: NewsTone;
  impactBp: number;
}

export interface World {
  seed: bigint;
  pace: PaceKey;
  /** Completed simulation steps. */
  step: number;
  /** Calendar position in months since the game start month. */
  calendarMonths: number;
  startYear: number;
  startMonth: number;
  year: number;
  month: number;
  monthLabel: string;
  government: Government;
  resources: ResourceState[];
  companies: CompanyState[];
  sectors: SectorState[];
  fx: FxQuote[];
  bonds: BondQuote[];
  indices: IndexQuote[];
  news: NewsStory[];
  macro: MacroPoint[];
}

/** Minimal asset shape the economy needs; matches the Prisma Asset model. */
export interface AssetLike {
  symbol: string;
  name: string;
  sector: string;
  kind?: string;
  fundamentalMinor: bigint;
  volatilityBp: number;
  betaBp: number;
}
