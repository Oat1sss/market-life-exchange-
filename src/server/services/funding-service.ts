/**
 * Simulated fiat/crypto on-ramp for the demo wallet. No external provider is
 * involved: a deposit immediately credits demo cash, appends a DEPOSIT ledger
 * row, and is idempotent per client-supplied key.
 */
import { prisma } from "@/server/db";
import { depositFeeMinor, depositMethod } from "@/domain/funding";
import { appendLedgerRun } from "./ledger";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FundingError extends Error {
  constructor(
    public code:
      | "NO_GAME"
      | "BAD_METHOD"
      | "BAD_AMOUNT"
      | "BAD_KEY"
      | "LIMIT",
    message: string,
  ) {
    super(message);
    this.name = "FundingError";
  }
}

export interface DepositInput {
  amountMinor: bigint;
  method: string;
  idempotencyKey: string;
}

export interface DepositResult {
  balanceMinor: bigint;
  creditedMinor: bigint;
  feeMinor: bigint;
  duplicate: boolean;
}

export async function depositFunds(
  userId: string,
  input: DepositInput,
): Promise<DepositResult> {
  const method = depositMethod(input.method);
  if (!method) {
    throw new FundingError("BAD_METHOD", "Pilih metode deposit yang tersedia.");
  }
  if (input.amountMinor <= 0n) {
    throw new FundingError("BAD_AMOUNT", "Nominal deposit harus lebih dari nol.");
  }
  if (
    input.amountMinor < method.minMinor ||
    input.amountMinor > method.maxMinor
  ) {
    throw new FundingError(
      "LIMIT",
      `Nominal untuk ${method.label} harus antara ${(Number(method.minMinor) / 100).toLocaleString("id-ID")} dan ${(Number(method.maxMinor) / 100).toLocaleString("id-ID")} CR.`,
    );
  }
  if (!UUID_PATTERN.test(input.idempotencyKey)) {
    throw new FundingError("BAD_KEY", "Permintaan deposit tidak valid.");
  }

  const feeMinor = depositFeeMinor(input.amountMinor, method.feeBp);
  const creditedMinor = input.amountMinor - feeMinor;
  const refType = `DEPOSIT_${method.key}`;

  return prisma.$transaction(
    async (tx) => {
      const game = await tx.game.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        include: { portfolio: true },
      });
      if (!game?.portfolio) {
        throw new FundingError("NO_GAME", "Buat akun demo terlebih dahulu.");
      }
      await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;

      const existing = await tx.ledgerEntry.findFirst({
        where: { gameId: game.id, refType, refId: input.idempotencyKey },
      });
      if (existing) {
        const portfolio = await tx.portfolio.findUniqueOrThrow({
          where: { id: game.portfolio.id },
        });
        return {
          balanceMinor: portfolio.cashMinor,
          creditedMinor: existing.amountMinor,
          feeMinor:
            depositFeeMinor(input.amountMinor, method.feeBp),
          duplicate: true,
        };
      }

      const updated = await tx.portfolio.update({
        where: { id: game.portfolio.id },
        data: { cashMinor: { increment: creditedMinor } },
      });

      await appendLedgerRun(tx, game.id, [
        {
          portfolioId: game.portfolio.id,
          account: "CASH",
          direction: "CREDIT",
          amountMinor: creditedMinor,
          balanceAfterMinor: updated.cashMinor,
          reason: "DEPOSIT",
          refType,
          refId: input.idempotencyKey,
          tick: game.tick,
        },
      ]);

      return {
        balanceMinor: updated.cashMinor,
        creditedMinor,
        feeMinor,
        duplicate: false,
      };
    },
    { timeout: 20_000 },
  );
}

export interface DepositHistoryRow {
  id: string;
  method: string;
  amountMinor: bigint;
  balanceAfterMinor: bigint;
  createdAt: Date;
}

export async function depositHistory(
  userId: string,
  limit = 8,
): Promise<DepositHistoryRow[]> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!game) return [];

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      gameId: game.id,
      reason: "DEPOSIT",
      refType: { startsWith: "DEPOSIT_" },
    },
    orderBy: { sequence: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    method: row.refType.replace("DEPOSIT_", ""),
    amountMinor: row.amountMinor,
    balanceAfterMinor: row.balanceAfterMinor,
    createdAt: row.createdAt,
  }));
}
