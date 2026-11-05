/**
 * Integration tests for TradeService & TradeFill:
 * - Task 6: trade service (market & limit orders, holdings, portfolio snapshots)
 * - Fase 8: invariants (trade rollback on insufficient funds, oversell rejection, idempotency)
 */
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { registerUser } from "@/server/services/user-service";
import { createGame, advanceGame } from "@/server/services/game-service";
import {
  placeOrder,
  cancelOrder,
  portfolioSnapshot,
  TradeError,
} from "@/server/services/trade-service";

const TEST_DOMAIN = "tradeservice-test.internal";
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
  const email = `trader-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${TEST_DOMAIN}`;
  const res = await registerUser({ email, password: "tradePassword123!" });
  if (!res.ok) throw new Error("Could not create test user");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  createdUserIds.push(user.id);
  return user.id;
}

describe("Task 6: Market and Limit orders", () => {
  it("executes a market BUY order, debits cash with fee, and records holding", async () => {
    const userId = await createTestUser();
    const { gameId } = await createGame(userId, {
      firstName: "Warren",
      lastName: "Buffett",
      background: "HUSTLER",
    });

    const initialPortfolio = await portfolioSnapshot(userId);
    const initialCash = initialPortfolio!.cashMinor;

    // Buy 1 share of GRAN (fundamental 30,000 minor = 300 credits)
    const idempotencyKey = crypto.randomUUID();
    const result = await placeOrder(userId, {
      symbol: "GRAN",
      side: "BUY",
      type: "MARKET",
      quantity: 1,
      idempotencyKey,
    });

    expect(result.status).toBe("FILLED");
    expect(result.replayed).toBe(false);

    // Check portfolio
    const afterBuy = await portfolioSnapshot(userId);
    expect(afterBuy!.holdings.length).toBe(1);
    const gran = afterBuy!.holdings.find((h) => h.symbol === "GRAN");
    expect(gran).toBeDefined();
    expect(gran!.quantity).toBe(1);
    expect(gran!.averageCostMinor).toBe(30_000n);

    // Cash decreased by gross (30_000) + fee (150 = 100 min fee + 50 platform fee)
    expect(afterBuy!.cashMinor).toBeLessThan(initialCash);

    // Verify cash ledger delta matches cash change
    const cashEntries = await prisma.ledgerEntry.findMany({
      where: { gameId, account: "CASH" },
    });
    const computedCash = cashEntries.reduce((acc, entry) => {
      return entry.direction === "CREDIT"
        ? acc + entry.amountMinor
        : acc - entry.amountMinor;
    }, 0n);
    expect(afterBuy!.cashMinor).toBe(computedCash);
  });

  it("executes a market SELL order, credits cash minus fee, and removes holding when fully sold", async () => {
    const userId = await createTestUser();
    await createGame(userId, {
      firstName: "Jesse",
      lastName: "Livermore",
      background: "HUSTLER",
    });

    // Buy 2 shares of GRAN
    await placeOrder(userId, {
      symbol: "GRAN",
      side: "BUY",
      type: "MARKET",
      quantity: 2,
      idempotencyKey: crypto.randomUUID(),
    });

    const portfolioAfterBuy = await portfolioSnapshot(userId);
    const cashAfterBuy = portfolioAfterBuy!.cashMinor;

    // Sell 2 shares of GRAN
    const sellResult = await placeOrder(userId, {
      symbol: "GRAN",
      side: "SELL",
      type: "MARKET",
      quantity: 2,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(sellResult.status).toBe("FILLED");

    const portfolioAfterSell = await portfolioSnapshot(userId);
    // Holding row should be deleted since quantity is 0
    expect(portfolioAfterSell!.holdings.length).toBe(0);
    // Cash increased
    expect(portfolioAfterSell!.cashMinor).toBeGreaterThan(cashAfterBuy);
  });

  it("places a resting LIMIT order and cancels it", async () => {
    const userId = await createTestUser();
    await createGame(userId, {
      firstName: "Charlie",
      lastName: "Munger",
      background: "SCHOLAR",
    });

    // Place a limit buy order with a low limit price (50 credits = 5,000 minor)
    const limitResult = await placeOrder(userId, {
      symbol: "GRAN",
      side: "BUY",
      type: "LIMIT",
      quantity: 1,
      limitPriceMinor: 5_000n,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(limitResult.status).toBe("PENDING");

    const snap = await portfolioSnapshot(userId);
    expect(snap!.pendingOrders.length).toBe(1);
    expect(snap!.pendingOrders[0]!.id).toBe(limitResult.orderId);

    // Cancel the pending order
    await cancelOrder(userId, limitResult.orderId);

    const snapAfterCancel = await portfolioSnapshot(userId);
    expect(snapAfterCancel!.pendingOrders.length).toBe(0);
  });
});

describe("Fase 8: Invariants and Error Handling", () => {
  it("enforces idempotency: submitting the same idempotency key twice returns original order and does not re-execute", async () => {
    const userId = await createTestUser();
    await createGame(userId, {
      firstName: "Idempotent",
      lastName: "Tester",
      background: "HUSTLER",
    });

    const key = crypto.randomUUID();

    const order1 = await placeOrder(userId, {
      symbol: "GRAN",
      side: "BUY",
      type: "MARKET",
      quantity: 1,
      idempotencyKey: key,
    });
    expect(order1.replayed).toBe(false);

    const snap1 = await portfolioSnapshot(userId);
    const cash1 = snap1!.cashMinor;
    const qty1 = snap1!.holdings[0]!.quantity;

    // Submit identical order with same idempotency key
    const order2 = await placeOrder(userId, {
      symbol: "GRAN",
      side: "BUY",
      type: "MARKET",
      quantity: 1,
      idempotencyKey: key,
    });
    expect(order2.replayed).toBe(true);
    expect(order2.orderId).toBe(order1.orderId);

    const snap2 = await portfolioSnapshot(userId);
    expect(snap2!.cashMinor).toBe(cash1);
    expect(snap2!.holdings[0]!.quantity).toBe(qty1);
  });

  it("rejects oversell attempts and rolls back completely", async () => {
    const userId = await createTestUser();
    await createGame(userId, {
      firstName: "Short",
      lastName: "Seller",
      background: "CREATIVE",
    });

    // Attempt to sell 5 shares of NOVA with 0 shares owned
    await expect(
      placeOrder(userId, {
        symbol: "NOVA",
        side: "SELL",
        type: "MARKET",
        quantity: 5,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrowError(/not enough shares|oversell/i);

    const snap = await portfolioSnapshot(userId);
    expect(snap!.holdings.length).toBe(0);
  });

  it("rejects insufficient funds attempts and rolls back completely without debiting cash", async () => {
    const userId = await createTestUser();
    await createGame(userId, {
      firstName: "Broke",
      lastName: "Buyer",
      background: "SCHOLAR",
    });

    const initial = await portfolioSnapshot(userId);
    const initialCash = initial!.cashMinor;

    // Attempt to buy 1,000 shares of NOVA (costs ~1,200,000 credits, starting cash is only 2,400)
    await expect(
      placeOrder(userId, {
        symbol: "NOVA",
        side: "BUY",
        type: "MARKET",
        quantity: 1000,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrowError(/not enough cash|insufficient/i);

    const after = await portfolioSnapshot(userId);
    expect(after!.cashMinor).toBe(initialCash);
    expect(after!.holdings.length).toBe(0);
  });
});
