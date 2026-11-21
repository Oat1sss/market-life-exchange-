import "dotenv/config";
import { prisma } from "../src/server/db";

async function main() {
  const games = await prisma.game.findMany({ where: { status: "ACTIVE" } });
  const assets = await prisma.asset.findMany();
  console.log(`Checking ${games.length} active games for ${assets.length} assets...`);

  for (const game of games) {
    const existing = await prisma.pricePoint.findMany({
      where: { gameId: game.id, tick: game.tick },
      select: { assetId: true },
    });
    const existingIds = new Set(existing.map((p) => p.assetId));
    const missing = assets.filter((a) => !existingIds.has(a.id));

    if (missing.length > 0) {
      console.log(`Game ${game.id} at tick ${game.tick} missing ${missing.length} assets. Adding...`);
      // Also add at tick 0 if tick > 0
      for (let t = 0; t <= game.tick; t++) {
        const atTick = await prisma.pricePoint.findMany({
          where: { gameId: game.id, tick: t },
          select: { assetId: true },
        });
        const atTickIds = new Set(atTick.map((p) => p.assetId));
        const missingAtTick = assets.filter((a) => !atTickIds.has(a.id));
        if (missingAtTick.length > 0) {
          await prisma.pricePoint.createMany({
            data: missingAtTick.map((a) => ({
              gameId: game.id,
              assetId: a.id,
              tick: t,
              priceMinor: a.fundamentalMinor,
              sentimentBp: 0,
              fundamentalMinor: a.fundamentalMinor,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
  }
  console.log("Done syncing price points.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
