/**
 * Trading service (docs/ARCHITECTURE.md §4): market orders fill immediately,
 * limit orders rest and resolve inside advanceGame at the next tick's price.
 * Idempotency keys are per-game unique; replaying one returns the original
 * order instead of creating a second one.
 */
import { Prisma } from "@/generated/prisma/index";
import { fillBuy, fillSell, FillError } from "./trade-fill";
import { prisma } from "@/server/db";
import { futuresPnlMinor } from "@/domain/futures";
import { economySnapshot } from "@/domain/economy";
import { buildBondMarket } from "@/domain/bonds";
import {
  buildOrderBook,
  executeMarketOrder,
  matchLimitOrder,
} from "@/domain/market/order-book";

type Tx = Prisma.TransactionClient;

export class TradeError extends Error {
  constructor(
    public code:
      | "NO_GAME" | "GAME_OVER" | "UNKNOWN_ASSET" | "BAD_QUANTITY"
      | "BAD_LIMIT" | "INSUFFICIENT_FUNDS" | "OVERSELL" | "NOT_PENDING",
    message: string,
  ) {
    super(message);
  }
}

export interface PlaceOrderInput {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  limitPriceMinor?: bigint | null;
  idempotencyKey: string;
}

export interface PlaceOrderOutcome {
  orderId: string;
  status: string;
  replayed: boolean;
}

export async function placeOrder(
  userId: string,
  input: PlaceOrderInput,
): Promise<PlaceOrderOutcome> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new TradeError("BAD_QUANTITY", "Quantity must be a positive integer.");
  }
  if (input.type === "LIMIT" && (!input.limitPriceMinor || input.limitPriceMinor <= 0n)) {
    throw new TradeError("BAD_LIMIT", "Limit orders need a positive limit price.");
  }

  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (!game) throw new TradeError("NO_GAME", "Create a character first.");
    await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;
    if (game.status !== "ACTIVE") {
      throw new TradeError("GAME_OVER", "This life has already ended.");
    }

    // Idempotent replay: same game + same key returns the original row.
    const existing = await tx.order.findUnique({
      where: { gameId_idempotencyKey: { gameId: game.id, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      return { orderId: existing.id, status: existing.status, replayed: true };
    }

    const asset = await tx.asset.findUnique({ where: { symbol: input.symbol } });
    if (!asset) throw new TradeError("UNKNOWN_ASSET", "Unknown asset symbol.");

    const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });
    const point = await tx.pricePoint.findFirst({
      where: { gameId: game.id, assetId: asset.id },
      orderBy: { tick: "desc" },
    });
    if (!point) throw new TradeError("UNKNOWN_ASSET", "No price for this game yet.");

    // Every market and stock/crypto limit order runs through the same
    // algorithmic book, so displayed depth and executed prices agree.
    const book = buildOrderBook({
      symbol: asset.symbol,
      midPriceMinor: point.priceMinor,
      tick: game.tick,
    });
    const execution =
      input.type === "MARKET"
        ? executeMarketOrder(input.side, input.quantity, book)
        : matchLimitOrder(input.side, input.quantity, input.limitPriceMinor!, book);

    const order = await tx.order.create({
      data: {
        gameId: game.id,
        assetId: asset.id,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        limitPriceMinor: input.type === "LIMIT" ? input.limitPriceMinor! : null,
        tickPlaced: game.tick,
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
      },
    });

    if (!execution) {
      // A limit that does not cross rests; advanceGame resolves it later.
      return { orderId: order.id, status: "PENDING", replayed: false };
    }

    try {
      const ctx = {
        gameId: game.id,
        portfolioId: portfolio.id,
        orderId: order.id,
        assetId: asset.id,
        quantity: input.quantity,
        priceMinor: execution.averagePriceMinor,
        tick: game.tick,
      };
      if (input.side === "BUY") {
        await fillBuy(tx, ctx);
      } else {
        await fillSell(tx, ctx);
      }
      return { orderId: order.id, status: "FILLED", replayed: false };
    } catch (error) {
      if (!(error instanceof FillError)) throw error;
      await tx.order.update({
        where: { id: order.id },
        data: { status: "REJECTED", tickResolved: game.tick },
      });
      throw new TradeError(error.code, error.code === "OVERSELL" ? "Not enough shares." : "Not enough cash.");
    }
  }, { timeout: 20_000 });
}

export async function cancelOrder(userId: string, orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findFirst({
      where: { userId, status: "ACTIVE" },
    });
    if (!game) throw new TradeError("NO_GAME", "Create a character first.");
    const order = await tx.order.findFirst({
      where: { id: orderId, gameId: game.id },
    });
    if (!order || order.status !== "PENDING") {
      throw new TradeError("NOT_PENDING", "Only pending orders can be cancelled.");
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", tickResolved: game.tick },
    });
  }, { timeout: 20_000 });
}

/* -------------------------------------------------------------------- */
/* Portfolio reads                                                       */
/* -------------------------------------------------------------------- */

export interface HoldingRow {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  averageCostMinor: bigint;
  avgCostMinor: bigint;
  priceMinor: bigint;
  currentPriceMinor: bigint;
  marketValueMinor: bigint;
  unrealizedMinor: bigint;
}

export interface PortfolioSnapshot {
  cashMinor: bigint;
  holdings: HoldingRow[];
  holdingsValueMinor: bigint;
  portfolioValue: bigint;
  netWorthMinor: bigint;
  pendingOrders: Array<{
    id: string;
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    quantity: number;
    limitPriceMinor: bigint | null;
    filled: boolean;
    createdAt: number;
  }>;
  history: Array<{
    id: string;
    symbol: string;
    side: "BUY" | "SELL";
    status: string;
    quantity: number;
    fillPriceMinor: bigint | null;
    priceMinor: bigint;
    feeMinor: bigint;
    netMinor: bigint | null;
    grossMinor: bigint | null;
    tickPlaced: number;
    tickResolved: number | null;
    type: string;
    limitPriceMinor: bigint | null;
    createdAt: number;
  }>;
  priceHistory: Map<string, Array<{ tick: number; priceMinor: bigint }>>;
}

export async function portfolioSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (!game) return null;

  const portfolio = await prisma.portfolio.findUniqueOrThrow({
    where: { gameId: game.id },
    include: { holdings: { include: { asset: true } } },
  });

  const latestPoints = await prisma.pricePoint.groupBy({
    by: ["assetId"],
    where: { gameId: game.id },
    _max: { tick: true },
  });
  const symbolByAssetId = new Map(portfolio.holdings.map((holding) => [holding.assetId, holding.asset.symbol]));
  const assetIds = new Set<string>([
    ...portfolio.holdings.map((holding) => holding.assetId),
    ...latestPoints.map((point) => point.assetId),
  ]);

  const ticks = await prisma.pricePoint.findMany({
    where: { gameId: game.id, tick: { gte: Math.max(0, game.tick - 11) } },
    orderBy: [{ assetId: "asc" }, { tick: "asc" }],
  });
  const priceHistory = new Map<string, Array<{ tick: number; priceMinor: bigint }>>();
  for (const row of ticks) {
    const slot = priceHistory.get(row.assetId) ?? [];
    slot.push({ tick: row.tick, priceMinor: row.priceMinor });
    priceHistory.set(row.assetId, slot);
  }

  const priceByAssetId = new Map<string, bigint>();
  for (const row of ticks) {
    if (row.tick === game.tick) priceByAssetId.set(row.assetId, row.priceMinor);
  }

  const holdings: HoldingRow[] = portfolio.holdings.map((holding) => {
    const price = priceByAssetId.get(holding.assetId) ?? holding.averageCostMinor;
    const marketValue = price * BigInt(holding.quantity);
    const basis = holding.averageCostMinor * BigInt(holding.quantity);
    return {
      symbol: holding.asset.symbol,
      name: holding.asset.name,
      sector: holding.asset.sector,
      quantity: holding.quantity,
      averageCostMinor: holding.averageCostMinor,
      avgCostMinor: holding.averageCostMinor,
      priceMinor: price,
      currentPriceMinor: price,
      marketValueMinor: marketValue,
      unrealizedMinor: marketValue - basis,
    };
  });

  const pendingOrders = await prisma.order.findMany({
    where: { gameId: game.id, status: "PENDING" },
    include: { asset: true },
    orderBy: { createdAt: "desc" },
  });
  const history = await prisma.order.findMany({
    where: { gameId: game.id, status: { in: ["FILLED", "REJECTED", "CANCELLED"] } },
    include: { asset: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const holdingsValueMinor = holdings.reduce(
    (total, holding) => total + holding.marketValueMinor,
    0n,
  );

  // Include open futures equity and bond holdings so net worth matches the dashboard.
  const openFutures = await prisma.futuresPosition.findMany({
    where: { gameId: game.id, status: "OPEN" },
  });
  let futuresEquityMinor = 0n;
  if (openFutures.length > 0) {
    const futuresPoints = await prisma.pricePoint.findMany({
      where: {
        gameId: game.id,
        tick: game.tick,
        assetId: { in: openFutures.map((p) => p.assetId) },
      },
    });
    const futuresPriceMap = new Map(futuresPoints.map((p) => [p.assetId, p.priceMinor]));
    for (const position of openFutures) {
      const mark = futuresPriceMap.get(position.assetId) ?? position.entryPriceMinor;
      futuresEquityMinor +=
        position.marginMinor +
        futuresPnlMinor(position.side, position.entryPriceMinor, mark, position.quantity);
    }
  }

  const bondHoldings = await prisma.bondHolding.findMany({ where: { gameId: game.id } });
  let bondValueMinor = 0n;
  if (bondHoldings.length > 0) {
    const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
    const world = economySnapshot({
      seed: game.seed,
      assets,
      pace: "MONTH",
      monthsElapsed: game.tick,
      startYear: game.startDate.getUTCFullYear(),
      startMonth: game.startDate.getUTCMonth() + 1,
    });
    const instruments = buildBondMarket(world.bonds, game.tick);
    for (const holding of bondHoldings) {
      const instrument = instruments.find((c) => c.key === holding.bondKey);
      bondValueMinor += (instrument?.priceMinor ?? 0n) * BigInt(holding.quantity);
    }
  }

  return {
    cashMinor: portfolio.cashMinor,
    holdings,
    holdingsValueMinor,
    portfolioValue: holdingsValueMinor,
    netWorthMinor: portfolio.cashMinor + holdingsValueMinor + futuresEquityMinor + bondValueMinor,
    pendingOrders: pendingOrders.map((order) => ({
      id: order.id,
      symbol: order.asset.symbol,
      side: order.side as "BUY" | "SELL",
      type: order.type as "MARKET" | "LIMIT",
      quantity: order.quantity,
      limitPriceMinor: order.limitPriceMinor,
      filled: order.status === "FILLED",
      createdAt: order.createdAt.getTime(),
    })),
    history: history.map((order) => ({
      id: order.id,
      symbol: order.asset.symbol,
      side: order.side as "BUY" | "SELL",
      status: order.status,
      quantity: order.quantity,
      fillPriceMinor: order.fillPriceMinor,
      priceMinor: order.fillPriceMinor ?? order.limitPriceMinor ?? 0n,
      feeMinor: order.feeMinor ?? 0n,
      netMinor: order.netMinor,
      grossMinor: order.grossMinor,
      tickPlaced: order.tickPlaced,
      tickResolved: order.tickResolved,
      type: order.type,
      limitPriceMinor: order.limitPriceMinor,
      createdAt: order.createdAt.getTime(),
    })),
    priceHistory,
  };
}

export type { Prisma };
