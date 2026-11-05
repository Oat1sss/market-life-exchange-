/**
 * Smoke test for Task 2 (schema + migration + seed). Not run in CI:
 * it only exists to verify a real database is wired up correctly.

 * Run with `npx tsx scripts/smoke-db.ts`.
 */
import 'dotenv/config';
import { prisma } from '../src/server/db';

async function main(): Promise<void> {
  const assets = await prisma.asset.findMany({
    orderBy: { symbol: 'asc' },
    select: { symbol: true, kind: true, fundamentalMinor: true, volatilityBp: true, betaBp: true },
  });
  console.log(`Assets: ${assets.length}`);
  for (const asset of assets) {
    console.log(`  ${asset.symbol} ${asset.kind} fundamental=${asset.fundamentalMinor} vol=${asset.volatilityBp}bp beta=${asset.betaBp}bp`);
  }

  const achievements = await prisma.achievement.count();
  console.log(`Achievements: ${achievements}`);

  const [checks] = (await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname IN ('characters', 'portfolios', 'holdings', 'orders', 'ledger_entries')
      AND c.contype = 'c'
  `) as [{ count: bigint }];
  console.log(`CHECK constraints: ${checks.count}`);

  const [partial] = (await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_indexes
    WHERE indexname = 'games_one_active_per_user'
  `) as [{ count: bigint }];
  if (partial.count !== 1n) {
    throw new Error('Partial unique index games_one_active_per_user missing');
  }
  console.log('Partial unique index: present');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
