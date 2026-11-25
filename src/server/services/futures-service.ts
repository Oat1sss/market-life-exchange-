/**
 * Futures service: leveraged long/short positions on the seeded crypto (and
 * any other) assets. Opening moves margin + open fee out of cash; closing
 * returns margin + P&L − close fee. Liquidation happens inside advance when
 * equity reaches zero, so a position can never owe more than its margin.
 *
 * All amounts are bigint minor units and every cash movement appends ledger
 * rows in the same transaction.
 */
import { Prisma } from "@/generated/prisma/index";
import { prisma } from "@/server/db";
import {
  closePayoutMinor,
  equityMinor,
  futuresPnlMinor,
  isLiquidatable,
  liquidationPriceMinor,
  marginFor,
  MAX_LEVERAGE,
  MIN_LEVERAGE,
  notionalMinor,
  type FuturesSide as FuturesSideValue,
} from "@/domain/futures";
import { feeSell } from "./trade-fill";
import { appendLedgerRun } from "./ledger";

type Tx = Prisma.TransactionClient;

export class FuturesError extends Error {
  constructor(
    public code:
      | "NO_GAME"
      | "GAME_OVER"
      | "UNKNOWN_ASSET"
      | "BAD_QUANTITY"
      | "BAD_LEVERAGE"
      | "INSUFFICIENT_MARGIN"
      | "NOT_OPEN",
    message: string,
  ) {
    super(message);
  }
}

export interface OpenFuturesInput {
  symbol: string;
  side: FuturesSideValue;
  quantity: number;
  leverage: number;
  stopLossMinor?: bigint | null;
  takeProfitMinor?: bigint | null;
  idempotencyKey: string;
}

async function findGameForUpdate(tx: Tx, userId: string) {
  const game = await tx.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!game) throw new FuturesError("NO_GAME", "Buat karakter terlebih dahulu.");
  await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;
  return game;
}

type PriceReader = {
  pricePoint: Tx["pricePoint"];
  asset: Tx["asset"];
};

async function markPrice(tx: PriceReader, gameId: string, assetId: string): Promise<bigint> {
  const point = await tx.pricePoint.findFirst({
    where: { gameId, assetId },
    orderBy: { tick: "desc" },
  });
  if (point) return point.priceMinor;
  const asset = await tx.asset.findUniqueOrThrow({ where: { id: assetId } });
  return asset.fundamentalMinor;
}

export async function openFutures(
  userId: string,
  input: OpenFuturesInput,
): Promise<{ positionId: string; replayed: boolean }> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 100_000) {
    throw new FuturesError("BAD_QUANTITY", "Jumlah kontrak harus bilangan bulat positif.");
  }
  if (
    !Number.isInteger(input.leverage) ||
    input.leverage < MIN_LEVERAGE ||
    input.leverage > MAX_LEVERAGE
  ) {
    throw new FuturesError("BAD_LEVERAGE", `Leverage harus ${MIN_LEVERAGE}–${MAX_LEVERAGE}x.`);
  }
  if (input.side !== "LONG" && input.side !== "SHORT") {
    throw new FuturesError("BAD_QUANTITY", "Pilih arah LONG atau SHORT.");
  }

  return prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);
    if (game.status !== "ACTIVE") {
      throw new FuturesError("GAME_OVER", "Permainan ini sudah berakhir.");
    }

    const existing = await tx.futuresPosition.findUnique({
      where: {
        gameId_idempotencyKey: {
          gameId: game.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { positionId: existing.id, replayed: true };

    const asset = await tx.asset.findUnique({ where: { symbol: input.symbol } });
    if (!asset) throw new FuturesError("UNKNOWN_ASSET", "Simbol aset tidak dikenal.");

    const price = await markPrice(tx, game.id, asset.id);
    const stopLoss = input.stopLossMinor ?? null;
    const takeProfit = input.takeProfitMinor ?? null;
    if (stopLoss !== null && stopLoss <= 0n) {
      throw new FuturesError("BAD_QUANTITY", "Stop-loss harus lebih dari nol.");
    }
    if (takeProfit !== null && takeProfit <= 0n) {
      throw new FuturesError("BAD_QUANTITY", "Take-profit harus lebih dari nol.");
    }
    if (input.side === "LONG") {
      if (stopLoss !== null && stopLoss >= price) {
        throw new FuturesError("BAD_QUANTITY", "Stop-loss LONG harus di bawah harga masuk.");
      }
      if (takeProfit !== null && takeProfit <= price) {
        throw new FuturesError("BAD_QUANTITY", "Take-profit LONG harus di atas harga masuk.");
      }
    } else {
      if (stopLoss !== null && stopLoss <= price) {
        throw new FuturesError("BAD_QUANTITY", "Stop-loss SHORT harus di atas harga masuk.");
      }
      if (takeProfit !== null && takeProfit >= price) {
        throw new FuturesError("BAD_QUANTITY", "Take-profit SHORT harus di bawah harga masuk.");
      }
    }

    const notional = notionalMinor(price, input.quantity);
    const margin = marginFor(notional, input.leverage);
    const openFee = feeSell(notional);
    const required = margin + openFee;

    const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });
    if (portfolio.cashMinor < required) {
      throw new FuturesError(
        "INSUFFICIENT_MARGIN",
        "Saldo tidak cukup untuk margin dan biaya posisi ini.",
      );
    }

    const position = await tx.futuresPosition.create({
      data: {
        gameId: game.id,
        assetId: asset.id,
        side: input.side,
        quantity: input.quantity,
        leverage: input.leverage,
        entryPriceMinor: price,
        stopLossMinor: stopLoss,
        takeProfitMinor: takeProfit,
        marginMinor: margin,
        openFeeMinor: openFee,
        openedTick: game.tick,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const updated = await tx.portfolio.update({
      where: { id: portfolio.id },
      data: { cashMinor: { decrement: required } },
    });
    await appendLedgerRun(tx, game.id, [
      {
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "DEBIT",
        amountMinor: margin,
        balanceAfterMinor: portfolio.cashMinor - margin,
        reason: "FUTURES_MARGIN",
        refType: "FUTURES",
        refId: position.id,
        tick: game.tick,
      },
      {
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "DEBIT",
        amountMinor: openFee,
        balanceAfterMinor: updated.cashMinor,
        reason: "FEE",
        refType: "FUTURES",
        refId: position.id,
        tick: game.tick,
      },
    ]);

    return { positionId: position.id, replayed: false };
  }, { timeout: 20_000 });
}

export interface CloseFuturesResult {
  payoutMinor: bigint;
  realizedMinor: bigint;
  liquidated: boolean;
}

export async function closeFutures(
  userId: string,
  positionId: string,
): Promise<CloseFuturesResult> {
  return prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);
    const position = await tx.futuresPosition.findFirst({
      where: { id: positionId, gameId: game.id, status: "OPEN" },
      include: { asset: true },
    });
    if (!position) throw new FuturesError("NOT_OPEN", "Posisi ini tidak sedang terbuka.");

    const mark = await markPrice(tx, game.id, position.assetId);
    const pnl = futuresPnlMinor(
      position.side,
      position.entryPriceMinor,
      mark,
      position.quantity,
    );
    const closeFee = feeSell(mark * BigInt(position.quantity));
    const payout = closePayoutMinor(position.marginMinor, pnl, closeFee);
    const liquidated = payout === 0n && isLiquidatable(position.marginMinor, pnl);
    const realized = payout - position.marginMinor - position.openFeeMinor;

    await tx.futuresPosition.update({
      where: { id: position.id },
      data: {
        status: liquidated ? "LIQUIDATED" : "CLOSED",
        closedTick: game.tick,
        closeFeeMinor: closeFee,
        realizedMinor: realized,
      },
    });

    if (payout > 0n) {
      const updated = await tx.portfolio.update({
        where: { gameId: game.id },
        data: { cashMinor: { increment: payout } },
      });
      await appendLedgerRun(tx, game.id, [
        {
          portfolioId: updated.id,
          account: "CASH",
          direction: "CREDIT",
          amountMinor: payout,
          balanceAfterMinor: updated.cashMinor,
          reason: "FUTURES_PNL",
          refType: "FUTURES",
          refId: position.id,
          tick: game.tick,
        },
      ]);
    }

    return { payoutMinor: payout, realizedMinor: realized, liquidated };
  }, { timeout: 20_000 });
}

/**
 * Mark-to-market liquidation called from advanceGame after fresh prices exist.
 * Losing the whole margin means no cash movement, so only the position row is
 * updated. Returns the number of liquidated positions.
 */
export async function settleFutures(
  tx: Tx,
  gameId: string,
  tick: number,
  prices: Map<string, bigint>,
): Promise<number> {
  const open = await tx.futuresPosition.findMany({ where: { gameId, status: "OPEN" } });
  let liquidated = 0;
  for (const position of open) {
    const mark = prices.get(position.assetId);
    if (mark === undefined) continue;
    const pnl = futuresPnlMinor(position.side, position.entryPriceMinor, mark, position.quantity);
    if (isLiquidatable(position.marginMinor, pnl)) {
      await tx.futuresPosition.update({
        where: { id: position.id },
        data: {
          status: "LIQUIDATED",
          closedTick: tick,
          closeFeeMinor: 0n,
          realizedMinor: -position.marginMinor - position.openFeeMinor,
        },
      });
      liquidated += 1;
      continue;
    }

    const slHit =
      position.stopLossMinor !== null &&
      (position.side === "LONG"
        ? mark <= position.stopLossMinor
        : mark >= position.stopLossMinor);
    const tpHit =
      position.takeProfitMinor !== null &&
      (position.side === "LONG"
        ? mark >= position.takeProfitMinor
        : mark <= position.takeProfitMinor);

    if (slHit || tpHit) {
      const closeFee = feeSell(mark * BigInt(position.quantity));
      const payout = closePayoutMinor(position.marginMinor, pnl, closeFee);
      const realized = payout - position.marginMinor - position.openFeeMinor;

      await tx.futuresPosition.update({
        where: { id: position.id },
        data: {
          status: "CLOSED",
          closedTick: tick,
          closeFeeMinor: closeFee,
          realizedMinor: realized,
        },
      });

      if (payout > 0n) {
        const updated = await tx.portfolio.update({
          where: { gameId },
          data: { cashMinor: { increment: payout } },
        });
        await appendLedgerRun(tx, gameId, [
          {
            portfolioId: updated.id,
            account: "CASH",
            direction: "CREDIT",
            amountMinor: payout,
            balanceAfterMinor: updated.cashMinor,
            reason: "FUTURES_PNL",
            refType: "FUTURES",
            refId: position.id,
            tick,
          },
        ]);
      }
    }
  }
  return liquidated;
}

export interface FuturesPositionView {
  id: string;
  symbol: string;
  name: string;
  side: FuturesSideValue;
  quantity: number;
  leverage: number;
  entryPriceMinor: bigint;
  stopLossMinor: bigint | null;
  takeProfitMinor: bigint | null;
  markPriceMinor: bigint;
  marginMinor: bigint;
  openFeeMinor: bigint;
  pnlMinor: bigint;
  equityMinor: bigint;
  liquidationPriceMinor: bigint;
  notionalMinor: bigint;
  status: string;
  openedTick: number;
}

export interface FuturesSnapshot {
  positions: FuturesPositionView[];
  history: FuturesPositionView[];
  marginMinor: bigint;
  unrealizedMinor: bigint;
  equityMinor: bigint;
}

function toView(
  position: Prisma.FuturesPositionGetPayload<{ include: { asset: true } }>,
  mark: bigint,
): FuturesPositionView {
  const pnl = futuresPnlMinor(position.side, position.entryPriceMinor, mark, position.quantity);
  return {
    id: position.id,
    symbol: position.asset.symbol,
    name: position.asset.name,
    side: position.side,
    quantity: position.quantity,
    leverage: position.leverage,
    entryPriceMinor: position.entryPriceMinor,
    stopLossMinor: position.stopLossMinor,
    takeProfitMinor: position.takeProfitMinor,
    markPriceMinor: mark,
    marginMinor: position.marginMinor,
    openFeeMinor: position.openFeeMinor,
    pnlMinor: pnl,
    equityMinor: equityMinor(position.marginMinor, pnl),
    liquidationPriceMinor: liquidationPriceMinor(
      position.side,
      position.entryPriceMinor,
      position.leverage,
    ),
    notionalMinor: position.entryPriceMinor * BigInt(position.quantity),
    status: position.status,
    openedTick: position.openedTick,
  };
}

export async function futuresSnapshot(userId: string): Promise<FuturesSnapshot | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!game) return null;

  const [open, closed] = await Promise.all([
    prisma.futuresPosition.findMany({
      where: { gameId: game.id, status: "OPEN" },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.futuresPosition.findMany({
      where: { gameId: game.id, status: { in: ["CLOSED", "LIQUIDATED"] } },
      include: { asset: true },
      orderBy: { closedTick: "desc" },
      take: 10,
    }),
  ]);

  const marks = new Map<string, bigint>();
  const assetIds = new Set([...open, ...closed].map((position) => position.assetId));
  for (const assetId of assetIds) {
    marks.set(assetId, await markPrice(prisma, game.id, assetId));
  }

  const positions = open.map((position) =>
    toView(position, marks.get(position.assetId) ?? position.entryPriceMinor),
  );
  const history = closed.map((position) =>
    toView(position, marks.get(position.assetId) ?? position.entryPriceMinor),
  );

  return {
    positions,
    history,
    marginMinor: positions.reduce((total, position) => total + position.marginMinor, 0n),
    unrealizedMinor: positions.reduce((total, position) => total + position.pnlMinor, 0n),
    equityMinor: positions.reduce((total, position) => total + position.equityMinor, 0n),
  };
}
