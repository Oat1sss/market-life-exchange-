/**
 * Static definitions for the macro-economy: time paces, sectors, resources,
 * media outlets and bond lines. Nothing here is random; the engine derives all
 * variation from the game seed.
 */
import type {
  PaceDefinition,
  PaceKey,
  ResourceKey,
  SectorKey,
} from "./types";

export const PACES: Record<PaceKey, PaceDefinition> = {
  HOUR: { key: "HOUR", label: "Per jam", short: "1J", months: 1 / 720, stepsPerYear: 8_760 },
  DAY: { key: "DAY", label: "Per hari", short: "1H", months: 1 / 30, stepsPerYear: 365 },
  WEEK: { key: "WEEK", label: "Per minggu", short: "1M", months: 7 / 30, stepsPerYear: 52 },
  MONTH: { key: "MONTH", label: "Per bulan", short: "1B", months: 1, stepsPerYear: 12 },
  QUARTER: { key: "QUARTER", label: "Per kuartal", short: "3B", months: 3, stepsPerYear: 4 },
  YEAR: { key: "YEAR", label: "Per tahun", short: "1T", months: 12, stepsPerYear: 1 },
};

export const PACE_KEYS: PaceKey[] = ["HOUR", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"];

export function isPaceKey(value: string | undefined): value is PaceKey {
  return value !== undefined && (PACE_KEYS as string[]).includes(value);
}

export interface SectorMeta {
  key: SectorKey;
  name: string;
  /** Long-run gross margin, bp of revenue. */
  marginBp: number;
  /** Long-run annual revenue growth, bp. */
  growthBp: number;
  inputs: Array<{ resource: ResourceKey; weight: number }>;
}

export const SECTORS: SectorMeta[] = [
  {
    key: "TECH",
    name: "Teknologi",
    marginBp: 2_600,
    growthBp: 420,
    inputs: [
      { resource: "SILICON", weight: 0.34 },
      { resource: "COPPER", weight: 0.22 },
      { resource: "GAS", weight: 0.12 },
    ],
  },
  {
    key: "HEALTH",
    name: "Kesehatan",
    marginBp: 2_150,
    growthBp: 260,
    inputs: [
      { resource: "GAS", weight: 0.18 },
      { resource: "COPPER", weight: 0.1 },
      { resource: "SILICON", weight: 0.06 },
    ],
  },
  {
    key: "ENERGY",
    name: "Energi",
    marginBp: 1_850,
    growthBp: 190,
    inputs: [
      { resource: "OIL", weight: 0.3 },
      { resource: "GAS", weight: 0.18 },
      { resource: "COPPER", weight: 0.08 },
    ],
  },
  {
    key: "CONSUMER",
    name: "Konsumen",
    marginBp: 1_550,
    growthBp: 230,
    inputs: [
      { resource: "WHEAT", weight: 0.32 },
      { resource: "GAS", weight: 0.16 },
      { resource: "OIL", weight: 0.12 },
    ],
  },
];

export const SECTOR_BY_KEY: Record<SectorKey, SectorMeta> = {
  TECH: SECTORS[0],
  HEALTH: SECTORS[1],
  ENERGY: SECTORS[2],
  CONSUMER: SECTORS[3],
};

export interface ResourceMeta {
  key: ResourceKey;
  name: string;
  unit: string;
  /** Spot price at genesis, minor units. */
  basePriceMinor: bigint;
  volatilityBp: number;
  strategic: boolean;
  producers: SectorKey[];
}

export const RESOURCES: ResourceMeta[] = [
  {
    key: "OIL",
    name: "Minyak mentah",
    unit: "barel",
    basePriceMinor: 8_200n,
    volatilityBp: 340,
    strategic: true,
    producers: ["ENERGY"],
  },
  {
    key: "GAS",
    name: "Gas alam",
    unit: "MMBtu",
    basePriceMinor: 2_650n,
    volatilityBp: 380,
    strategic: true,
    producers: ["ENERGY"],
  },
  {
    key: "COPPER",
    name: "Tembaga",
    unit: "ton",
    basePriceMinor: 41_200n,
    volatilityBp: 260,
    strategic: false,
    producers: ["ENERGY"],
  },
  {
    key: "LITHIUM",
    name: "Litium karbonat",
    unit: "ton",
    basePriceMinor: 148_000n,
    volatilityBp: 420,
    strategic: false,
    producers: ["ENERGY"],
  },
  {
    key: "SILICON",
    name: "Wafer silikon",
    unit: "lembar",
    basePriceMinor: 9_800n,
    volatilityBp: 300,
    strategic: false,
    producers: ["TECH"],
  },
  {
    key: "WHEAT",
    name: "Gandum",
    unit: "bushel",
    basePriceMinor: 2_400n,
    volatilityBp: 290,
    strategic: true,
    producers: ["CONSUMER"],
  },
  {
    key: "GOLD",
    name: "Emas",
    unit: "ons",
    basePriceMinor: 235_000n,
    volatilityBp: 180,
    strategic: true,
    producers: ["ENERGY"],
  },
];

export const PARTIES: Record<
  string,
  { label: string; taxBiasBp: number; subsidyBiasBp: number; regulationBiasBp: number }
> = {
  PROGRESS: {
    label: "Partai Progresif",
    taxBiasBp: 180,
    subsidyBiasBp: 220,
    regulationBiasBp: 180,
  },
  UNITY: {
    label: "Partai Persatuan",
    taxBiasBp: 0,
    subsidyBiasBp: 60,
    regulationBiasBp: 40,
  },
  LIBERTY: {
    label: "Partai Kebebasan",
    taxBiasBp: -220,
    subsidyBiasBp: -40,
    regulationBiasBp: -140,
  },
};

export const LEADER_NAMES = [
  "Rani Wibawa",
  "Tomas Adinegara",
  "Sari Kusuma",
  "Bram Santosa",
  "Nadia Prasetyo",
  "Gilang Mahendra",
];

export interface OutletMeta {
  key: string;
  name: string;
  bias: "MARKET" | "BUSINESS" | "POPULIST" | "LABOUR" | "GLOBAL";
  credibilityPct: number;
  reachPct: number;
}

export const OUTLETS: OutletMeta[] = [
  { key: "LEDGER", name: "The Ledger", bias: "GLOBAL", credibilityPct: 88, reachPct: 70 },
  { key: "PASAR", name: "Kanal Pasar", bias: "MARKET", credibilityPct: 82, reachPct: 64 },
  { key: "BISNIS", name: "Kabar Bisnis", bias: "BUSINESS", credibilityPct: 74, reachPct: 58 },
  { key: "NUSA", name: "Nusa Daily", bias: "POPULIST", credibilityPct: 58, reachPct: 81 },
  { key: "RAKYAT", name: "Suara Rakyat", bias: "LABOUR", credibilityPct: 63, reachPct: 66 },
];

export interface BondMeta {
  key: string;
  name: string;
  issuer: "GOVERNMENT" | "CORPORATE";
  rating: string;
  couponBp: number;
  maturityYears: number;
  spreadBp: number;
}

export const BONDS: BondMeta[] = [
  {
    key: "GB2",
    name: "Obligasi Negara 2 tahun",
    issuer: "GOVERNMENT",
    rating: "AA",
    couponBp: 520,
    maturityYears: 2,
    spreadBp: 40,
  },
  {
    key: "GB10",
    name: "Obligasi Negara 10 tahun",
    issuer: "GOVERNMENT",
    rating: "AA",
    couponBp: 640,
    maturityYears: 10,
    spreadBp: 95,
  },
  {
    key: "CAAA",
    name: "Obligasi korporasi AAA 7 tahun",
    issuer: "CORPORATE",
    rating: "AAA",
    couponBp: 780,
    maturityYears: 7,
    spreadBp: 175,
  },
  {
    key: "CBBB",
    name: "Obligasi korporasi BBB 7 tahun",
    issuer: "CORPORATE",
    rating: "BBB",
    couponBp: 1_120,
    maturityYears: 7,
    spreadBp: 420,
  },
];

/** Control thresholds for a stake in a listed company, in percent. */
export const CONTROL_TIERS = [
  { key: "PASSIVE", label: "Pasif", thresholdPct: 0, note: "Tanpa hak suara berarti" },
  { key: "ACTIVE", label: "Aktif", thresholdPct: 1, note: "Bisa mengajukan agenda RUPS" },
  { key: "BLOCKING", label: "Blocking", thresholdPct: 10, note: "Bisa memblokir resolusi khusus" },
  { key: "CONTROLLING", label: "Pengendali", thresholdPct: 25, note: "Menentukan arah strategi" },
  { key: "OWNER", label: "Mayoritas", thresholdPct: 51, note: "Kendali penuh atas perusahaan" },
] as const;

export type ControlTierKey = (typeof CONTROL_TIERS)[number]["key"];
