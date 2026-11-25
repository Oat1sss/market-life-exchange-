/**
 * Shared fill arithmetic for market orders and resting limits. Buy legs pay
 * 0.10% of notional (min 1 credit) + a fixed 0.50 credit platform fee; sells
 * pay only the percentage fee. Cost basis moves at the running average (docs/
 * DATABASE.md §avg-cost), so partial sells never re-price the rest.
 */
import { Prisma } from "@/generated/prisma/index";
import { appendLedgerRun } from "./ledger";

type Tx = Prisma.TransactionClient;

export const FEE_RATE_NUMERATOR = 10n; // 0.10% = 10bp
export const FEE_MIN = 100n; // 1 credit
export const PLATFORM_FEE = 50n; // 0.50 credit, buys only

export function feeBuy(grossMinor: bigint): bigint {
  const dynamic = ceilDiv(grossMinor * FEE_RATE_NUMERATOR, 10_000n);
  return (dynamic < FEE_MIN ? FEE_MIN : dynamic) + PLATFORM_FEE;
}

export function feeSell(grossMinor: bigint): bigint {
  const dynamic = ceilDiv(grossMinor * FEE_RATE_NUMERATOR, 10_000n);
  return dynamic < FEE_MIN ? FEE_MIN : dynamic;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

export interface FillContext {
  gameId: string;
  portfolioId: string;
  orderId: string;
  assetId: string;
  quantity: number;
  priceMinor: bigint;
  tick: number;
}

export class FillError extends Error {
  constructor(public code: "INSUFFICIENT_FUNDS" | "OVERSELL") {
    super(code);
  }
}

/** Debit cash and grow the holding; throws OVERSELL never, INSUFFICIENT yes. */
export async function fillBuy(tx: Tx, ctx: FillContext): Promise<void> {
  const gross = ctx.priceMinor * BigInt(ctx.quantity);
  const fee = feeBuy(gross);
  const net = gross + fee;

  const updated = await tx.portfolio.updateMany({
    where: { id: ctx.portfolioId, cashMinor: { gte: net } },
    data: { cashMinor: { decrement: net } },
  });
  if (updated.count === 0) {
    throw new FillError("INSUFFICIENT_FUNDS");
  }

  const holding = await tx.holding.findUnique({
    where: { portfolioId_assetId: { portfolioId: ctx.portfolioId, assetId: ctx.assetId } },
  });
  const previousQty = holding?.quantity ?? 0;
  const previousBasis = (holding?.averageCostMinor ?? 0n) * BigInt(previousQty);
  const newQty = previousQty + ctx.quantity;
  const newBasis = previousBasis + gross;
  const newAverage = newBasis / BigInt(newQty); // floor per docs

  if (holding) {
    await tx.holding.update({
      where: { id: holding.id },
      data: { quantity: newQty, averageCostMinor: newAverage },
    });
  } else {
    await tx.holding.create({
      data: {
        portfolioId: ctx.portfolioId,
        assetId: ctx.assetId,
        quantity: newQty,
        averageCostMinor: newAverage,
      },
    });
  }

  const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { id: ctx.portfolioId } });
  await appendLedgerRun(tx, ctx.gameId, [
    {
      portfolioId: ctx.portfolioId, account: "CASH", direction: "DEBIT",
      amountMinor: net, balanceAfterMinor: portfolio.cashMinor,
      reason: "TRADE_BUY", refType: "ORDER", refId: ctx.orderId, tick: ctx.tick,
    },
    {
      portfolioId: ctx.portfolioId, account: "ASSET", assetId: ctx.assetId,
      direction: "CREDIT", amountMinor: gross, balanceAfterMinor: newBasis,
      reason: "TRADE_BUY", refType: "ORDER", refId: ctx.orderId, tick: ctx.tick,
    },
  ]);

  await tx.order.update({
    where: { id: ctx.orderId },
    data: {
      status: "FILLED",
      fillPriceMinor: ctx.priceMinor,
      grossMinor: gross,
      feeMinor: fee,
      netMinor: net,
      tickResolved: ctx.tick,
    },
  });
}

/** Lock, cover, and shrink the holding; realized = proceeds − basis sold. */
export async function fillSell(tx: Tx, ctx: FillContext): Promise<{ realizedMinor: bigint }> {
  const holding = await tx.holding.findUnique({
    where: { portfolioId_assetId: { portfolioId: ctx.portfolioId, assetId: ctx.assetId } },
  });
  if (!holding || holding.quantity < ctx.quantity) {
    throw new FillError("OVERSELL");
  }

  const gross = ctx.priceMinor * BigInt(ctx.quantity);
  const fee = feeSell(gross);
  const net = gross - fee;
  const basisSold = holding.averageCostMinor * BigInt(ctx.quantity);
  const remainingQty = holding.quantity - ctx.quantity;
  const remainingBasis = holding.averageCostMinor * BigInt(remainingQty);
  const realized = net - basisSold;

  if (remainingQty === 0) {
    await tx.holding.delete({ where: { id: holding.id } });
  } else {
    await tx.holding.update({
      where: { id: holding.id },
      data: { quantity: remainingQty },
    });
  }

  const portfolio = await tx.portfolio.update({
    where: { id: ctx.portfolioId },
    data: {
      cashMinor: { increment: net },
    },
  });
  const cashAfter = portfolio.cashMinor;
  await appendLedgerRun(tx, ctx.gameId, [
    {
      portfolioId: ctx.portfolioId, account: "ASSET", assetId: ctx.assetId,
      direction: "DEBIT", amountMinor: basisSold, balanceAfterMinor: remainingBasis,
      reason: "TRADE_SELL", refType: "ORDER", refId: ctx.orderId, tick: ctx.tick,
    },
    {
      portfolioId: ctx.portfolioId, account: "CASH", direction: "CREDIT",
      amountMinor: net, balanceAfterMinor: cashAfter,
      reason: "TRADE_SELL", refType: "ORDER", refId: ctx.orderId, tick: ctx.tick,
    },
  ]);

  await tx.order.update({
    where: { id: ctx.orderId },
    data: {
      status: "FILLED",
      fillPriceMinor: ctx.priceMinor,
      grossMinor: gross,
      feeMinor: fee,
      netMinor: net,
      tickResolved: ctx.tick,
    },
  });

  return { realizedMinor: realized };
}

export type { Prisma };
