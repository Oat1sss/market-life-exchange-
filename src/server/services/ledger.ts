/**
 * Ledger appendix helpers shared by game-service and trade-service. The
 * sequence is allocated inside the caller's transaction; rows are append-only
 * and must satisfy: sum(amount * sign) over CASH rows == portfolio cash.
 */
import { Prisma, type LedgerReason } from "@/generated/prisma/index";

type Tx = Prisma.TransactionClient;

export type { LedgerReason };

export interface LedgerDraft {
  gameId: string;
  portfolioId: string;
  account: "CASH" | "ASSET";
  assetId?: string | null;
  direction: "DEBIT" | "CREDIT";
  amountMinor: bigint;
  balanceAfterMinor: bigint;
  reason: LedgerReason;
  refType: string;
  refId: string;
  tick: number;
}

export async function nextSequence(tx: Tx, gameId: string): Promise<number> {
  const result = await tx.ledgerEntry.aggregate({
    where: { gameId },
    _max: { sequence: true },
  });
  return (result._max.sequence ?? 0) + 1;
}

export async function appendLedger(
  tx: Tx,
  draft: LedgerDraft,
  sequence: number,
): Promise<void> {
  await tx.ledgerEntry.create({
    data: {
      gameId: draft.gameId,
      portfolioId: draft.portfolioId,
      sequence,
      account: draft.account,
      assetId: draft.assetId ?? null,
      direction: draft.direction,
      amountMinor: draft.amountMinor,
      balanceAfterMinor: draft.balanceAfterMinor,
      reason: draft.reason,
      refType: draft.refType,
      refId: draft.refId,
      tick: draft.tick,
    },
  });
}

/** Append a run of rows, auto-sequencing from the current max. */
export async function appendLedgerRun(
  tx: Tx,
  gameId: string,
  drafts: Array<Omit<LedgerDraft, "gameId">>,
): Promise<void> {
  let sequence = await nextSequence(tx, gameId);
  for (const draft of drafts) {
    await appendLedger(tx, { ...draft, gameId }, sequence++);
  }
}
