/**
 * Company control service: turns a large enough stake into board decisions.
 *
 * Directives are stored as replay inputs (see src/domain/economy/directives.ts)
 * and applied by `simulateWorld`, so the effect is identical on the economy
 * page, in the price model and in `advanceGame`. Only the dividend cash credit
 * is a player-level event, recorded once with its own idempotency key.
 */
import { Prisma } from "@/generated/prisma/index";
import { prisma } from "@/server/db";
import {
  DIRECTIVE_BY_KIND,
  DIRECTIVE_COOLDOWN_MONTHS,
  canIssue,
  dividendPayout,
  economySnapshot,
  isDirectiveKind,
  stakePct,
  type DirectiveInput,
  type DirectiveKind,
  type World,
} from "@/domain/economy";
import { appendLedgerRun } from "./ledger";

type Tx = Prisma.TransactionClient;

export class ControlError extends Error {
  constructor(
    public code:
      | "NO_GAME"
      | "GAME_OVER"
      | "UNKNOWN_COMPANY"
      | "UNKNOWN_ACTION"
      | "NO_STAKE"
      | "TIER_TOO_LOW"
      | "COOLDOWN"
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
  status: string;
  startDate: Date;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Directives for one game, ready to feed into `economySnapshot`, plus the raw
 * rows the UI shows as board minutes.
 */
export async function loadDirectives(gameId: string): Promise<{
  inputs: DirectiveInput[];
  rows: Array<{
    id: string;
    companySymbol: string;
    kind: DirectiveKind;
    atMonth: number;
    payoutMinor: bigint;
    playerPayoutMinor: bigint;
    createdAt: number;
  }>;
}> {
  const rows = await prisma.companyDirective.findMany({
    where: { gameId },
    orderBy: [{ atMonth: "asc" }, { createdAt: "asc" }],
  });
  return {
    inputs: rows.map((row) => ({
      companySymbol: row.companySymbol,
      kind: row.kind,
      atMonth: row.atMonth,
      payoutMinor: row.payoutMinor,
    })),
    rows: rows.map((row) => ({
      id: row.id,
      companySymbol: row.companySymbol,
      kind: row.kind,
      atMonth: row.atMonth,
      payoutMinor: row.payoutMinor,
      playerPayoutMinor: row.playerPayoutMinor,
      createdAt: row.createdAt.getTime(),
    })),
  };
}

async function worldAt(
  db: Tx | typeof prisma,
  game: GameRow,
  directives: DirectiveInput[],
): Promise<World> {
  const assets = await db.asset.findMany({ where: { kind: "STOCK" }, orderBy: { symbol: "asc" } });
  return economySnapshot({
    seed: game.seed,
    assets,
    pace: "MONTH",
    monthsElapsed: game.tick,
    startYear: game.startDate.getUTCFullYear(),
    startMonth: game.startDate.getUTCMonth() + 1,
    directives,
  });
}

export interface IssueDirectiveInput {
  companySymbol: string;
  kind: DirectiveKind;
  idempotencyKey: string;
}

export interface IssueDirectiveOutcome {
  directiveId: string;
  replayed: boolean;
  atMonth: number;
  payoutMinor: bigint;
  playerPayoutMinor: bigint;
}

export async function issueDirective(
  userId: string,
  input: IssueDirectiveInput,
): Promise<IssueDirectiveOutcome> {
  if (!isUuid(input.idempotencyKey)) {
    throw new ControlError("BAD_KEY", "Missing resolution reference, reload the page.");
  }
  if (!/^[A-Z0-9]{2,12}$/.test(input.companySymbol)) {
    throw new ControlError("UNKNOWN_COMPANY", "Unknown company.");
  }
  if (!isDirectiveKind(input.kind)) {
    throw new ControlError("UNKNOWN_ACTION", "Unknown board action.");
  }

  return prisma.$transaction(
    async (tx) => {
      const game = await tx.game.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });
      if (!game) throw new ControlError("NO_GAME", "Create a character first.");
      await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;
      if (game.status !== "ACTIVE") {
        throw new ControlError("GAME_OVER", "This life has already ended.");
      }

      const existing = await tx.companyDirective.findUnique({
        where: {
          gameId_idempotencyKey: {
            gameId: game.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          directiveId: existing.id,
          replayed: true,
          atMonth: existing.atMonth,
          payoutMinor: existing.payoutMinor,
          playerPayoutMinor: existing.playerPayoutMinor,
        };
      }

      const stored = await tx.companyDirective.findMany({
        where: { gameId: game.id },
        orderBy: { atMonth: "asc" },
      });
      const directives: DirectiveInput[] = stored.map((row) => ({
        companySymbol: row.companySymbol,
        kind: row.kind,
        atMonth: row.atMonth,
        payoutMinor: row.payoutMinor,
      }));

      const world = await worldAt(tx, game, directives);
      const company = world.companies.find(
        (candidate) => candidate.symbol === input.companySymbol,
      );
      if (!company) throw new ControlError("UNKNOWN_COMPANY", "Unknown company.");

      const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });
      const holding = await tx.holding.findFirst({
        where: { portfolioId: portfolio.id, asset: { symbol: company.symbol } },
      });
      const quantity = holding?.quantity ?? 0;
      if (quantity <= 0) {
        throw new ControlError("NO_STAKE", "You do not own shares in this company.");
      }

      const percent = stakePct(quantity, company.sharesOutstanding);
      if (!canIssue(input.kind, percent)) {
        const tier = DIRECTIVE_BY_KIND[input.kind].tier;
        throw new ControlError(
          "TIER_TOO_LOW",
          `This resolution needs the ${tier} control tier.`,
        );
      }

      const last = stored
        .filter((row) => row.companySymbol === company.symbol)
        .sort((a, b) => b.atMonth - a.atMonth)[0];
      if (last && game.tick - last.atMonth < DIRECTIVE_COOLDOWN_MONTHS) {
        throw new ControlError(
          "COOLDOWN",
          `The board already met this quarter. Next resolution available at month ${
            last.atMonth + DIRECTIVE_COOLDOWN_MONTHS
          }.`,
        );
      }

      const payout = input.kind === "DIVIDEND" ? dividendPayout(company) : 0n;
      const playerPayout =
        payout > 0n
          ? (payout * BigInt(quantity)) / BigInt(Math.max(1, company.sharesOutstanding))
          : 0n;

      const directive = await tx.companyDirective.create({
        data: {
          gameId: game.id,
          companySymbol: company.symbol,
          kind: input.kind,
          atMonth: game.tick,
          payoutMinor: payout,
          playerPayoutMinor: playerPayout,
          idempotencyKey: input.idempotencyKey,
        },
      });

      if (playerPayout > 0n) {
        const updated = await tx.portfolio.update({
          where: { id: portfolio.id },
          data: { cashMinor: { increment: playerPayout } },
        });
        await appendLedgerRun(tx, game.id, [
          {
            portfolioId: portfolio.id,
            account: "CASH",
            direction: "CREDIT",
            amountMinor: playerPayout,
            balanceAfterMinor: updated.cashMinor,
            reason: "DIVIDEND",
            refType: "COMPANY_DIRECTIVE",
            refId: directive.id,
            tick: game.tick,
          },
        ]);
      }

      return {
        directiveId: directive.id,
        replayed: false,
        atMonth: directive.atMonth,
        payoutMinor: payout,
        playerPayoutMinor: playerPayout,
      };
    },
    { timeout: 20_000 },
  );
}
