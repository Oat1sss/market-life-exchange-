/**
 * World genesis: turns a game seed and the listed stock catalog into a macro
 * economy with companies, resources, a government, media and bond/FX markets.
 * Deterministic — same seed, same world.
 */
import { gameDateFor } from "../calendar";
import * as Rng from "../rng";
import {
  BONDS,
  LEADER_NAMES,
  OUTLETS,
  PARTIES,
  PACES,
  RESOURCES,
  SECTORS,
  SECTOR_BY_KEY,
  type OutletMeta,
} from "./catalog";
import type {
  AssetLike,
  BondQuote,
  CompanyState,
  FxQuote,
  Government,
  PartyKey,
  ResourceState,
  SectorKey,
  SectorState,
  World,
} from "./types";

export interface BuildWorldInput {
  seed: bigint;
  assets: AssetLike[];
  pace: World["pace"];
  startYear: number;
  startMonth: number;
  /** Calendar months already elapsed before the first simulated step. */
  calendarMonths?: number;
}

export interface WorldGenesis {
  world: World;
  outlets: OutletMeta[];
}

const STOCK_SECTORS: SectorKey[] = ["TECH", "HEALTH", "ENERGY", "CONSUMER"];

export function isStockSector(value: string): value is SectorKey {
  return (STOCK_SECTORS as string[]).includes(value);
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function buildWorld(input: BuildWorldInput): WorldGenesis {
  const { seed, pace } = input;
  const step = 0;

  const u = (label: string, index = 0) => Rng.deriveUniform(seed, label, step, index);
  const i = (label: string, min: number, maxExclusive: number, index = 0) =>
    Rng.deriveInt(seed, label, step, min, maxExclusive, index);
  const centered = (label: string, index = 0) => u(label, index) * 2 - 1;

  const party = (["PROGRESS", "UNITY", "LIBERTY"] as PartyKey[])[i("econ:party", 0, 3)];
  const partyMeta = PARTIES[party];

  const regulationBp: Record<SectorKey, number> = {
    TECH: 90 + i("econ:reg", 0, 120),
    HEALTH: 160 + i("econ:reg", 0, 140),
    ENERGY: 220 + i("econ:reg", 0, 180),
    CONSUMER: 110 + i("econ:reg", 0, 120),
  };
  const subsidyBp: Record<SectorKey, number> = {
    TECH: 40 + i("econ:sub", 0, 80),
    HEALTH: 90 + i("econ:sub", 0, 120),
    ENERGY: 60 + i("econ:sub", 0, 120),
    CONSUMER: 30 + i("econ:sub", 0, 80),
  };

  const government: Government = {
    party,
    partyLabel: partyMeta.label,
    leader: LEADER_NAMES[i("econ:leader", 0, LEADER_NAMES.length)],
    approvalPct: 48 + i("econ:approval", 0, 12),
    policyRateBp: 400 + i("econ:rate", 0, 120),
    inflationBp: 280 + i("econ:inflation", 0, 140),
    gdpGrowthBp: 200 + i("econ:gdp", 0, 140),
    unemploymentBp: 400 + i("econ:unemployment", 0, 130),
    debtMinor: 1_200_000_000_000n + BigInt(i("econ:debt", 0, 400)) * 1_000_000_000n,
    budgetMinor: 90_000_000_000n,
    taxRateBp: 2_100 + partyMeta.taxBiasBp,
    tariffBp: 260 + i("econ:tariff", 0, 160),
    stimulusBp: 0,
    regulationBp,
    subsidyBp,
    electionInMonths: 18 + i("econ:election", 0, 36),
    lastAction: "Kabinet baru menetapkan arah kebijakan tahun ini.",
    history: [],
  };

  const resources: ResourceState[] = RESOURCES.map((meta, index) => {
    const spot = (100 + centered("econ:spot", index) * 4) / 100;
    const priceMinor = BigInt(Math.max(1, Math.round(Number(meta.basePriceMinor) * spot)));
    return {
      key: meta.key,
      name: meta.name,
      unit: meta.unit,
      priceMinor,
      prevPriceMinor: priceMinor,
      basePriceMinor: meta.basePriceMinor,
      supplyIndex: 96 + i("econ:supply", 0, 9, index),
      demandIndex: 96 + i("econ:demand", 0, 9, index),
      stockpileIndex: 90 + i("econ:stock", 0, 21, index),
      volatilityBp: meta.volatilityBp,
      strategic: meta.strategic,
      producers: meta.producers,
      changeBp: 0,
    };
  });

  const stocks = input.assets.filter(
    (asset) => (asset.kind ?? "STOCK") === "STOCK" && isStockSector(asset.sector),
  );

  const bySector = new Map<SectorKey, AssetLike[]>();
  for (const asset of stocks) {
    const sector = asset.sector as SectorKey;
    const list = bySector.get(sector) ?? [];
    list.push(asset);
    bySector.set(sector, list);
  }
  for (const list of bySector.values()) {
    list.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  const companies: CompanyState[] = stocks.map((asset, index) => {
    const sector = asset.sector as SectorKey;
    const meta = SECTOR_BY_KEY[sector];
    const peers = bySector.get(sector) ?? [];
    const peerIndex = peers.findIndex((peer) => peer.symbol === asset.symbol);

    // Market cap spans small caps (~1.2M rupiah) to mid caps (~14M rupiah). Since a
    // stake costs a tenth of the cap per 10%, this is what makes a board seat
    // reachable with a demo wallet while control of a large company stays a
    // long-term goal.
    const targetCapMinor =
      BigInt(1_200_000 + i("econ:cap", 0, 120, index) * 240_000) * 100n;
    const sharesOutstanding = clamp(
      Math.round(Number(targetCapMinor) / Number(asset.fundamentalMinor)),
      100,
      400_000,
    );
    const revenueAnnual = (targetCapMinor * 10n) / 14n;
    const revenueMinor = revenueAnnual / 12n;
    const marginBp = meta.marginBp + Math.round(centered("econ:margin", index) * 260);
    const debtRatioPct = 28 + i("econ:leverage", 0, 34, index);

    const supplierSymbol =
      peers.length > 1 ? peers[(peerIndex - 1 + peers.length) % peers.length].symbol : null;
    const customerSymbol =
      peers.length > 1 ? peers[(peerIndex + 1) % peers.length].symbol : null;

    return {
      symbol: asset.symbol,
      name: asset.name,
      sector,
      priceMinor: asset.fundamentalMinor,
      prevPriceMinor: asset.fundamentalMinor,
      fundamentalMinor: asset.fundamentalMinor,
      baseFundamentalMinor: asset.fundamentalMinor,
      volatilityBp: asset.volatilityBp,
      betaBp: asset.betaBp,
      sharesOutstanding,
      revenueMinor,
      earningsMinor: (revenueMinor * BigInt(marginBp)) / 10_000n,
      marginBp,
      baseMarginBp: meta.marginBp,
      growthBp: meta.growthBp + Math.round(centered("econ:growth", index) * 160),
      debtMinor: (targetCapMinor * BigInt(debtRatioPct)) / 100n,
      cashMinor: revenueMinor * 3n,
      employees: Math.max(
        24,
        Math.round(
          Number(revenueAnnual) / 100 / (240_000 + i("econ:employees", 0, 260, index) * 1_000),
        ),
      ),
      brandBp: 40 + i("econ:brand", 0, 41, index),
      scandalRiskBp: 8 + i("econ:scandal", 0, 28, index),
      lobbyBp: 20 + i("econ:lobby", 0, 60, index),
      sentimentBp: 0,
      status: "HEALTHY",
      inputs: meta.inputs.map((entry) => ({ ...entry })),
      supplierSymbol,
      customerSymbol,
      lastEvent: null,
      changeBp: 0,
    };
  });

  const sectors: SectorState[] = SECTORS.map((meta) => {
    const members = companies.filter((company) => company.sector === meta.key);
    const marginBp =
      members.length > 0
        ? Math.round(
            members.reduce((sum, company) => sum + company.marginBp, 0) / members.length,
          )
        : meta.marginBp;
    return {
      key: meta.key,
      name: meta.name,
      marginBp,
      avgChangeBp: 0,
      pressureBp: 0,
    };
  });

  const fxBase: Array<[string, string, number]> = [
    ["USDX", "Indeks dolar", 104.2],
    ["EURUSD", "Euro / dolar", 1.084],
    ["USDJPY", "Dolar / yen", 151.4],
    ["USDIDR", "Dolar / rupiah", 15_840],
  ];
  const fx: FxQuote[] = fxBase.map(([pair, label, base], index) => {
    const price = base * (1 + centered("econ:fx", index) * 0.015);
    return {
      pair,
      label,
      price: Math.round(price * 10_000) / 10_000,
      prevPrice: Math.round(price * 10_000) / 10_000,
      changePct: 0,
    };
  });

  const bonds: BondQuote[] = BONDS.map((meta) => {
    const yieldBp =
      government.policyRateBp + meta.spreadBp + Math.round(centered("econ:bond", 0) * 20);
    return {
      key: meta.key,
      name: meta.name,
      issuer: meta.issuer,
      rating: meta.rating,
      couponBp: meta.couponBp,
      maturityYears: meta.maturityYears,
      yieldBp,
      prevYieldBp: yieldBp,
      price: Math.round((100 + ((meta.couponBp - yieldBp) * meta.maturityYears) / 100) * 100) / 100,
    };
  });

  const calendarMonths = input.calendarMonths ?? 0;
  const date = gameDateFor(input.startYear, input.startMonth, Math.floor(calendarMonths));

  const world: World = {
    seed,
    pace,
    step: 0,
    calendarMonths,
    startYear: input.startYear,
    startMonth: input.startMonth,
    year: date.year,
    month: date.month,
    monthLabel: date.label,
    government,
    resources,
    companies,
    sectors,
    fx,
    bonds,
    indices: [
      {
        key: "MLX",
        name: "Indeks MarketLife",
        level: 1_000,
        prevLevel: 1_000,
        changePct: 0,
      },
    ],
    news: [],
    macro: [],
  };

  world.macro.push(snapshotMacro(world));
  government.history.push(snapshotMacro(world));

  return { world, outlets: OUTLETS.map((outlet) => ({ ...outlet })) };
}

/** Compact macro row used by history charts. */
export function snapshotMacro(world: World) {
  return {
    step: world.step,
    label: world.monthLabel,
    gdpGrowthBp: world.government.gdpGrowthBp,
    inflationBp: world.government.inflationBp,
    policyRateBp: world.government.policyRateBp,
    unemploymentBp: world.government.unemploymentBp,
    approvalPct: world.government.approvalPct,
    indexLevel: world.indices[0]?.level ?? 1_000,
  };
}

/** Months covered by `steps` at the given pace. */
export function monthsFor(steps: number, pace: World["pace"]): number {
  return steps * PACES[pace].months;
}
