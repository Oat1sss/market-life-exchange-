/**
 * Forex spot trading. Currency balances are bought and sold with the same
 * gameplay cash account as stocks and crypto, and every fill is written to the
 * shared ledger. Quotes come from the deterministic forex market, so the price
 * a trade receives matches the pair shown on the forex page.
 */
import { Prisma } from "@/generated/prisma/index";
import { prisma } from "@/server/db";
import {
  FOREX_PAIRS,
  forexCrossRates,
  forexExecutionRate,
  forexQuotes,
  type ForexCurrency,
  type ForexPairDefinition,
} from "@/domain/forex";
import { feeBuy, feeSell } from "./trade-fill";
import { appendLedgerRun } from "./ledger";

type Tx = Prisma.TransactionClient;

export class ForexError extends Error {
  constructor(
    public code:
      | "NO_GAME"
      | "UNKNOWN_PAIR"
      | "BAD_UNITS"
      | "INSUFFICIENT_FUNDS"
      | "OVERSELL",
    message: string,
  ) {
    super(message);
  }
}

export interface ForexHoldingView {
  currency: string;
  pair: string;
  units: bigint;
  averageRateMinor: bigint;
  currentRateMinor: bigint;
  valueMinor: bigint;
  unrealizedMinor: bigint;
}

export interface ForexTradeView {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  units: bigint;
  rateMinor: bigint;
  netMinor: bigint;
  tick: number;
}

export interface ForexSnapshot {
  cashMinor: bigint;
  holdings: ForexHoldingView[];
  holdingsValueMinor: bigint;
  trades: ForexTradeView[];
}

/** Rupiah per one unit of the pair's base currency, including its spread. */
function idrRateFor(
  pair: ForexPairDefinition,
  cross: Record<ForexCurrency, number>,
  side: "BUY" | "SELL",
  units: number,
): bigint {
  const rate = forexExecutionRate(pair.symbol, cross, side, units);
  return BigInt(Math.max(1, Math.round(rate * 100)));
}

function quoteMidRate(
  pair: ForexPairDefinition,
  cross: Record<ForexCurrency, number>,
): bigint {
  const mid = cross[pair.base as ForexCurrency] ?? 0;
  const halfSpread = pair.spreadBp / 10_000;
  return BigInt(Math.max(1, Math.round(mid * (1 - halfSpread) * 100)));
}

export async function forexSnapshot(userId: string): Promise<ForexSnapshot | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, seed: true, tick: true, portfolio: { select: { cashMinor: true } } },
  });
  if (!game?.portfolio) return null;

  const [rows, trades] = await Promise.all([
    prisma.forexHolding.findMany({
      where: { gameId: game.id },
      orderBy: { currency: "asc" },
    }),
    prisma.forexTrade.findMany({
      where: { gameId: game.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const quotes = forexQuotes(game.seed, game.tick);
  const cross = forexCrossRates(quotes);
  const pairByCurrency = new Map<string, ForexPairDefinition>();
  for (const pair of FOREX_PAIRS) {
    if (!pairByCurrency.has(pair.base)) pairByCurrency.set(pair.base, pair);
  }

  const holdings: ForexHoldingView[] = rows.map((row) => {
    const pair =
      pairByCurrency.get(row.currency) ??
      FOREX_PAIRS.find((candidate) => candidate.symbol === "USD/IDR")!;
    const currentRateMinor = quoteMidRate(pair, cross);
    const valueMinor = currentRateMinor * row.units;
    return {
      currency: row.currency,
      pair: pair.symbol,
      units: row.units,
      averageRateMinor: row.averageRateMinor,
      currentRateMinor,
      valueMinor,
      unrealizedMinor: valueMinor - row.averageRateMinor * row.units,
    };
  });

  return {
    cashMinor: game.portfolio.cashMinor,
    holdings,
    holdingsValueMinor: holdings.reduce((total, row) => total + row.valueMinor, 0n),
    trades: trades.map((trade) => ({
      id: trade.id,
      pair: trade.pair,
      side: trade.side,
      units: trade.units,
      rateMinor: trade.rateMinor,
      netMinor: trade.netMinor,
      tick: trade.tick,
    })),
  };
}

export interface TradeForexInput {
  pair: string;
  side: "BUY" | "SELL";
  units: number;
  idempotencyKey: string;
}

export async function tradeForex(
  userId: string,
  input: TradeForexInput,
): Promise<{ tradeId: string; replayed: boolean; rateMinor: bigint }> {
  if (!Number.isInteger(input.units) || input.units <= 0 || input.units > 1_000_000_000) {
    throw new ForexError("BAD_UNITS", "Jumlah unit harus bilangan bulat positif.");
  }

  const pair = FOREX_PAIRS.find((candidate) => candidate.symbol === input.pair);
  if (!pair) throw new ForexError("UNKNOWN_PAIR", "Pasangan valas tidak dikenal.");

  return prisma.$transaction(
    async (tx) => {
      const game = await tx.game.findFirst({
        where: { userId, status: "ACTIVE" },
        select: { id: true, seed: true, tick: true },
      });
      if (!game) throw new ForexError("NO_GAME", "Buat karakter dulu.");
      await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;

      const existing = await tx.forexTrade.findUnique({
        where: {
          gameId_idempotencyKey: {
            gameId: game.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        return { tradeId: existing.id, replayed: true, rateMinor: existing.rateMinor };
      }

      const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });
      const quotes = forexQuotes(game.seed, game.tick);
      const cross = forexCrossRates(quotes);
      const rateMinor = idrRateFor(pair, cross, input.side, input.units);
      if (rateMinor <= 0n) throw new ForexError("UNKNOWN_PAIR", "Kurs tidak tersedia.");

      const units = BigInt(input.units);
      const grossMinor = rateMinor * units;
      const feeMinor =
        input.side === "BUY" ? feeBuy(grossMinor) : feeSell(grossMinor);
      const netMinor = input.side === "BUY" ? grossMinor + feeMinor : grossMinor - feeMinor;
      const holding = await tx.forexHolding.findUnique({
        where: {
          gameId_currency: { gameId: game.id, currency: pair.base },
        },
      });

      if (input.side === "BUY") {
        const debited = await tx.portfolio.updateMany({
          where: { id: portfolio.id, cashMinor: { gte: netMinor } },
          data: { cashMinor: { decrement: netMinor } },
        });
        if (debited.count === 0) {
          throw new ForexError("INSUFFICIENT_FUNDS", "Saldo rupiah tidak cukup.");
        }

        const previousUnits = holding?.units ?? 0n;
        const previousBasis = (holding?.averageRateMinor ?? 0n) * previousUnits;
        const newUnits = previousUnits + units;
        const newBasis = previousBasis + grossMinor;
        const averageRateMinor = newBasis / newUnits;

        const saved = holding
          ? await tx.forexHolding.update({
              where: { id: holding.id },
              data: { units: newUnits, averageRateMinor },
            })
          : await tx.forexHolding.create({
              data: {
                gameId: game.id,
                currency: pair.base,
                units: newUnits,
                averageRateMinor,
              },
            });

        const trade = await tx.forexTrade.create({
          data: {
            gameId: game.id,
            pair: pair.symbol,
            currency: pair.base,
            side: "BUY",
            units,
            rateMinor,
            grossMinor,
            feeMinor,
            netMinor,
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
            amountMinor: netMinor,
            balanceAfterMinor: after.cashMinor,
            reason: "TRADE_BUY",
            refType: "FOREX_TRADE",
            refId: trade.id,
            tick: game.tick,
          },
          {
            portfolioId: portfolio.id,
            account: "ASSET",
            direction: "CREDIT",
            amountMinor: grossMinor,
            balanceAfterMinor: newBasis,
            reason: "TRADE_BUY",
            refType: "FOREX",
            refId: saved.id,
            tick: game.tick,
          },
        ]);

        return { tradeId: trade.id, replayed: false, rateMinor };
      }

      if (!holding || holding.units < units) {
        throw new ForexError("OVERSELL", "Saldo valas tidak cukup.");
      }

      const remainingUnits = holding.units - units;
      const basisSold = holding.averageRateMinor * units;
      const remainingBasis = holding.averageRateMinor * remainingUnits;

      if (remainingUnits === 0n) {
        await tx.forexHolding.delete({ where: { id: holding.id } });
      } else {
        await tx.forexHolding.update({
          where: { id: holding.id },
          data: { units: remainingUnits },
        });
      }
      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: { cashMinor: { increment: netMinor } },
      });

      const trade = await tx.forexTrade.create({
        data: {
          gameId: game.id,
          pair: pair.symbol,
          currency: pair.base,
          side: "SELL",
          units,
          rateMinor,
          grossMinor,
          feeMinor,
          netMinor,
          tick: game.tick,
          idempotencyKey: input.idempotencyKey,
        },
      });

      const after = await tx.portfolio.findUniqueOrThrow({ where: { id: portfolio.id } });
      await appendLedgerRun(tx, game.id, [
        {
          portfolioId: portfolio.id,
          account: "ASSET",
          direction: "DEBIT",
          amountMinor: basisSold,
          balanceAfterMinor: remainingBasis,
          reason: "TRADE_SELL",
          refType: "FOREX",
          refId: holding.id,
          tick: game.tick,
        },
        {
          portfolioId: portfolio.id,
          account: "CASH",
          direction: "CREDIT",
          amountMinor: netMinor,
          balanceAfterMinor: after.cashMinor,
          reason: "TRADE_SELL",
          refType: "FOREX_TRADE",
          refId: trade.id,
          tick: game.tick,
        },
      ]);

      return { tradeId: trade.id, replayed: false, rateMinor };
    },
    { timeout: 20_000 },
  );
}

export type { Tx };
