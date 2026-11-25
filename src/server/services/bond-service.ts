/**
 * Bond service: buy and sell fixed-income lines priced off the deterministic
 * macro yield curve, then settle monthly coupons and principal at maturity.
 *
 * A unit is one bond with 100 credits of face value. Prices come from the same
 * replay used by the economy page and by `advanceGame`, so the quote a player
 * sees, pays, and is marked at is always the same number. Every cash movement
 * appends ledger rows in the same transaction and the portfolio balance is
 * updated with a guarded write, never by overwriting a stale snapshot.
 */
import { Prisma } from "@/generated/prisma/index";
import { prisma } from "@/server/db";
import { economySnapshot, type World } from "@/domain/economy";
import {
  BOND_FACE_MINOR,
  MAX_BONDS_PER_ORDER,
  bondFeeMinor,
  bondLine,
  buildBondMarket,
  couponPerBondMinor,
  currentYieldBp,
  monthsToMaturity,
  type BondInstrument,
} from "@/domain/bonds";
import { appendLedgerRun } from "./ledger";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export class BondError extends Error {
  constructor(
    public code:
      | "NO_GAME"
      | "GAME_OVER"
      | "UNKNOWN_BOND"
      | "BAD_QUANTITY"
      | "INSUFFICIENT_FUNDS"
      | "OVERSELL"
      | "MATURED"
      | "BAD_KEY",
    message: string,
  ) {
    super(message);
  }
}

interface GameRow {
  id: string;
  seed: bigint;
  tick: number;
  startDate: Date;
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_BONDS_PER_ORDER) {
    throw new BondError(
      "BAD_QUANTITY",
      `Quantity must be a whole number between 1 and ${MAX_BONDS_PER_ORDER}.`,
    );
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Replays the macro economy at the game's current tick and joins bond yields. */
async function marketAt(db: Db, game: GameRow): Promise<{
  world: World;
  instruments: BondInstrument[];
}> {
  const assets = await db.asset.findMany({ orderBy: { symbol: "asc" } });
  const world = economySnapshot({
    seed: game.seed,
    assets,
    pace: "MONTH",
    monthsElapsed: game.tick,
    startYear: game.startDate.getUTCFullYear(),
    startMonth: game.startDate.getUTCMonth() + 1,
  });
  return { world, instruments: buildBondMarket(world.bonds, game.tick) };
}

async function findGameForUpdate(tx: Tx, userId: string) {
  const game = await tx.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!game) throw new BondError("NO_GAME", "Create a character first.");
  await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;
  return game;
}

async function instrumentFor(tx: Tx, game: GameRow, bondKey: string): Promise<BondInstrument> {
  const line = bondLine(bondKey);
  if (!line) throw new BondError("UNKNOWN_BOND", "Unknown bond line.");
  const { instruments } = await marketAt(tx, game);
  const instrument = instruments.find((candidate) => candidate.key === line.key);
  if (!instrument) throw new BondError("UNKNOWN_BOND", "Unknown bond line.");
  return instrument;
}

export interface BondTradeInput {
  bondKey: string;
  quantity: number;
  idempotencyKey: string;
}

export interface BondTradeOutcome {
  tradeId: string;
  replayed: boolean;
  priceMinor: bigint;
  grossMinor: bigint;
  feeMinor: bigint;
  netMinor: bigint;
}

export async function buyBonds(
  userId: string,
  input: BondTradeInput,
): Promise<BondTradeOutcome> {
  assertQuantity(input.quantity);
  if (!isUuid(input.idempotencyKey)) {
    throw new BondError("BAD_KEY", "Missing trade reference, reload the page.");
  }

  return prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);
    if (game.status !== "ACTIVE") throw new BondError("GAME_OVER", "This life has already ended.");

    const existing = await tx.bondTrade.findUnique({
      where: { gameId_idempotencyKey: { gameId: game.id, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      return {
        tradeId: existing.id,
        replayed: true,
        priceMinor: existing.priceMinor,
        grossMinor: existing.grossMinor,
        feeMinor: existing.feeMinor,
        netMinor: existing.netMinor,
      };
    }

    const instrument = await instrumentFor(tx, game, input.bondKey);
    if (instrument.monthsLeft <= 0) {
      throw new BondError("MATURED", "This bond has already matured.");
    }

    const gross = instrument.priceMinor * BigInt(input.quantity);
    const fee = bondFeeMinor(gross);
    const total = gross + fee;

    const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });
    const debited = await tx.portfolio.updateMany({
      where: { id: portfolio.id, cashMinor: { gte: total } },
      data: { cashMinor: { decrement: total } },
    });
    if (debited.count === 0) {
      throw new BondError("INSUFFICIENT_FUNDS", "Not enough cash for this bond order.");
    }

    const holding = await tx.bondHolding.findUnique({
      where: { gameId_bondKey: { gameId: game.id, bondKey: instrument.key } },
    });
    const newBasis = (holding?.costMinor ?? 0n) + gross;
    const newQuantity = (holding?.quantity ?? 0) + input.quantity;
    const saved = await tx.bondHolding.upsert({
      where: { gameId_bondKey: { gameId: game.id, bondKey: instrument.key } },
      create: {
        gameId: game.id,
        bondKey: instrument.key,
        quantity: newQuantity,
        costMinor: newBasis,
        purchasedTick: game.tick,
      },
      update: { quantity: newQuantity, costMinor: newBasis },
    });

    const trade = await tx.bondTrade.create({
      data: {
        gameId: game.id,
        bondKey: instrument.key,
        side: "BUY",
        quantity: input.quantity,
        priceMinor: instrument.priceMinor,
        grossMinor: gross,
        feeMinor: fee,
        netMinor: total,
        tick: game.tick,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const after = await tx.portfolio.findUniqueOrThrow({ where: { id: portfolio.id } });
    await appendLedgerRun(tx, game.id, [
      {
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "DEBIT",
        amountMinor: total,
        balanceAfterMinor: after.cashMinor,
        reason: "BOND_BUY",
        refType: "BOND_TRADE",
        refId: trade.id,
        tick: game.tick,
      },
      {
        portfolioId: portfolio.id,
        account: "ASSET",
        direction: "CREDIT",
        amountMinor: gross,
        balanceAfterMinor: newBasis,
        reason: "BOND_BUY",
        refType: "BOND",
        refId: saved.id,
        tick: game.tick,
      },
    ]);

    return {
      tradeId: trade.id,
      replayed: false,
      priceMinor: instrument.priceMinor,
      grossMinor: gross,
      feeMinor: fee,
      netMinor: total,
    };
  }, { timeout: 20_000 });
}

export async function sellBonds(
  userId: string,
  input: BondTradeInput,
): Promise<BondTradeOutcome> {
  assertQuantity(input.quantity);
  if (!isUuid(input.idempotencyKey)) {
    throw new BondError("BAD_KEY", "Missing trade reference, reload the page.");
  }

  return prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);

    const existing = await tx.bondTrade.findUnique({
      where: { gameId_idempotencyKey: { gameId: game.id, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      return {
        tradeId: existing.id,
        replayed: true,
        priceMinor: existing.priceMinor,
        grossMinor: existing.grossMinor,
        feeMinor: existing.feeMinor,
        netMinor: existing.netMinor,
      };
    }

    const instrument = await instrumentFor(tx, game, input.bondKey);
    const holding = await tx.bondHolding.findUnique({
      where: { gameId_bondKey: { gameId: game.id, bondKey: instrument.key } },
    });
    if (!holding || holding.quantity < input.quantity) {
      throw new BondError("OVERSELL", "Not enough bonds in this line.");
    }

    const gross = instrument.priceMinor * BigInt(input.quantity);
    const fee = bondFeeMinor(gross);
    const net = gross > fee ? gross - fee : 0n;
    const basisSold =
      input.quantity === holding.quantity
        ? holding.costMinor
        : (holding.costMinor * BigInt(input.quantity)) / BigInt(holding.quantity);
    const remainingBasis = holding.costMinor - basisSold;
    const remainingQuantity = holding.quantity - input.quantity;

    if (remainingQuantity === 0) {
      await tx.bondHolding.delete({ where: { id: holding.id } });
    } else {
      await tx.bondHolding.update({
        where: { id: holding.id },
        data: { quantity: remainingQuantity, costMinor: remainingBasis },
      });
    }

    const portfolio = await tx.portfolio.update({
      where: { gameId: game.id },
      data: { cashMinor: { increment: net } },
    });

    const trade = await tx.bondTrade.create({
      data: {
        gameId: game.id,
        bondKey: instrument.key,
        side: "SELL",
        quantity: input.quantity,
        priceMinor: instrument.priceMinor,
        grossMinor: gross,
        feeMinor: fee,
        netMinor: net,
        tick: game.tick,
        idempotencyKey: input.idempotencyKey,
      },
    });

    await appendLedgerRun(tx, game.id, [
      {
        portfolioId: portfolio.id,
        account: "ASSET",
        direction: "DEBIT",
        amountMinor: basisSold,
        balanceAfterMinor: remainingBasis,
        reason: "BOND_SELL",
        refType: "BOND_TRADE",
        refId: trade.id,
        tick: game.tick,
      },
      {
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "CREDIT",
        amountMinor: net,
        balanceAfterMinor: portfolio.cashMinor,
        reason: "BOND_SELL",
        refType: "BOND_TRADE",
        refId: trade.id,
        tick: game.tick,
      },
    ]);

    return {
      tradeId: trade.id,
      replayed: false,
      priceMinor: instrument.priceMinor,
      grossMinor: gross,
      feeMinor: fee,
      netMinor: net,
    };
  }, { timeout: 20_000 });
}

export interface BondSettlement {
  couponMinor: bigint;
  principalMinor: bigint;
  maturedCount: number;
}

/**
 * Monthly coupon accrual plus principal redemption, called once per
 * `advanceGame` tick. Runs after the limit-order cash write so credits are not
 * overwritten by the stale snapshot.
 */
export async function settleBonds(
  tx: Tx,
  game: Pick<GameRow, "id">,
  tick: number,
): Promise<BondSettlement> {
  const holdings = await tx.bondHolding.findMany({ where: { gameId: game.id } });
  const result: BondSettlement = { couponMinor: 0n, principalMinor: 0n, maturedCount: 0 };
  if (holdings.length === 0) return result;

  const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });
  let balance = portfolio.cashMinor;
  const drafts: Array<Parameters<typeof appendLedgerRun>[2][number]> = [];

  for (const holding of holdings) {
    const line = bondLine(holding.bondKey);
    if (!line) continue;

    const coupon = couponPerBondMinor(line.couponBp) * BigInt(holding.quantity);
    const matured = monthsToMaturity(line, tick) === 0;
    const principal = matured ? BOND_FACE_MINOR * BigInt(holding.quantity) : 0n;

    if (coupon > 0n) {
      balance += coupon;
      result.couponMinor += coupon;
      drafts.push({
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "CREDIT",
        amountMinor: coupon,
        balanceAfterMinor: balance,
        reason: "BOND_COUPON",
        refType: "BOND",
        refId: holding.id,
        tick,
      });
    }

    if (matured) {
      balance += principal;
      result.principalMinor += principal;
      result.maturedCount += 1;
      drafts.push({
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "CREDIT",
        amountMinor: principal,
        balanceAfterMinor: balance,
        reason: "BOND_MATURITY",
        refType: "BOND",
        refId: holding.id,
        tick,
      });
      // The asset side is released at face value; any premium or discount was
      // already reflected in the cash paid/received at the trade.
      drafts.push({
        portfolioId: portfolio.id,
        account: "ASSET",
        direction: "DEBIT",
        amountMinor: holding.costMinor,
        balanceAfterMinor: 0n,
        reason: "BOND_MATURITY",
        refType: "BOND",
        refId: holding.id,
        tick,
      });
      await tx.bondHolding.delete({ where: { id: holding.id } });
    }
  }

  const credited = result.couponMinor + result.principalMinor;
  if (credited > 0n) {
    await tx.portfolio.update({
      where: { id: portfolio.id },
      data: { cashMinor: { increment: credited } },
    });
  }
  if (drafts.length > 0) {
    await appendLedgerRun(tx, game.id, drafts);
  }
  return result;
}

export interface BondHoldingView {
  bondKey: string;
  name: string;
  rating: string;
  quantity: number;
  costMinor: bigint;
  avgCostMinor: bigint;
  priceMinor: bigint;
  valueMinor: bigint;
  unrealizedMinor: bigint;
  monthsLeft: number;
  monthlyCouponMinor: bigint;
  yieldBp: number;
  currentYieldBp: number;
}

export interface BondTradeView {
  id: string;
  bondKey: string;
  name: string;
  side: "BUY" | "SELL";
  quantity: number;
  priceMinor: bigint;
  grossMinor: bigint;
  feeMinor: bigint;
  netMinor: bigint;
  tick: number;
  createdAt: number;
}

export interface BondSnapshot {
  tick: number;
  cashMinor: bigint;
  instruments: BondInstrument[];
  holdings: BondHoldingView[];
  trades: BondTradeView[];
  bondValueMinor: bigint;
  monthlyCouponMinor: bigint;
  unrealizedMinor: bigint;
}

export async function bondSnapshot(userId: string): Promise<BondSnapshot | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!game) return null;

  const { instruments } = await marketAt(prisma, game);
  const [portfolio, holdings, trades] = await Promise.all([
    prisma.portfolio.findUniqueOrThrow({ where: { gameId: game.id } }),
    prisma.bondHolding.findMany({ where: { gameId: game.id } }),
    prisma.bondTrade.findMany({
      where: { gameId: game.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const holdingViews: BondHoldingView[] = holdings.map((holding) => {
    const instrument = instruments.find((candidate) => candidate.key === holding.bondKey);
    const priceMinor = instrument?.priceMinor ?? BOND_FACE_MINOR;
    const valueMinor = priceMinor * BigInt(holding.quantity);
    const monthlyCouponMinor =
      (instrument?.monthlyCouponMinor ?? couponPerBondMinor(0)) * BigInt(holding.quantity);
    return {
      bondKey: holding.bondKey,
      name: instrument?.name ?? holding.bondKey,
      rating: instrument?.rating ?? "—",
      quantity: holding.quantity,
      costMinor: holding.costMinor,
      avgCostMinor: holding.costMinor / BigInt(holding.quantity),
      priceMinor,
      valueMinor,
      unrealizedMinor: valueMinor - holding.costMinor,
      monthsLeft: instrument?.monthsLeft ?? 0,
      monthlyCouponMinor,
      yieldBp: instrument?.yieldBp ?? 0,
      currentYieldBp: instrument ? currentYieldBp(instrument) : 0,
    };
  });

  const tradeViews: BondTradeView[] = trades.map((trade) => ({
    id: trade.id,
    bondKey: trade.bondKey,
    name: bondLine(trade.bondKey)?.name ?? trade.bondKey,
    side: trade.side,
    quantity: trade.quantity,
    priceMinor: trade.priceMinor,
    grossMinor: trade.grossMinor,
    feeMinor: trade.feeMinor,
    netMinor: trade.netMinor,
    tick: trade.tick,
    createdAt: trade.createdAt.getTime(),
  }));

  return {
    tick: game.tick,
    cashMinor: portfolio.cashMinor,
    instruments,
    holdings: holdingViews,
    trades: tradeViews,
    bondValueMinor: holdingViews.reduce((total, row) => total + row.valueMinor, 0n),
    monthlyCouponMinor: holdingViews.reduce((total, row) => total + row.monthlyCouponMinor, 0n),
    unrealizedMinor: holdingViews.reduce((total, row) => total + row.unrealizedMinor, 0n),
  };
}

