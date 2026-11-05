/**
 * Seed server: assets, achievement definitions and default expense rules.
 * Run with `prisma db seed`. Idempotent: safe to run repeatedly.
 */
import "dotenv/config";
import type {
  ExpenseCadence,
  ExpenseCategory,
  Prisma,
} from "../src/generated/prisma/index";
import { prisma } from "../src/server/db";

const ASSETS: Prisma.AssetCreateInput[] = [
  {
    symbol: "NOVA",
    name: "Nova Dynamics",
    sector: "TECH",
    kind: "STOCK",
    // 1,200.00 credits fundamental -> 120000 minor units
    fundamentalMinor: 120000n,
    volatilityBp: 700,
    betaBp: 1300,
  },
  {
    symbol: "HLIX",
    name: "Helix Bio",
    sector: "HEALTH",
    kind: "STOCK",
    fundamentalMinor: 80000n,
    volatilityBp: 550,
    betaBp: 1000,
  },
  {
    symbol: "TERA",
    name: "Terranova Energy",
    sector: "ENERGY",
    kind: "STOCK",
    fundamentalMinor: 60000n,
    volatilityBp: 480,
    betaBp: 900,
  },
  {
    symbol: "GRAN",
    name: "Granary Foods",
    sector: "CONSUMER",
    kind: "STOCK",
    fundamentalMinor: 30000n,
    volatilityBp: 240,
    betaBp: 550,
  },
  {
    symbol: "CBLK",
    name: "Cloudblock",
    sector: "CRYPTO",
    kind: "CRYPTO",
    fundamentalMinor: 5000n,
    volatilityBp: 2400,
    betaBp: 2600,
  },
];

const ACHIEVEMENTS = [
  {
    key: "FIRST_TRADE",
    name: "First Trade",
    description: "Complete your first buy or sell order.",
    hidden: false,
  },
  {
    key: "FIRST_PROFIT",
    name: "In the Black",
    description: "Realize a profit on a sell for the first time.",
    hidden: false,
  },
  {
    key: "NET_WORTH_10K",
    name: "Five Figures",
    description: "Reach a net worth of 10,000 credits.",
    hidden: false,
  },
  {
    key: "NET_WORTH_100K",
    name: "Six Figures",
    description: "Reach a net worth of 100,000 credits.",
    hidden: true,
  },
  {
    key: "DEGREE_EARNED",
    name: "Graduate",
    description: "Complete a degree program.",
    hidden: false,
  },
  {
    key: "SURVIVE_65",
    name: "Still Standing",
    description: "Reach age 65.",
    hidden: false,
  },
];

const DEFAULT_EXPENSES: Array<{
  label: string;
  category: ExpenseCategory;
  amountMinor: bigint;
  cadence: ExpenseCadence;
}> = [
  { label: "Rent", category: "RENT", amountMinor: 5000n, cadence: "MONTHLY" },
  { label: "Food", category: "FOOD", amountMinor: 1500n, cadence: "MONTHLY" },
  { label: "Transport", category: "TRANSPORT", amountMinor: 600n, cadence: "MONTHLY" },
  { label: "Phone subscription", category: "SUBSCRIPTION", amountMinor: 250n, cadence: "MONTHLY" },
];

async function main() {
  for (const asset of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: {},
      create: asset,
    });
  }
  console.log(`Assets seeded: ${ASSETS.map((a) => a.symbol).join(", ")}`);

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: achievement,
    });
  }
  console.log(`Achievements seeded: ${ACHIEVEMENTS.length}`);

  // Expense defaults are per-game (snapshotted at creation), so nothing to seed
  // into a shared table; DEFAULT_EXPENSES is consumed by the game-creation
  // service in Task 4 and kept here as the single source of truth.
}

main()
  .then(() => void prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

export { ASSETS, ACHIEVEMENTS, DEFAULT_EXPENSES };
