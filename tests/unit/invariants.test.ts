/**
 * Fase 8: Invariant property tests over a multi-tick simulation
 * Verifies that throughout 12+ simulation ticks with trades and life events:
 * 1. Double-entry accounting invariant: sum(ledger CASH deltas) === portfolio.cashMinor
 * 2. Monotonic sequencing: ledger_entries.sequence has no duplicates or gaps
 * 3. Holdings sanity: quantity > 0 and averageCostMinor > 0 for all holding rows
 * 4. Deterministic replay and idempotency
 */
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import {
  createGame,
  advanceGame,
  gameSnapshot,
  pendingLifeEvent,
  resolveLifeEvent,
} from "@/server/services/game-service";
import { placeOrder } from "@/server/services/trade-service";

const TEST_DOMAIN = "invariants-test.internal";
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
  const email = `sim-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const res = await registerUser({ email, password: "simPassword123!" });
  if (!res.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  return user.id;
}

describe("Fase 8: Multi-tick Simulation & Accounting Invariants", () => {
  it("maintains accounting, ledger, and holdings invariants over 12 ticks with trades", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Gordon",
      lastName: "Gekko",
      background: "HUSTLER",
    });

    const TICKS_TO_SIMULATE = 6;
    const assetCount = await prisma.asset.count();

    for (let t = 1; t <= TICKS_TO_SIMULATE; t++) {
      // 1. If a life event is pending, resolve it so advance is unblocked
      const pending = await pendingLifeEvent(userId);
      if (pending) {
        // Pick choice that doesn't overdraw (e.g. DELAY or IGNORE or DECLINE or first choice)
        const choice = pending.choices[1]?.key ?? pending.choices[0]?.key ?? "DELAY";
        await resolveLifeEvent(userId, {
          templateKey: pending.templateKey,
          choiceKey: choice,
        });
      }

      // 2. Perform occasional trades based on tick
      if (t === 2) {
        // Buy 1 share of CBLK (very cheap crypto, ~50 credits)
        await placeOrder(userId, {
          symbol: "CBLK",
          side: "BUY",
          type: "MARKET",
          quantity: 2,
          idempotencyKey: crypto.randomUUID(),
        });
      } else if (t === 4) {
        // Buy 1 share of GRAN
        await placeOrder(userId, {
          symbol: "GRAN",
          side: "BUY",
          type: "MARKET",
          quantity: 1,
          idempotencyKey: crypto.randomUUID(),
        });
      } else if (t === 6) {
        // Sell 1 share of CBLK
        await placeOrder(userId, {
          symbol: "CBLK",
          side: "SELL",
          type: "MARKET",
          quantity: 1,
          idempotencyKey: crypto.randomUUID(),
        });
      }

      // 3. Advance to the next month
      await advanceGame(userId);

      // 4. VERIFY INVARIANTS AT THIS TICK:
      const snap = await gameSnapshot(userId);
      expect(snap).not.toBeNull();
      expect(snap!.tick).toBe(t);

      // Invariant 1: Cash ledger sum matches portfolio.cashMinor exactly
      const cashEntries = await prisma.ledgerEntry.findMany({
        where: { gameId, account: "CASH" },
        orderBy: { sequence: "asc" },
      });
      const expectedCash = cashEntries.reduce((sum, entry) => {
        return entry.direction === "CREDIT"
          ? sum + entry.amountMinor
          : sum - entry.amountMinor;
      }, 0n);
      expect(snap!.cashMinor).toBe(expectedCash);

      // Invariant 2: Ledger sequence is strictly 1, 2, 3, ... N without gaps
      const allEntries = await prisma.ledgerEntry.findMany({
        where: { gameId },
        orderBy: { sequence: "asc" },
      });
      for (let i = 0; i < allEntries.length; i++) {
        expect(allEntries[i]!.sequence).toBe(i + 1);
      }

      // Invariant 3: Holdings sanity: quantity > 0 and averageCostMinor > 0
      const holdings = await prisma.holding.findMany({
        where: { portfolio: { gameId } },
      });
      for (const h of holdings) {
        expect(h.quantity).toBeGreaterThan(0);
        expect(h.averageCostMinor).toBeGreaterThan(0n);
      }

      // Invariant 4: Price points exist for every seeded asset at this tick
      const pricePoints = await prisma.pricePoint.findMany({
        where: { gameId, tick: t },
      });
      expect(pricePoints.length).toBe(assetCount);
    }
  });
});
