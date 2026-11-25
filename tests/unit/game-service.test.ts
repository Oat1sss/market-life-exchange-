/**
 * Integration tests for GameService:
 * - Task 4: createGame (transaction: game, character, portfolio, starting prices)
 * - Task 5: advanceGame + ledger consistency
 * - Task 7: education and achievements
 */
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import {
  createGame,
  canCreateGame,
  advanceGame,
  gameSnapshot,
  enrollEducation,
  educationState,
  GameError,
} from "@/server/services/game-service";

const TEST_DOMAIN = "gameservice-test.internal";
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    createdUserIds.length = 0;
  }
});

async function createTestUser(): Promise<string> {
  const email = `player-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const res = await registerUser({ email, password: "testPassword123!" });
  if (!res.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  return user.id;
}

describe("Task 4: createGame and initial game transaction", () => {
  it("creates game, character, portfolio, demo balance, and price points in one transaction", async () => {
    const userId = await createTestUser();

    expect(await canCreateGame(userId)).toBe(true);

    const { gameId } = await createGame(userId, {
      firstName: "Alex",
      lastName: "Mercer",
      background: "SCHOLAR",
    });

    expect(gameId).toBeDefined();
    expect(await canCreateGame(userId)).toBe(true); // slot 2-5 masih kosong

    // Verify game row
    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: {
        character: true,
        portfolio: true,
        expenseRules: true,
        pricePoints: true,
      },
    });

    expect(game.userId).toBe(userId);
    expect(game.tick).toBe(0);
    expect(game.status).toBe("ACTIVE");

    // Verify character stats (Scholar: knowledge 70)
    expect(game.character?.firstName).toBe("Alex");
    expect(game.character?.lastName).toBe("Mercer");
    expect(game.character?.background).toBe("SCHOLAR");
    expect(game.character?.knowledge).toBe(70);

    // Verify portfolio: demo accounts start with 10,000,000 minor units (100,000 credits)
    expect(game.portfolio?.cashMinor).toBe(1_000_000_000_000n);

    // Demo exchange has no bills to pay
    expect(game.expenseRules.length).toBe(0);

    // Demo exchange has no salary/career
    const career = await prisma.career.findFirst({
      where: { characterId: game.character!.id },
    });
    expect(career).toBeNull();

    // Verify a price point for every seeded asset
    const assetCount = await prisma.asset.count();
    expect(assetCount).toBeGreaterThan(0);
    expect(game.pricePoints.length).toBe(assetCount);
    for (const point of game.pricePoints) {
      expect(point.tick).toBe(0);
      expect(point.priceMinor).toBeGreaterThan(0n);
    }

    // Verify initial DEPOSIT ledger entry
    const entries = await prisma.ledgerEntry.findMany({
      where: { gameId },
      orderBy: { sequence: "asc" },
    });
    expect(entries.length).toBe(1);
    expect(entries[0]!.reason).toBe("DEPOSIT");
    expect(entries[0]!.amountMinor).toBe(1_000_000_000_000n);
    expect(entries[0]!.balanceAfterMinor).toBe(1_000_000_000_000n);
  });
});

describe("Task 5: advanceGame and dashboard snapshot", () => {
  it("advances one tick and generates fresh prices without changing cash", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Taylor",
      lastName: "Swift",
      background: "CREATIVE",
    });

    const initialSnapshot = await gameSnapshot(userId);
    expect(initialSnapshot).not.toBeNull();
    expect(initialSnapshot?.tick).toBe(0);
    expect(initialSnapshot?.cashMinor).toBe(1_000_000_000_000n);

    // Advance 1 tick
    const outcome = await advanceGame(userId);
    expect(outcome.tick).toBe(1);

    const afterAdvance = await gameSnapshot(userId);
    expect(afterAdvance?.tick).toBe(1);
    // No salary/expenses exist, so a market-only tick leaves cash untouched.
    expect(afterAdvance?.cashMinor).toBe(1_000_000_000_000n);

    // Check price points at tick 1
    const tick1Prices = await prisma.pricePoint.findMany({
      where: { gameId, tick: 1 },
    });
    expect(tick1Prices.length).toBe(await prisma.asset.count());

    // Verify cash balance invariant: sum of CASH ledger deltas == portfolio.cashMinor
    const ledgerCashEntries = await prisma.ledgerEntry.findMany({
      where: { gameId, account: "CASH" },
    });
    const computedCash = ledgerCashEntries.reduce((acc, entry) => {
      return entry.direction === "CREDIT"
        ? acc + entry.amountMinor
        : acc - entry.amountMinor;
    }, 0n);

    expect(afterAdvance?.cashMinor).toBe(computedCash);
  });
});

describe("Task 7: Life events, education, and achievements", () => {
  it("allows enrolling in education, deducting tuition, and completing on tick", async () => {
    const userId = await createTestUser();
    await createGame(userId, {
      firstName: "Morgan",
      lastName: "Freeman",
      background: "HUSTLER",
    });

    const beforeSnap = await gameSnapshot(userId);
    const knowledgeBefore = beforeSnap!.character.knowledge;
    const cashBefore = beforeSnap!.cashMinor;

    // Enroll in SHORT_COURSE (duration: 3 ticks, tuition: 20_000n)
    await enrollEducation(userId, "SHORT_COURSE");

    const afterEnroll = await gameSnapshot(userId);
    expect(afterEnroll!.cashMinor).toBe(cashBefore - 20_000n);

    const edu = await educationState(userId);
    expect(edu.currentProgram).not.toBeNull();
    expect(edu.currentProgram?.key).toBe("SHORT_COURSE");
    expect(edu.currentProgram?.monthsLeft).toBe(3);

    // Advance 3 ticks to complete the course
    await advanceGame(userId);
    await advanceGame(userId);
    await advanceGame(userId);

    const completedEdu = await educationState(userId);
    expect(completedEdu.currentProgram).toBeNull();
    expect(completedEdu.fullDegrees.length).toBe(1);
    expect(completedEdu.fullDegrees[0]!.key).toBe("SHORT_COURSE");

    const afterCompletion = await gameSnapshot(userId);
    expect(afterCompletion!.character.knowledge).toBeGreaterThan(knowledgeBefore);
  });

});
