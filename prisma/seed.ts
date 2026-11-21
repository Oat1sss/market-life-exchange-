/**
 * Seed server: assets, achievement definitions and default expense rules.
 * Run with `prisma db seed`. Idempotent: safe to run repeatedly.
 *
 * Prices are quoted in whole credits; `fundamentalMinor` stores minor units
 * (1 credit = 100 minor units), so a 45,000.00 CR coin is 4,500,000n.
 */
import "dotenv/config";
import type {
  ExpenseCadence,
  ExpenseCategory,
  Prisma,
} from "../src/generated/prisma/index";
import { prisma } from "../src/server/db";

/** [symbol, name, fundamentalMinor, volatilityBp, betaBp] */
type CryptoSeed = readonly [string, string, bigint, number, number];

const CRYPTO_SEEDS: readonly CryptoSeed[] = [
  ["BTC", "Bitcoin", 4_500_000n, 1900, 2100],
  ["ETH", "Ethereum", 250_000n, 2200, 2400],
  ["SOL", "Solana", 12_000n, 2900, 3000],
  ["BNB", "BNB", 40_000n, 2000, 2200],
  ["XRP", "XRP", 55n, 2600, 2700],
  ["ADA", "Cardano", 45n, 2500, 2600],
  ["DOGE", "Dogecoin", 12n, 3400, 3500],
  ["AVAX", "Avalanche", 3_500n, 2800, 2900],
  ["DOT", "Polkadot", 700n, 2500, 2600],
  ["LINK", "Chainlink", 1_800n, 2400, 2500],
  ["MATIC", "Polygon", 90n, 2600, 2700],
  ["LTC", "Litecoin", 8_500n, 1800, 1900],
  ["TRX", "TRON", 13n, 2000, 2100],
  ["ATOM", "Cosmos", 950n, 2300, 2400],
  ["UNI", "Uniswap", 1_100n, 2500, 2600],
  ["ETC", "Ethereum Classic", 2_600n, 2100, 2200],
  ["XLM", "Stellar", 12n, 2200, 2300],
  ["NEAR", "NEAR Protocol", 600n, 2700, 2800],
  ["APT", "Aptos", 900n, 2800, 2900],
  ["ARB", "Arbitrum", 110n, 2700, 2800],
  ["OP", "Optimism", 180n, 2700, 2800],
  ["SUI", "Sui", 350n, 3000, 3100],
  ["TIA", "Celestia", 800n, 3100, 3200],
  ["INJ", "Injective", 2_400n, 3000, 3100],
  ["SEI", "Sei", 45n, 2900, 3000],
  ["FIL", "Filecoin", 550n, 2400, 2500],
  ["HBAR", "Hedera", 9n, 2100, 2200],
  ["ICP", "Internet Computer", 1_200n, 2600, 2700],
  ["RNDR", "Render", 700n, 3000, 3100],
  ["IMX", "Immutable", 150n, 2800, 2900],
  ["AAVE", "Aave", 8_900n, 2400, 2500],
  ["MKR", "Maker", 250_000n, 2400, 2500],
  ["GRT", "The Graph", 20n, 2700, 2800],
  ["SAND", "The Sandbox", 45n, 2900, 3000],
  ["MANA", "Decentraland", 40n, 2900, 3000],
  ["CRV", "Curve DAO", 35n, 2800, 2900],
  ["LDO", "Lido DAO", 200n, 2900, 3000],
  ["SNX", "Synthetix", 250n, 2800, 2900],
  ["COMP", "Compound", 5_500n, 2400, 2500],
  ["ZEC", "Zcash", 3_200n, 2200, 2300],
  ["DASH", "Dash", 2_800n, 2200, 2300],
  ["EOS", "EOS", 80n, 2300, 2400],
  ["XTZ", "Tezos", 90n, 2300, 2400],
  ["THETA", "Theta Network", 130n, 2700, 2800],
  ["CHZ", "Chiliz", 11n, 3000, 3100],
  ["ENJ", "Enjin Coin", 30n, 2900, 3000],
  ["BAT", "Basic Attention", 25n, 2600, 2700],
  ["KSM", "Kusama", 2_300n, 2700, 2800],
  ["WAVES", "Waves", 200n, 2700, 2800],
  ["ZIL", "Zilliqa", 3n, 3000, 3100],
  ["ONE", "Harmony", 2n, 3100, 3200],
  ["CBLK", "Cloudblock", 5_000n, 2400, 2600],
];

/** [symbol, name, sector, fundamentalMinor, volatilityBp, betaBp] */
type StockSeed = readonly [
  string,
  string,
  "TECH" | "HEALTH" | "ENERGY" | "CONSUMER",
  bigint,
  number,
  number,
];

const STOCK_SEEDS: readonly StockSeed[] = [
  ["NOVA", "Nova Dynamics", "TECH", 120_000n, 700, 1300],
  ["QNTM", "Quantumleap Systems", "TECH", 420_000n, 850, 1500],
  ["ORBT", "Orbital Cloud", "TECH", 240_000n, 800, 1400],
  ["CYBR", "Cybershield Labs", "TECH", 185_000n, 750, 1250],
  ["AIVS", "Aiventra AI", "TECH", 650_000n, 950, 1600],
  ["MTRX", "Matrix Robotics", "TECH", 310_000n, 820, 1450],
  ["PIXL", "Pixelworks Studio", "TECH", 72_000n, 700, 1200],
  ["NTWR", "Netwire Telecom", "TECH", 98_000n, 520, 900],
  ["BYTE", "Bytecraft Semiconductor", "TECH", 540_000n, 880, 1550],
  ["DRNE", "Dronex Logistics", "TECH", 115_000n, 780, 1300],
  ["GRID", "Gridline Data", "TECH", 205_000n, 760, 1250],
  ["SIGM", "Sigma Analytics", "TECH", 142_000n, 700, 1150],
  ["VRTA", "Verta Cloud", "TECH", 360_000n, 860, 1500],
  ["HLIX", "Helix Bio", "HEALTH", 80_000n, 550, 1000],
  ["HELX", "Helix Pharmaceuticals", "HEALTH", 220_000n, 520, 900],
  ["GENM", "Genomiq Labs", "HEALTH", 340_000n, 650, 1050],
  ["CARD", "Cardiocare Devices", "HEALTH", 130_000n, 500, 850],
  ["ONCO", "Oncoline Therapeutics", "HEALTH", 480_000n, 780, 1150],
  ["MEDX", "Medix Diagnostics", "HEALTH", 90_000n, 480, 800],
  ["BIOV", "Biovista Health", "HEALTH", 175_000n, 600, 1000],
  ["DENT", "Dentara Clinics", "HEALTH", 64_000n, 430, 750],
  ["NEUR", "Neurocore Health", "HEALTH", 290_000n, 700, 1100],
  ["VACC", "Vaccina Health", "HEALTH", 105_000n, 560, 950],
  ["PULM", "PulmoTech", "HEALTH", 82_000n, 520, 880],
  ["TERA", "Terranova Energy", "ENERGY", 60_000n, 480, 900],
  ["SOLR", "Solaris Grid", "ENERGY", 160_000n, 600, 1000],
  ["WIND", "Windward Power", "ENERGY", 78_000n, 520, 900],
  ["HYDR", "Hydroline Energy", "ENERGY", 45_000n, 400, 750],
  ["NUKE", "Nucleon Energy", "ENERGY", 230_000n, 620, 950],
  ["OILX", "Oilflex Energy", "ENERGY", 190_000n, 560, 880],
  ["GASL", "Gaslink Utilities", "ENERGY", 61_000n, 380, 700],
  ["GREN", "Greenfield Energy", "ENERGY", 34_000n, 450, 800],
  ["URAN", "Uranium Ridge", "ENERGY", 125_000n, 720, 1050],
  ["BATT", "Voltcell Batteries", "ENERGY", 170_000n, 680, 1100],
  ["FUSN", "Fusiona Energy", "ENERGY", 380_000n, 900, 1300],
  ["GRAN", "Granary Foods", "CONSUMER", 30_000n, 240, 550],
  ["MRKT", "Marketly", "CONSUMER", 54_000n, 380, 700],
  ["FOOD", "Foodwell Group", "CONSUMER", 69_000n, 300, 600],
  ["BREW", "Brewline Beverages", "CONSUMER", 118_000n, 320, 650],
  ["HOME", "Homebase Retail", "CONSUMER", 46_000n, 350, 680],
  ["LUXE", "Luxora Apparel", "CONSUMER", 210_000n, 450, 800],
  ["TOYS", "Playforge Toys", "CONSUMER", 38_000n, 400, 750],
  ["FARM", "Farmwell Produce", "CONSUMER", 29_000n, 280, 550],
  ["SNAK", "Snackyard Foods", "CONSUMER", 35_000n, 300, 580],
  ["CAFE", "Cafena Coffee", "CONSUMER", 95_000n, 360, 650],
  ["PETC", "Petcare Universe", "CONSUMER", 72_000n, 380, 700],
  ["TRAV", "Travelio Group", "CONSUMER", 135_000n, 520, 900],
  ["FITX", "Fitrix Gyms", "CONSUMER", 48_000n, 420, 780],
  ["STYL", "Stylehouse Retail", "CONSUMER", 102_000n, 400, 720],
  ["CINE", "Cineverse Media", "CONSUMER", 61_000n, 480, 850],
  ["GAME", "Playgrid Games", "CONSUMER", 148_000n, 600, 1000],
  ["EDU", "Edunova Learning", "CONSUMER", 83_000n, 440, 780],
];

const ASSETS: Prisma.AssetCreateInput[] = [
  ...CRYPTO_SEEDS.map(
    ([symbol, name, fundamentalMinor, volatilityBp, betaBp]) => ({
      symbol,
      name,
      sector: "CRYPTO" as const,
      kind: "CRYPTO" as const,
      fundamentalMinor,
      volatilityBp,
      betaBp,
    }),
  ),
  ...STOCK_SEEDS.map(
    ([symbol, name, sector, fundamentalMinor, volatilityBp, betaBp]) => ({
      symbol,
      name,
      sector,
      kind: "STOCK" as const,
      fundamentalMinor,
      volatilityBp,
      betaBp,
    }),
  ),
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
    description: "Reach a portfolio value of 10,000 credits.",
    hidden: false,
  },
  {
    key: "NET_WORTH_100K",
    name: "Six Figures",
    description: "Reach a portfolio value of 100,000 credits.",
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
  const cryptoCount = ASSETS.filter((asset) => asset.kind === "CRYPTO").length;
  console.log(
    `Assets seeded: ${ASSETS.length} (${cryptoCount} crypto, ${ASSETS.length - cryptoCount} stocks)`,
  );

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
