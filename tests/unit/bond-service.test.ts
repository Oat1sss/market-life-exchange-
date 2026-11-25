import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import { advanceGame, createGame } from "@/server/services/game-service";
import {
  BOND_FACE_MINOR,
  bondFeeMinor,
  couponPerBondMinor,
} from "@/domain/bonds";
import {
  BondError,
  bondSnapshot,
  buyBonds,
  sellBonds,
} from "@/server/services/bond-service";

const TEST_DOMAIN = "bond-test.internal";
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

async function createTestUser(): Promise<string> {
  const email = `bond-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const result = await registerUser({ email, password: "bondPassword123!" });
  if (!result.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  return user.id;
}

async function cashLedgerTotal(gameId: string): Promise<bigint> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { gameId, account: "CASH" },
  });
  return rows.reduce(
    (total, row) =>
      row.direction === "CREDIT" ? total + row.amountMinor : total - row.amountMinor,
    0n,
  );
}

describe("bond service", () => {
  it("buys a line at the macro price, charges the fee and replays idempotently", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Bima",
      lastName: "Bonds",
      background: "SCHOLAR",
    });

    const before = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    const snapshot = await bondSnapshot(userId);
    const line = snapshot?.instruments.find((entry) => entry.key === "GB10");
    expect(line).toBeDefined();
    expect(line!.priceMinor).toBeGreaterThan(0n);

    const gross = line!.priceMinor * 10n;
    const fee = bondFeeMinor(gross);
    const key = crypto.randomUUID();
    const bought = await buyBonds(userId, { bondKey: "GB10", quantity: 10, idempotencyKey: key });

    expect(bought.replayed).toBe(false);
    expect(bought.grossMinor).toBe(gross);
    expect(bought.feeMinor).toBe(fee);

    const after = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    expect(after.cashMinor).toBe(before.cashMinor - gross - fee);

    const holding = await prisma.bondHolding.findUniqueOrThrow({
      where: { gameId_bondKey: { gameId, bondKey: "GB10" } },
    });
    expect(holding.quantity).toBe(10);
    expect(holding.costMinor).toBe(gross);

    // Same idempotency key must not buy twice.
    const replay = await buyBonds(userId, { bondKey: "GB10", quantity: 10, idempotencyKey: key });
    expect(replay.replayed).toBe(true);
    const holdingAfterReplay = await prisma.bondHolding.findUniqueOrThrow({
      where: { gameId_bondKey: { gameId, bondKey: "GB10" } },
    });
    expect(holdingAfterReplay.quantity).toBe(10);

    expect(await cashLedgerTotal(gameId)).toBe(after.cashMinor);
  });

  it("sells part of a position, reduces the cost basis and rejects an oversell", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Sari",
      lastName: "Seller",
      background: "HUSTLER",
    });

    const snapshot = await bondSnapshot(userId);
    const line = snapshot!.instruments.find((entry) => entry.key === "CAAA")!;
    await buyBonds(userId, {
      bondKey: "CAAA",
      quantity: 10,
      idempotencyKey: crypto.randomUUID(),
    });

    const afterBuy = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    const gross = line.priceMinor * 4n;
    const fee = bondFeeMinor(gross);
    const sold = await sellBonds(userId, {
      bondKey: "CAAA",
      quantity: 4,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(sold.netMinor).toBe(gross - fee);

    const afterSell = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    expect(afterSell.cashMinor).toBe(afterBuy.cashMinor + gross - fee);

    const holding = await prisma.bondHolding.findUniqueOrThrow({
      where: { gameId_bondKey: { gameId, bondKey: "CAAA" } },
    });
    expect(holding.quantity).toBe(6);
    expect(holding.costMinor).toBe(line.priceMinor * 6n);

    await expect(
      sellBonds(userId, {
        bondKey: "CAAA",
        quantity: 7,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "OVERSELL" });

    expect(await cashLedgerTotal(gameId)).toBe(afterSell.cashMinor);
  });

  it("pays a monthly coupon and redeems principal at maturity", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Tono",
      lastName: "Tenor",
      background: "CREATIVE",
    });

    // Park the game one month before the 2-year government bond matures.
    await prisma.game.update({ where: { id: gameId }, data: { tick: 23 } });
    await buyBonds(userId, {
      bondKey: "GB2",
      quantity: 5,
      idempotencyKey: crypto.randomUUID(),
    });

    const beforeAdvance = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    await advanceGame(userId);
    const afterAdvance = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });

    const coupon = couponPerBondMinor(520) * 5n;
    const principal = BOND_FACE_MINOR * 5n;
    expect(afterAdvance.cashMinor).toBe(beforeAdvance.cashMinor + coupon + principal);

    const couponRows = await prisma.ledgerEntry.findMany({
      where: { gameId, reason: "BOND_COUPON" },
    });
    expect(couponRows).toHaveLength(1);
    expect(couponRows[0]!.amountMinor).toBe(coupon);

    const maturityRows = await prisma.ledgerEntry.findMany({
      where: { gameId, reason: "BOND_MATURITY" },
    });
    expect(maturityRows).toHaveLength(2);
    expect(
      maturityRows
        .filter((row) => row.account === "CASH")
        .reduce((total, row) => total + row.amountMinor, 0n),
    ).toBe(principal);

    expect(await prisma.bondHolding.count({ where: { gameId } })).toBe(0);
    expect(await cashLedgerTotal(gameId)).toBe(afterAdvance.cashMinor);
  });

  it("rejects a purchase that the cash balance cannot cover", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Kiki",
      lastName: "Tipis",
      background: "SCHOLAR",
    });
    await prisma.portfolio.update({ where: { gameId }, data: { cashMinor: 500n } });

    await expect(
      buyBonds(userId, {
        bondKey: "GB10",
        quantity: 10,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toBeInstanceOf(BondError);
  });
});
