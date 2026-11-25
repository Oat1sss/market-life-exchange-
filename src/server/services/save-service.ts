/**
 * Save slots: one account can keep up to MAX_SAVE_SLOTS lives. Exactly one of
 * them is ACTIVE at a time; the rest are PAUSED and can be resumed later.
 */
import { prisma } from "@/server/db";
import { MAX_SAVE_SLOTS } from "@/domain/saves";
import { BACKGROUNDS, type BackgroundKey } from "@/domain/character";

export interface SaveSlotView {
  id: string;
  firstName: string;
  lastName: string;
  backgroundLabel: string;
  tick: number;
  status: "ACTIVE" | "PAUSED";
  cashMinor: bigint;
  netWorthMinor: bigint;
  holdingsCount: number;
  updatedAt: Date;
}

export class SaveError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SaveError";
  }
}

export async function listSaveSlots(userId: string): Promise<SaveSlotView[]> {
  const games = await prisma.game.findMany({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      character: true,
      portfolio: { include: { holdings: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const priceSets = await Promise.all(
    games.map((game) =>
      prisma.pricePoint.findMany({
        where: { gameId: game.id, tick: game.tick },
        select: { assetId: true, priceMinor: true },
      }),
    ),
  );

  return games.map((game, index) => {
    const prices = new Map(
      priceSets[index]!.map((point) => [point.assetId, point.priceMinor]),
    );
    const holdings = game.portfolio?.holdings ?? [];
    const marketValue = holdings.reduce((total, holding) => {
      const price = prices.get(holding.assetId) ?? holding.averageCostMinor;
      return total + BigInt(holding.quantity) * price;
    }, 0n);
    const cashMinor = game.portfolio?.cashMinor ?? 0n;
    const background = (game.character?.background ?? "SCHOLAR") as BackgroundKey;

    return {
      id: game.id,
      firstName: game.character?.firstName ?? "Tanpa",
      lastName: game.character?.lastName ?? "nama",
      backgroundLabel: BACKGROUNDS[background]?.label ?? background,
      tick: game.tick,
      status: game.status as "ACTIVE" | "PAUSED",
      cashMinor,
      netWorthMinor: cashMinor + marketValue,
      holdingsCount: holdings.filter((holding) => holding.quantity > 0).length,
      updatedAt: game.updatedAt,
    };
  });
}

export async function activateSaveSlot(userId: string, gameId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findFirst({
      where: { id: gameId, userId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true },
    });
    if (!game) throw new SaveError("NOT_FOUND", "Slot simpan tidak ditemukan.");

    await tx.game.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });
    await tx.game.update({ where: { id: game.id }, data: { status: "ACTIVE" } });
  });
}

export async function deleteSaveSlot(userId: string, gameId: string): Promise<void> {
  const game = await prisma.game.findFirst({
    where: { id: gameId, userId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true },
  });
  if (!game) throw new SaveError("NOT_FOUND", "Slot simpan tidak ditemukan.");
  await prisma.game.delete({ where: { id: game.id } });
}

export async function countSaveSlots(userId: string): Promise<number> {
  return prisma.game.count({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
  });
}

export { MAX_SAVE_SLOTS };
