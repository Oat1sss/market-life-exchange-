/**
 * Macro-economy step engine.
 *
 * One step lasts `PaceDefinition.months`: an hour, a day, a month, a year. All
 * rates are expressed per month-or-year and scaled by the step length, and
 * diffusion terms scale with the square root of time, so a yearly pace sees the
 * same economy as 12 monthly steps in aggregate (with coarser shocks).
 *
 * Feedback loops the model contains:
 *   resources → company input costs → margins → earnings → price
 *   company growth ↔ supplier/customer revenue (chain effects)
 *   layoffs → unemployment → approval → policy → rates/taxes/subsidies
 *   policy & scandals → media coverage → sentiment → price, regulation
 *   prices → index → FX → bond yields
 */
import { gameDateFor } from "../calendar";
import * as Rng from "../rng";
import {
  BONDS,
  OUTLETS,
  PARTIES,
  PACES,
  SECTORS,
  SECTOR_BY_KEY,
} from "./catalog";
import type {
  AssetLike,
  CompanyState,
  NewsKind,
  NewsStory,
  NewsSubject,
  NewsTone,
  PaceKey,
  ResourceKey,
  World,
} from "./types";
import { buildWorld, snapshotMacro } from "./world";
import { applyDueDirectives, type DirectiveInput } from "./directives";

const BP = 10_000;
const BP_BIG = 10_000n;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const round = Math.round;

function scaleMoney(amount: bigint, bp: number): bigint {
  if (amount === 0n) return 0n;
  const factor = BP + round(bp);
  if (factor <= 0) return 0n;
  return (amount * BigInt(factor)) / BP_BIG;
}

function portion(amount: bigint, fraction: number): bigint {
  const micro = round(fraction * 1_000_000);
  if (micro <= 0) return 0n;
  return (amount * BigInt(micro)) / 1_000_000n;
}

function pctBp(previous: bigint, next: bigint): number {
  if (previous === 0n) return 0;
  return Number(((next - previous) * BP_BIG) / previous);
}

function clampMoney(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Fast deterministic stream for one simulation step. The seed is derived once
 * with HMAC (keeping every step reproducible from the game seed) and the draws
 * inside the step use a small fixed PRNG, so replaying hundreds of steps does
 * not cost a hash per company draw.
 */
function stepRandom(seed: bigint, step: number) {
  let state = Rng.deriveInt(seed, "econ:stream", step, 1, 2_147_483_647) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const gauss = () => {
    const u1 = Math.max(next(), Number.EPSILON);
    const u2 = next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return { next, gauss };
}

export interface SimulateOptions {
  seed: bigint;
  assets: AssetLike[];
  pace: PaceKey;
  startYear: number;
  startMonth: number;
  calendarMonths?: number;
  periods: number;
  /**
   * Board decisions to apply during the replay. They are inputs, not state:
   * replaying the same seed with the same directives always yields the same
   * world.
   */
  directives?: DirectiveInput[];
}

export function simulateWorld(options: SimulateOptions): World {
  const { world } = buildWorld(options);
  const directives = [...(options.directives ?? [])].sort(
    (a, b) => a.atMonth - b.atMonth,
  );
  const applied = new Set<number>();
  for (let index = 0; index < options.periods; index += 1) {
    const stories = applyDueDirectives(world, directives, applied);
    if (stories.length > 0) world.news = stories.concat(world.news);
    stepWorld(world);
  }
  return world;
}

export function stepWorld(world: World): void {
  const pace = PACES[world.pace];
  const months = pace.months;
  const diffusion = Math.sqrt(months);
  const stepIndex = world.step;
  const seed = world.seed;
  const random = stepRandom(seed, stepIndex);
  const rnd = () => random.next();
  const gauss = () => random.gauss();

  const government = world.government;
  const resourceByKey = new Map(world.resources.map((resource) => [resource.key, resource]));
  const companyBySymbol = new Map(world.companies.map((company) => [company.symbol, company]));

  /* ---- 1. Resources: supply, demand, spot price ---------------------- */
  for (let index = 0; index < world.resources.length; index += 1) {
    const resource = world.resources[index];
    const supplyShock = gauss() * 0.028 * diffusion;
    resource.supplyIndex = clamp(
      resource.supplyIndex * (1 + supplyShock + 0.004 * months) +
        (100 - resource.supplyIndex) * 0.02 * months,
      25,
      240,
    );
    const demandGrowth = 1 + (government.gdpGrowthBp / BP) * (months / 12);
    resource.demandIndex = clamp(
      resource.demandIndex * demandGrowth * (1 + gauss() * 0.012 * diffusion),
      25,
      260,
    );

    const imbalance =
      (resource.demandIndex - resource.supplyIndex) / Math.max(40, resource.supplyIndex);
    const reversion =
      (Number(resource.basePriceMinor) - Number(resource.priceMinor)) /
      Number(resource.basePriceMinor);
    const move = clamp(
      imbalance * 0.35 +
        reversion * 0.03 +
        gauss() * (resource.volatilityBp / BP) * diffusion,
      -0.14,
      0.14,
    );
    resource.prevPriceMinor = resource.priceMinor;
    resource.priceMinor = BigInt(
      Math.max(1, round(Number(resource.priceMinor) * (1 + move))),
    );
    resource.changeBp = pctBp(resource.prevPriceMinor, resource.priceMinor);
    resource.stockpileIndex = clamp(
      resource.stockpileIndex + (resource.supplyIndex - resource.demandIndex) * 0.12 * months,
      10,
      240,
    );
  }

  /* ---- 2. Government: policy, taxes, elections, macro ------------- */
  const policyEvery = Math.max(1, round(3 / months));
  if (stepIndex % policyEvery === 0) {
    const targetRate =
      250 + (government.inflationBp - 250) * 0.65 + (government.gdpGrowthBp - 220) * 0.4;
    const maxMove = round(80 * Math.max(1, months / 3));
    government.policyRateBp = clamp(
      government.policyRateBp +
        clamp(round((targetRate - government.policyRateBp) * 0.4), -maxMove, maxMove),
      0,
      1_800,
    );

    if (government.unemploymentBp > 650) {
      government.stimulusBp = clamp(government.stimulusBp + round(40 * months), 0, 900);
    } else if (government.inflationBp > 420) {
      government.stimulusBp = clamp(government.stimulusBp - round(35 * months), 0, 900);
    } else {
      government.stimulusBp = clamp(
        government.stimulusBp + round((250 - government.stimulusBp) * 0.02),
        0,
        900,
      );
    }

    const partyMeta = PARTIES[government.party] ?? PARTIES.UNITY;
    government.taxRateBp = clamp(
      2_050 +
        partyMeta.taxBiasBp +
        (government.debtMinor > 1_800_000_000_000n ? 120 : 0),
      1_200,
      3_400,
    );

    for (const sector of SECTORS) {
      const members = world.companies.filter((company) => company.sector === sector.key);
      const avgLobby =
        members.length > 0
          ? members.reduce((sum, company) => sum + company.lobbyBp, 0) / members.length
          : 40;
      government.regulationBp[sector.key] = clamp(
        round(
          government.regulationBp[sector.key] +
            ((avgLobby - 45) * 0.8 - partyMeta.regulationBiasBp * 0.25) *
              0.15 *
              Math.max(months, 0.5),
        ),
        0,
        900,
      );
      government.subsidyBp[sector.key] = clamp(
        round(
          government.subsidyBp[sector.key] * 0.94 +
            (90 + partyMeta.subsidyBiasBp) * 0.06,
        ),
        0,
        700,
      );
    }

    // Deficit spending: ~15% of the annual budget plus stimulus outlays.
    government.debtMinor +=
      portion((government.budgetMinor * 15n) / 100n, months / 12) +
      portion(BigInt(government.stimulusBp) * 1_000_000n, months / 12);

    government.lastAction = `Bank sentral menetapkan suku bunga ${(
      government.policyRateBp / 100
    ).toFixed(2)}%.`;
  }

  government.electionInMonths -= months;
  if (government.electionInMonths <= 0) {
    const incumbentChance = clamp(0.35 + (government.approvalPct - 45) / 100, 0.08, 0.92);
    const keep = rnd() < incumbentChance;
    if (!keep) {
      const options = (["PROGRESS", "UNITY", "LIBERTY"] as const).filter(
        (party) => party !== government.party,
      );
      const next = options[Math.floor(rnd() * options.length)];
      government.party = next;
      government.partyLabel = PARTIES[next].label;
      government.leader =
        government.leader === "Rani Wibawa" ? "Tomas Adinegara" : "Rani Wibawa";
    }
    government.electionInMonths = 42 + Math.round(rnd() * 18);
    government.lastAction = keep
      ? `${government.partyLabel} bertahan; kabinet lanjutkan program.`
      : `${government.partyLabel} memenangkan pemilu dengan janji perubahan.`;
    government.approvalPct = clamp(
      round(government.approvalPct + (keep ? 2 : 6)),
      5,
      95,
    );
  }

  const oil = resourceByKey.get("OIL");
  const energyInflationBp = oil ? (oil.changeBp / months) * 0.18 : 0;
  const wageBp = clamp(180 + (500 - government.unemploymentBp) * 0.4, 40, 900);
  // Inflation mean-reverts to a wage/energy-determined equilibrium, pulled
  // down by a restrictive policy rate.
  government.inflationBp = clamp(
    round(
      government.inflationBp +
        (energyInflationBp * 0.3 +
          wageBp * 0.5 +
          250 -
          (government.policyRateBp - 250) * 0.15 -
          government.inflationBp) *
          0.06 *
          months +
        gauss() * 25 * Math.min(months, 1),
    ),
    -50,
    2_200,
  );

  const stimulusSupport = government.stimulusBp / 100;
  const drag =
    (government.policyRateBp - 250) * 0.02 + Math.max(0, energyInflationBp) * 0.03;
  government.gdpGrowthBp = clamp(
    round(
      government.gdpGrowthBp +
        (stimulusSupport - drag - (government.gdpGrowthBp - 240) * 0.08) * months * 0.3 +
        gauss() * 30 * Math.min(months, 1),
    ),
    -900,
    900,
  );

  /* ---- 3. Companies: costs, demand, earnings, price ----------------- */
  const resourceInflationAnnual = new Map<ResourceKey, number>();
  for (const resource of world.resources) {
    resourceInflationAnnual.set(resource.key, resource.changeBp / months);
  }

  let layoffs = 0;
  let totalEmployees = 0;

  for (let index = 0; index < world.companies.length; index += 1) {
    const company = world.companies[index];
    totalEmployees += company.employees;

    const inputInflationBp = company.inputs.reduce((sum, input) => {
      const annual = resourceInflationAnnual.get(input.resource) ?? 0;
      return sum + annual * input.weight;
    }, 0);
    const subsidy = government.subsidyBp[company.sector];
    const regulation = government.regulationBp[company.sector];
    const companyWageBp = clamp(220 + (500 - government.unemploymentBp) * 0.5, 60, 900);
    const tariff =
      (government.tariffBp * (company.sector === "CONSUMER" ? 0.5 : 0.2)) / 100;

    const marginTarget =
      company.baseMarginBp +
      (company.brandBp - 50) * 2 +
      subsidy -
      regulation -
      inputInflationBp * 0.45 -
      companyWageBp * 0.5 -
      tariff;
    company.marginBp = clamp(
      round(
        company.marginBp +
          (marginTarget - company.marginBp) * 0.12 * Math.max(months, 0.05),
      ),
      -900,
      7_000,
    );

    const supplier = company.supplierSymbol
      ? companyBySymbol.get(company.supplierSymbol)
      : undefined;
    const customer = company.customerSymbol
      ? companyBySymbol.get(company.customerSymbol)
      : undefined;
    const chainBp =
      (customer
        ? clamp((customer.marginBp - customer.baseMarginBp) / 8, -60, 60)
        : 0) +
      (supplier
        ? clamp((supplier.marginBp - supplier.baseMarginBp) / 16, -30, 30)
        : 0);

    const annualGrowthBp = round(
      government.gdpGrowthBp * 0.45 +
        company.growthBp * 0.55 +
        (company.brandBp - 50) * 2.5 +
        chainBp +
        (rnd() - 0.5) * 500,
    );
    company.revenueMinor = scaleMoney(
      company.revenueMinor,
      round((annualGrowthBp * months) / 12),
    );

    const grossProfit = (company.revenueMinor * BigInt(company.marginBp)) / BP_BIG;
    const spreadBp = 220 + company.scandalRiskBp;
    const interestAnnual =
      (company.debtMinor * BigInt(round(government.policyRateBp + spreadBp))) / BP_BIG;
    const interest = portion(interestAnnual, months / 12);
    const earningsBeforeTax = grossProfit - interest;
    const tax =
      earningsBeforeTax > 0n
        ? (earningsBeforeTax * BigInt(government.taxRateBp)) / BP_BIG
        : 0n;
    const net = earningsBeforeTax - tax;
    company.earningsMinor = net;
    company.cashMinor += portion(net, months);

    const fundamentalGrowthBp = round(
      (company.marginBp - company.baseMarginBp) * 0.06 +
        (annualGrowthBp - government.gdpGrowthBp) * 0.06,
    );
    company.fundamentalMinor = clampMoney(
      scaleMoney(company.fundamentalMinor, round((fundamentalGrowthBp * months) / 12)),
      company.baseFundamentalMinor / 5n > 0n ? company.baseFundamentalMinor / 5n : 1n,
      company.baseFundamentalMinor * 5n,
    );

    const monthlyCost =
      company.revenueMinor - (company.revenueMinor * BigInt(company.marginBp)) / BP_BIG;
    if (company.cashMinor < 0n || company.marginBp < 0) {
      company.status = "DISTRESSED";
    } else if (company.cashMinor < monthlyCost) {
      company.status = "STRESSED";
    } else {
      company.status = "HEALTHY";
    }

    if (company.status === "DISTRESSED") {
      const cut = clamp(round(company.employees * 0.03 * Math.min(months, 1)), 1, 2_000);
      layoffs += cut;
      company.employees = Math.max(5, company.employees - cut);
      company.brandBp = clamp(round(company.brandBp - 2 * Math.min(months, 1)), 5, 95);
      company.scandalRiskBp = clamp(
        round(company.scandalRiskBp + 3 * Math.min(months, 1)),
        0,
        100,
      );
      company.debtMinor += portion(-net > 0n ? -net : 0n, months);
      if (company.cashMinor < 0n) company.cashMinor = 0n;
    } else if (company.status === "HEALTHY" && rnd() > 0.6) {
      company.employees += Math.max(1, round(company.employees * 0.01 * Math.min(months, 1)));
      company.brandBp = clamp(company.brandBp + 1, 5, 95);
    }

    // Profitable firms return excess cash (dividends/buybacks) instead of
    // hoarding an ever-growing buffer, so a bad stretch can still hurt them.
    if (company.status === "HEALTHY" && company.cashMinor > company.revenueMinor * 8n) {
      company.cashMinor /= 2n;
    }

    company.brandBp = clamp(
      round(company.brandBp + gauss() * 1.5 * diffusion),
      5,
      95,
    );
    company.scandalRiskBp = clamp(
      round(company.scandalRiskBp + (rnd() - 0.45) * 1.5 * months),
      0,
      100,
    );

    company.sentimentBp = clamp(
      round(company.sentimentBp * (1 - 0.15 * months) + gauss() * 40 * diffusion),
      -400,
      400,
    );

    const gapBp = clamp(
      round(
        (Number(company.fundamentalMinor - company.priceMinor) * BP) /
          Number(company.fundamentalMinor),
      ),
      -5_000,
      5_000,
    );
    const sentimentRide = round((company.sentimentBp * company.betaBp) / BP);
    const policyDrag = round((government.policyRateBp - 300) * 0.02);
    const noise = gauss() * company.volatilityBp * diffusion;
    const returnBp = clamp(
      round(
        gapBp * 0.08 * Math.min(months, 1) +
          sentimentRide * Math.min(months, 1) +
          noise +
          policyDrag * Math.min(months, 1),
      ),
      -3_000,
      3_000,
    );

    company.prevPriceMinor = company.priceMinor;
    company.priceMinor = BigInt(
      Math.max(1, round(Number(company.priceMinor) * (1 + returnBp / BP))),
    );
    company.changeBp = pctBp(company.prevPriceMinor, company.priceMinor);
  }

  /* ---- 4. Labour market & approval --------------------------------- */
  const layoffPressureBp =
    totalEmployees > 0 ? (layoffs / totalEmployees) * BP : 0;
  government.unemploymentBp = clamp(
    round(
      government.unemploymentBp +
        ((520 - government.gdpGrowthBp) * 0.008 +
          layoffPressureBp * 0.6 -
          (government.unemploymentBp - 420) * 0.01) *
          months,
    ),
    150,
    2_000,
  );
  const economyScore =
    (government.gdpGrowthBp - 240) / 90 -
    (government.inflationBp - 250) / 110 -
    (government.unemploymentBp - 430) / 70;
  government.approvalPct = clamp(
    round(
      government.approvalPct +
        (50 + economyScore - government.approvalPct) *
          0.05 *
          Math.min(Math.max(months, 0.25), 4),
    ),
    5,
    95,
  );

  /* ---- 5. Sector aggregates (forward pressure for the price model) -- */
  for (const sector of world.sectors) {
    const members = world.companies.filter((company) => company.sector === sector.key);
    if (members.length === 0) continue;
    sector.avgChangeBp = round(
      members.reduce((sum, company) => sum + company.changeBp, 0) / members.length,
    );
    sector.marginBp = round(
      members.reduce((sum, company) => sum + company.marginBp, 0) / members.length,
    );
    sector.pressureBp = clamp(
      round(
        sector.avgChangeBp * 0.25 +
          (sector.marginBp - SECTOR_BY_KEY[sector.key].marginBp) / 12 +
          (government.gdpGrowthBp - 240) / 12,
      ),
      -400,
      400,
    );
  }

  /* ---- 6. Index, FX, bonds ------------------------------------------ */
  const baseCap = world.companies.reduce(
    (sum, company) => sum + Number(company.baseFundamentalMinor) * company.sharesOutstanding,
    0,
  );
  const currentCap = world.companies.reduce(
    (sum, company) => sum + Number(company.priceMinor) * company.sharesOutstanding,
    0,
  );
  const index = world.indices[0];
  index.prevLevel = index.level;
  index.level = clamp(round(baseCap > 0 ? (1_000 * currentCap) / baseCap : 1_000), 100, 100_000);
  index.changePct = round(((index.level - index.prevLevel) / index.prevLevel) * 10_000) / 100;

  const rateDiff = (government.policyRateBp - 300) / BP;
  const riskOff = clamp(
    (government.gdpGrowthBp - 240) / -1_000 + (government.inflationBp - 250) / 2_000,
    -0.5,
    0.5,
  );
  for (let indexPosition = 0; indexPosition < world.fx.length; indexPosition += 1) {
    const quote = world.fx[indexPosition];
    quote.prevPrice = quote.price;
    let move = gauss() * 0.004 * diffusion;
    if (quote.pair === "USDX") move += (rateDiff * 0.12 - riskOff * 0.01) * months;
    else if (quote.pair === "EURUSD") move -= (rateDiff * 0.1 + riskOff * 0.008) * months;
    else if (quote.pair === "USDJPY") move += (rateDiff * 0.08 + riskOff * 0.02) * months;
    else if (quote.pair === "USDIDR")
      move += (riskOff * 0.03 + ((government.inflationBp - 250) / BP) * 0.2) * months;
    quote.price =
      round(quote.price * (1 + clamp(move, -0.15, 0.15)) * 10_000) / 10_000;
    quote.changePct = round(((quote.price - quote.prevPrice) / quote.prevPrice) * 10_000) / 100;
  }

  for (const bond of world.bonds) {
    const meta = BONDS.find((candidate) => candidate.key === bond.key);
    bond.prevYieldBp = bond.yieldBp;
    const inflationExpectation =
      government.inflationBp * 0.35 + (government.gdpGrowthBp - 240) * 0.2;
    const target =
      government.policyRateBp +
      (meta?.spreadBp ?? 100) +
      (bond.maturityYears - 2) * 12 +
      inflationExpectation * 0.25;
    bond.yieldBp = clamp(
      round(bond.yieldBp + (target - bond.yieldBp) * 0.2 * Math.min(months, 1)),
      50,
      3_000,
    );
    bond.price =
      round((100 + ((bond.couponBp - bond.yieldBp) * bond.maturityYears) / 100) * 100) / 100;
  }

  /* ---- 7. Media: coverage changes sentiment and policy -------------- */
  generateNews(world, rnd, gauss);

  /* ---- 8. Clock ----------------------------------------------------- */
  world.step += 1;
  world.calendarMonths += months;
  const date = gameDateFor(world.startYear, world.startMonth, Math.floor(world.calendarMonths));
  world.year = date.year;
  world.month = date.month;
  world.monthLabel = date.label;

  const macro = snapshotMacro(world);
  world.macro.push(macro);
  if (world.macro.length > 240) world.macro.shift();
  government.history.push(macro);
  if (government.history.length > 240) government.history.shift();

  // Every story is only relevant while fresh; keep a reading window.
  if (world.news.length > 40) world.news.length = 40;
}

/* -------------------------------------------------------------------- */
/* Media                                                                */
/* -------------------------------------------------------------------- */

const HEADLINES: Record<NewsKind, string[]> = {
  RALLY: [
    "Saham {name} melonjak {pct}% dalam sepekan",
    "Arus beli deras angkat {name} ke rekor baru",
    "{name} jadi favorit analis setelah reli {pct}%",
  ],
  SELLOFF: [
    "Tekanan jual seret {name} turun {pct}%",
    "{name} kehilangan pamor, investor pindah ke aset aman",
    "Aksi ambil untung bikin {name} terkoreksi {pct}%",
  ],
  SCANDAL: [
    "Skandal internal mengguncang manajemen {name}",
    "Auditor temukan kejanggalan laporan keuangan {name}",
    "Regulator membuka penyelidikan terhadap {name}",
  ],
  LAYOFF: [
    "{name} PHK ribuan karyawan saat kas menipis",
    "Krisis likuiditas paksa {name} memangkas operasi",
    "Serikat pekerja menuntut pemerintah selamatkan {name}",
  ],
  EARNINGS: [
    "Laba {name} melampaui perkiraan pasar",
    "Margin {name} membaik meski biaya energi naik",
    "{name} pertahankan pertumbuhan pendapatan dua digit",
  ],
  POLICY: [
    "Bank sentral ubah arah suku bunga, pasar obligasi bergerak",
    "Pemerintah umumkan paket stimulus baru",
    "Tarif impor baru mulai berlaku bulan ini",
  ],
  GOVERNANCE: [
    "RUPS {name} ambil keputusan strategis",
    "Pemegang saham mayoritas ubah arah {name}",
    "Keputusan dewan {name} disorot pasar",
  ],
  SUPPLY: [
    "Pasokan {name} terganggu, harga {pct}% lebih tinggi",
    "Permintaan {name} melonjak melebihi kapasitas pemasok",
    "Stok {name} menipis di gudang utama",
  ],
};

interface NewsCandidate {
  subject: NewsSubject;
  subjectSymbol: string | null;
  kind: NewsKind;
  tone: NewsTone;
  score: number;
  name: string;
  sectorLabel: string;
  pct: number;
}

function generateNews(
  world: World,
  rnd: () => number,
  gauss: () => number,
): void {
  const candidates: NewsCandidate[] = [];
  const government = world.government;

  world.companies.forEach((company) => {
    const sectorLabel = SECTOR_BY_KEY[company.sector]?.name ?? company.sector;
    let kind: NewsKind = "EARNINGS";
    if (company.changeBp >= 260) kind = "RALLY";
    else if (company.changeBp <= -260) kind = "SELLOFF";
    if (company.scandalRiskBp > 55) kind = "SCANDAL";
    else if (company.status === "DISTRESSED") kind = "LAYOFF";
    if (company.changeBp > 0 && company.status === "DISTRESSED") kind = "LAYOFF";

    const tone: NewsTone =
      kind === "RALLY" || kind === "EARNINGS"
        ? "POSITIVE"
        : kind === "SCANDAL" || kind === "SELLOFF" || kind === "LAYOFF"
          ? "NEGATIVE"
          : "NEUTRAL";
    const score =
      Math.abs(company.changeBp) * 1.3 +
      company.scandalRiskBp * 3 +
      (company.status === "DISTRESSED" ? 300 : 0) +
      (company.sentimentBp !== 0 ? 60 : 0) +
      rnd() * 200;

    candidates.push({
      subject: "COMPANY",
      subjectSymbol: company.symbol,
      kind,
      tone,
      score,
      name: company.name,
      sectorLabel,
      pct: Math.abs(round(company.changeBp / 100)),
    });
  });

  world.resources.forEach((resource) => {
    const kind: NewsKind = "SUPPLY";
    const tone: NewsTone = resource.changeBp > 0 ? "NEGATIVE" : "POSITIVE";
    if (Math.abs(resource.changeBp) < 80) return;
    candidates.push({
      subject: "COMMODITY",
      subjectSymbol: resource.key,
      kind,
      tone,
      score: Math.abs(resource.changeBp) * 1.2 + rnd() * 100,
      name: resource.name,
      sectorLabel: resource.unit,
      pct: Math.max(1, Math.abs(round(resource.changeBp / 100))),
    });
  });

  const policyScore =
    120 +
    Math.abs(government.policyRateBp - 350) * 0.6 +
    Math.abs(government.approvalPct - 50) * 4 +
    gauss() * 30;
  candidates.push({
    subject: "GOVERNMENT",
    subjectSymbol: null,
    kind: "POLICY",
    tone:
      government.approvalPct >= 50
        ? "POSITIVE"
        : government.approvalPct >= 35
          ? "NEUTRAL"
          : "NEGATIVE",
    score: policyScore,
    name: government.partyLabel,
    sectorLabel: government.leader,
    pct: Math.abs(round((government.policyRateBp - 300) / 100)),
  });

  const storyCount = clamp(1 + Math.round(rnd() * 2), 1, 3);
  candidates.sort((a, b) => b.score - a.score);

  const fresh: NewsStory[] = [];
  const used = new Set<string>();
  const keyOf = (candidate: NewsCandidate) =>
    `${candidate.subject}:${candidate.subjectSymbol ?? candidate.name}`;

  const emit = (candidate: NewsCandidate) => {
    used.add(keyOf(candidate));
    const order = fresh.length;
    const outlet = OUTLETS[Math.floor(rnd() * OUTLETS.length)];
    const templates = HEADLINES[candidate.kind];
    const template = templates[Math.floor(rnd() * templates.length)];
    const headline = template
      .replaceAll("{name}", candidate.name)
      .replaceAll("{pct}", String(candidate.pct));

    const sign =
      candidate.tone === "POSITIVE" ? 1 : candidate.tone === "NEGATIVE" ? -1 : 0;
    const reach = outlet.reachPct / 100;
    const impactBp = round(
      sign *
        (45 * reach * (0.6 + rnd() * 0.8) *
          (0.7 + outlet.credibilityPct / 100)),
    );

    fresh.push({
      id: `n-${world.step}-${candidate.subjectSymbol ?? "macro"}-${candidate.kind}-${order}`,
      step: world.step,
      outlet: outlet.name,
      outletBias: outlet.bias,
      credibilityPct: outlet.credibilityPct,
      headline,
      body: buildBody(candidate, outlet.name, outlet.bias, world),
      subject: candidate.subject,
      subjectSymbol: candidate.subjectSymbol,
      kind: candidate.kind,
      tone: candidate.tone,
      impactBp,
    });

    applyStoryImpact(world, candidate, impactBp);
  };

  for (const candidate of candidates) {
    if (fresh.length >= storyCount) break;
    if (used.has(keyOf(candidate))) continue;
    // Rotate subjects so the feed is not a wall of commodity notes.
    if (fresh.length > 0 && fresh[fresh.length - 1].subject === candidate.subject) {
      const alternate = candidates.find(
        (other) => other.subject !== candidate.subject && !used.has(keyOf(other)),
      );
      if (alternate) {
        emit(alternate);
        continue;
      }
    }
    emit(candidate);
  }

  world.news = fresh.concat(world.news);
}

function buildBody(
  candidate: NewsCandidate,
  outlet: string,
  bias: string,
  world: World,
): string {
  const government = world.government;
  const context =
    bias === "LABOUR" || bias === "POPULIST"
      ? `Pengangguran ${(government.unemploymentBp / 100).toFixed(1)}% dan inflasi ${(
          government.inflationBp / 100
        ).toFixed(1)}% jadi sorotan.`
      : bias === "BUSINESS"
        ? `Suku bunga acuan ${(government.policyRateBp / 100).toFixed(2)}% menentukan biaya modal.`
        : `Indeks pasar berada di ${world.indices[0]?.level ?? 1_000} dengan pertumbuhan ${(
            government.gdpGrowthBp / 100
          ).toFixed(2)}%.`;
  const subject =
    candidate.subject === "COMPANY"
      ? `Perusahaan ${candidate.sectorLabel.toLowerCase()} ini`
      : candidate.subject === "COMMODITY"
        ? `Komoditas (${candidate.sectorLabel})`
        : "Pemerintah";
  return `${subject} menjadi bahan pemberitaan ${outlet}. ${context}`;
}

function applyStoryImpact(
  world: World,
  candidate: NewsCandidate,
  impactBp: number,
): void {
  const government = world.government;
  if (candidate.subject === "COMPANY" && candidate.subjectSymbol) {
    const company = world.companies.find((entry) => entry.symbol === candidate.subjectSymbol);
    if (!company) return;
    company.sentimentBp = clamp(company.sentimentBp + impactBp, -500, 500);
    company.lastEvent = candidate.kind;
    if (candidate.kind === "SCANDAL") {
      government.regulationBp[company.sector] = clamp(
        government.regulationBp[company.sector] + Math.abs(impactBp) / 2,
        0,
        900,
      );
      government.approvalPct = clamp(government.approvalPct - 1, 5, 95);
      company.scandalRiskBp = clamp(company.scandalRiskBp - 18, 0, 100);
    }
    if (candidate.kind === "LAYOFF") {
      government.approvalPct = clamp(government.approvalPct - 2, 5, 95);
      government.unemploymentBp = clamp(government.unemploymentBp + 3, 150, 2_000);
      government.regulationBp[company.sector] = clamp(
        government.regulationBp[company.sector] + 12,
        0,
        900,
      );
    }
    if (candidate.tone === "POSITIVE" && company.status === "HEALTHY") {
      company.brandBp = clamp(company.brandBp + 1, 5, 95);
    }
    return;
  }

  if (candidate.subject === "COMMODITY" && candidate.subjectSymbol) {
    const resource = world.resources.find((entry) => entry.key === candidate.subjectSymbol);
    if (!resource) return;
    resource.priceMinor = BigInt(
      Math.max(1, Number(scaleMoney(resource.priceMinor, impactBp / 12))),
    );
    return;
  }

  government.approvalPct = clamp(round(government.approvalPct + impactBp / 60), 5, 95);
  if (candidate.tone === "NEGATIVE") {
    government.regulationBp.TECH = clamp(government.regulationBp.TECH + 8, 0, 900);
  }
}

/** Used by tests and the UI to describe a company without recomputing. */
export function companySummary(company: CompanyState): {
  symbol: string;
  name: string;
  roeBp: number;
  netMarginBp: number;
} {
  const equity = company.fundamentalMinor * BigInt(company.sharesOutstanding);
  const earningsAnnual = company.earningsMinor * 12n;
  return {
    symbol: company.symbol,
    name: company.name,
    roeBp: equity > 0n ? Number((earningsAnnual * BP_BIG) / equity) : 0,
    netMarginBp: company.revenueMinor > 0n
      ? Number((company.earningsMinor * BP_BIG) / company.revenueMinor)
      : 0,
  };
}
