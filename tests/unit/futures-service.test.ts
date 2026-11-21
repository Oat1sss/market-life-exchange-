import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import { advanceGame, createGame } from "@/server/services/game-service";
import { closeFutures, openFutures } from "@/server/services/futures-service";
import { feeSell } from "@/server/services/trade-fill";

const TEST_DOMAIN = "futures-test.internal";
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

async function createTestUser(): Promise<string> {
  const email = `futures-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const result = await registerUser({ email, password: "futuresPassword123!" });
  if (!result.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  return user.id;
}

describe("futures service", () => {
  it("opens, replays and closes a position without leaking cash", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Fiona",
      lastName: "Futures",
      background: "SCHOLAR",
    });
    const portfolio = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    const asset = await prisma.asset.findUniqueOrThrow({ where: { symbol: "CBLK" } });
    const point = await prisma.pricePoint.findFirstOrThrow({
      where: { gameId, assetId: asset.id },
      orderBy: { tick: "desc" },
    });

    const input = {
      symbol: "CBLK",
      side: "LONG" as const,
      quantity: 10,
      leverage: 5,
      idempotencyKey: crypto.randomUUID(),
    };
    const opened = await openFutures(userId, input);
    expect(opened.replayed).toBe(false);

    const notional = point.priceMinor * 10n;
    const margin = (notional + 4n) / 5n;
    const openFee = feeSell(notional);
    const afterOpen = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    expect(afterOpen.cashMinor).toBe(portfolio.cashMinor - margin - openFee);

    // Retrying the same key must not open a second position.
    const replay = await openFutures(userId, input);
    expect(replay.replayed).toBe(true);
    expect(replay.positionId).toBe(opened.positionId);
    expect(await prisma.futuresPosition.count({ where: { gameId } })).toBe(1);

    const closed = await closeFutures(userId, opened.positionId);
    expect(closed.payoutMinor).toBeGreaterThan(0n);

    const afterClose = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    expect(afterClose.cashMinor).toBe(afterOpen.cashMinor + closed.payoutMinor);

    // Cash ledger rows still reconcile to the portfolio balance.
    const cashRows = await prisma.ledgerEntry.findMany({
      where: { gameId, account: "CASH" },
    });
    const ledgerCash = cashRows.reduce(
      (total, row) =>
        row.direction === "CREDIT" ? total + row.amountMinor : total - row.amountMinor,
      0n,
    );
    expect(ledgerCash).toBe(afterClose.cashMinor);

    const stored = await prisma.futuresPosition.findUniqueOrThrow({
      where: { id: opened.positionId },
    });
    expect(stored.status).toBe("CLOSED");
    expect(stored.realizedMinor).toBe(closed.payoutMinor - margin - openFee);
  });

  it("liquidates a position whose equity reaches zero and keeps the margin", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Lee",
      lastName: "Liquidated",
      background: "HUSTLER",
    });
    const position = await openFutures(userId, {
      symbol: "CBLK",
      side: "LONG",
      quantity: 10,
      leverage: 5,
      idempotencyKey: crypto.randomUUID(),
    });

    // Simulate a crash: entry far above any possible mark.
    await prisma.futuresPosition.update({
      where: { id: position.positionId },
      data: { entryPriceMinor: 10_000_000n },
    });

    await advanceGame(userId);

    const stored = await prisma.futuresPosition.findUniqueOrThrow({
      where: { id: position.positionId },
    });
    expect(stored.status).toBe("LIQUIDATED");
    expect(stored.closedTick).toBe(1);
    expect(stored.realizedMinor).toBeLessThan(0n);

    // Liquidation returns no cash, so no FUTURES_PNL credit is written.
    expect(
      await prisma.ledgerEntry.count({ where: { gameId, reason: "FUTURES_PNL" } }),
    ).toBe(0);
  });
});
