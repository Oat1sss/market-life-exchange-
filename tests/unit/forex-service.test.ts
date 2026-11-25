/**
 * Forex trading uses the same cash account and ledger as spot orders, so a
 * currency balance must show up in the snapshot and the cash ledger must match.
 */
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import { createGame } from "@/server/services/game-service";
import {
  forexSnapshot,
  tradeForex,
  ForexError,
} from "@/server/services/forex-service";

const TEST_DOMAIN = "forexservice-test.internal";
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

async function createTrader(): Promise<string> {
  const email = `fx-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const result = await registerUser({ email, password: "forexPassword123!" });
  if (!result.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  await createGame(user.id, {
    firstName: "George",
    lastName: "Soros",
    background: "SCHOLAR",
  });
  return user.id;
}

async function cashLedgerTotal(gameId: string): Promise<bigint> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { gameId, account: "CASH" },
  });
  return rows.reduce(
    (total, row) => (row.direction === "CREDIT" ? total + row.amountMinor : total - row.amountMinor),
    0n,
  );
}

describe("forex trading", () => {
  it("buys and sells a currency against the same cash balance", async () => {
    const userId = await createTrader();
    const before = await forexSnapshot(userId);
    expect(before).not.toBeNull();
    const initialCash = before!.cashMinor;

    const bought = await tradeForex(userId, {
      pair: "USD/IDR",
      side: "BUY",
      units: 100,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(bought.replayed).toBe(false);

    const afterBuy = await forexSnapshot(userId);
    const usd = afterBuy!.holdings.find((holding) => holding.currency === "USD");
    expect(usd).toBeDefined();
    expect(usd!.units).toBe(100n);
    expect(afterBuy!.cashMinor).toBeLessThan(initialCash);
    expect(usd!.averageRateMinor).toBeGreaterThan(0n);

    const game = await prisma.game.findFirstOrThrow({
      where: { userId, status: "ACTIVE" },
    });
    expect(afterBuy!.cashMinor).toBe(await cashLedgerTotal(game.id));

    await tradeForex(userId, {
      pair: "USD/IDR",
      side: "SELL",
      units: 40,
      idempotencyKey: crypto.randomUUID(),
    });
    const afterSell = await forexSnapshot(userId);
    const usdAfterSell = afterSell!.holdings.find((holding) => holding.currency === "USD");
    expect(usdAfterSell!.units).toBe(60n);
    expect(afterSell!.cashMinor).toBeGreaterThan(afterBuy!.cashMinor);
  });

  it("rejects selling more currency than owned", async () => {
    const userId = await createTrader();
    await expect(
      tradeForex(userId, {
        pair: "EUR/IDR",
        side: "SELL",
        units: 10,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ForexError);
  });

  it("replays a duplicate idempotency key instead of trading twice", async () => {
    const userId = await createTrader();
    const key = crypto.randomUUID();
    const first = await tradeForex(userId, {
      pair: "JPY/IDR",
      side: "BUY",
      units: 1_000,
      idempotencyKey: key,
    });
    const second = await tradeForex(userId, {
      pair: "JPY/IDR",
      side: "BUY",
      units: 1_000,
      idempotencyKey: key,
    });
    expect(second.replayed).toBe(true);
    expect(second.tradeId).toBe(first.tradeId);
    const snapshot = await forexSnapshot(userId);
    expect(snapshot!.holdings.find((row) => row.currency === "JPY")!.units).toBe(1_000n);
  });
});
