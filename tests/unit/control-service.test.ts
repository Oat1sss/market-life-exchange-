import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import { advanceGame, createGame } from "@/server/services/game-service";
import { economySnapshot, type DirectiveInput } from "@/domain/economy";
import {
  ControlError,
  issueDirective,
  loadDirectives,
} from "@/server/services/control-service";

const TEST_DOMAIN = "control-test.internal";
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

async function createTestUser(): Promise<string> {
  const email = `control-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const result = await registerUser({ email, password: "controlPassword123!" });
  if (!result.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  return user.id;
}

async function replay(gameId: string, directives: DirectiveInput[] = []) {
  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  const assets = await prisma.asset.findMany({
    where: { kind: "STOCK" },
    orderBy: { symbol: "asc" },
  });
  return economySnapshot({
    seed: game.seed,
    assets,
    pace: "MONTH",
    monthsElapsed: game.tick,
    startYear: game.startDate.getUTCFullYear(),
    startMonth: game.startDate.getUTCMonth() + 1,
    directives,
  });
}

/** Gives the test portfolio a stake big enough for the requested tier. */
async function giveStake(userId: string, gameId: string, stakePercent: number) {
  const asset = await prisma.asset.findFirstOrThrow({
    where: { kind: "STOCK" },
    orderBy: { symbol: "asc" },
  });
  const portfolio = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
  const world = await replay(gameId);
  const company = world.companies.find((entry) => entry.symbol === asset.symbol);
  if (!company) throw new Error("Asset is not part of the simulated world");

  const quantity = Math.ceil((company.sharesOutstanding * stakePercent) / 100);
  await prisma.holding.upsert({
    where: { portfolioId_assetId: { portfolioId: portfolio.id, assetId: asset.id } },
    create: {
      portfolioId: portfolio.id,
      assetId: asset.id,
      quantity,
      averageCostMinor: company.priceMinor,
    },
    update: { quantity, averageCostMinor: company.priceMinor },
  });
  return { symbol: asset.symbol, quantity, sharesOutstanding: company.sharesOutstanding };
}

describe("company control", () => {
  it("rejects a resolution when the stake is below its tier", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Dewi",
      lastName: "Minor",
      background: "SCHOLAR",
    });
    const { symbol } = await giveStake(userId, gameId, 2);

    await expect(
      issueDirective(userId, {
        companySymbol: symbol,
        kind: "DIVIDEND",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "TIER_TOO_LOW" });
  });

  it("credits the shareholder dividend once and replays idempotently", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Arif",
      lastName: "Dividen",
      background: "SCHOLAR",
    });
    const { symbol } = await giveStake(userId, gameId, 30);

    const before = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    const key = crypto.randomUUID();
    const outcome = await issueDirective(userId, {
      companySymbol: symbol,
      kind: "DIVIDEND",
      idempotencyKey: key,
    });

    expect(outcome.replayed).toBe(false);
    expect(outcome.playerPayoutMinor).toBeGreaterThan(0n);
    expect(outcome.payoutMinor).toBeGreaterThan(outcome.playerPayoutMinor);

    const after = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    expect(after.cashMinor).toBe(before.cashMinor + outcome.playerPayoutMinor);

    const dividendRows = await prisma.ledgerEntry.findMany({
      where: { gameId, reason: "DIVIDEND" },
    });
    expect(dividendRows).toHaveLength(1);
    expect(dividendRows[0]!.amountMinor).toBe(outcome.playerPayoutMinor);

    const replayOutcome = await issueDirective(userId, {
      companySymbol: symbol,
      kind: "DIVIDEND",
      idempotencyKey: key,
    });
    expect(replayOutcome.replayed).toBe(true);

    const afterReplay = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    expect(afterReplay.cashMinor).toBe(after.cashMinor);
    expect(await prisma.companyDirective.count({ where: { gameId } })).toBe(1);
  });

  it("enforces the quarterly cooldown between resolutions", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Rina",
      lastName: "Rups",
      background: "SCHOLAR",
    });
    const { symbol } = await giveStake(userId, gameId, 30);

    await issueDirective(userId, {
      companySymbol: symbol,
      kind: "DIVIDEND",
      idempotencyKey: crypto.randomUUID(),
    });

    await expect(
      issueDirective(userId, {
        companySymbol: symbol,
        kind: "EXPANSION",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ControlError);

    await prisma.game.update({ where: { id: gameId }, data: { tick: 3 } });
    const second = await issueDirective(userId, {
      companySymbol: symbol,
      kind: "EXPANSION",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(second.replayed).toBe(false);
  });

  it("applies the recorded buyback when the game advances", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Bayu",
      lastName: "Buyback",
      background: "SCHOLAR",
    });
    const { symbol, sharesOutstanding } = await giveStake(userId, gameId, 30);

    await issueDirective(userId, {
      companySymbol: symbol,
      kind: "BUYBACK",
      idempotencyKey: crypto.randomUUID(),
    });

    await advanceGame(userId);

    const { inputs } = await loadDirectives(gameId);
    expect(inputs).toHaveLength(1);
    const world = await replay(gameId, inputs);
    const baseline = await replay(gameId);
    const directed = world.companies.find((entry) => entry.symbol === symbol)!;
    const plain = baseline.companies.find((entry) => entry.symbol === symbol)!;

    expect(directed.sharesOutstanding).toBeLessThan(sharesOutstanding);
    expect(directed.sharesOutstanding).toBeLessThan(plain.sharesOutstanding);

    const portfolio = await prisma.portfolio.findUniqueOrThrow({ where: { gameId } });
    const cashRows = await prisma.ledgerEntry.findMany({
      where: { gameId, account: "CASH" },
    });
    const ledgerCash = cashRows.reduce(
      (total, row) =>
        row.direction === "CREDIT" ? total + row.amountMinor : total - row.amountMinor,
      0n,
    );
    expect(ledgerCash).toBe(portfolio.cashMinor);
  });
});
