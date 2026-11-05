/**
 * Game lifecycle service (docs/ARCHITECTURE.md): creation, monthly advance,
 * life-event resolution, education enrollment, and dashboard reads.
 *
 * Every mutation is one Prisma transaction; the game row is locked FOR UPDATE
 * so concurrent advances serialize. Money stays in bigint minor units and each
 * cash change appends a ledger row in the same transaction.
 */
import { randomBytes } from "node:crypto";
import { Prisma, type Character } from "@/generated/prisma/index";
import { DEFAULT_EXPENSES } from "@/domain/expense-defaults";
import {
  BACKGROUNDS,
  applyStatDelta,
  baseStatDrift,
  type Stats,
  type BackgroundKey,
} from "@/domain/character";
import { choiceStats } from "@/domain/life-events";
import { ageAt, gameDateFor, isTerminalAge } from "@/domain/calendar";
import { monthlyPay } from "@/domain/payroll";
import { nextPrice } from "@/domain/market/prices";
import { rollMarketEvent, shockForSector, shockForAsset } from "@/domain/market/events";
import {
  delayedRepairFollowupCost,
  rollLifeEvent,
  startupPayoffMinor,
  templateByKey,
} from "@/domain/life-events";
import { eligibleAchievements, type AchievementKey } from "@/domain/achievements";
import { programByKey } from "@/domain/education";
import { prisma } from "@/server/db";
import { appendLedgerRun, type LedgerDraft } from "./ledger";
import { fillBuy, fillSell, FillError } from "./trade-fill";

const START_CASH_MINOR = 240_000n; // 2,400 credits
const ENTRY_ANNUAL_SALARY_MINOR = 360_000n; // 3,600 credits/year

type Tx = Prisma.TransactionClient;

export class GameError extends Error {
  constructor(
    public code:
      | "NO_GAME" | "GAME_OVER" | "PENDING_EVENT" | "INSUFFICIENT_FUNDS"
      | "BAD_EVENT" | "NOT_PENDING" | "BAD_CHOICE" | "NAME_REQUIRED"
      | "ALREADY_ENROLLED" | "UNKNOWN_PROGRAM" | "UNPAID_TUITION",
    message: string,
  ) {
    super(message);
  }
}

function newSeed(): bigint {
  return BigInt(`0x${randomBytes(8).toString("hex")}`) & ((1n << 62n) - 1n);
}

/* -------------------------------------------------------------------- */
/* Creation                                                              */
/* -------------------------------------------------------------------- */

export interface CreateGameInput {
  firstName: string;
  lastName: string;
  background: BackgroundKey;
}

export async function createGame(
  userId: string,
  input: CreateGameInput,
): Promise<{ gameId: string }> {
  const now = new Date();
  // Months are whole; snap the start date to the first of the month.
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return prisma.$transaction(async (tx) => {
    const game = await tx.game.create({
      data: { userId, seed: newSeed(), startDate },
    });

    const stats = BACKGROUNDS[input.background].stats;
    const character = await tx.character.create({
      data: {
        gameId: game.id,
        firstName: input.firstName,
        lastName: input.lastName,
        background: input.background,
        health: stats.health,
        happiness: stats.happiness,
        knowledge: stats.knowledge,
        reputation: stats.reputation,
      },
    });

    const portfolio = await tx.portfolio.create({
      data: { gameId: game.id, cashMinor: START_CASH_MINOR },
    });

    await tx.expenseRule.createMany({
      data: DEFAULT_EXPENSES.map((expense) => ({
        gameId: game.id,
        label: expense.label,
        category: expense.category,
        amountMinor: expense.amountMinor,
        cadence: expense.cadence,
      })),
    });

    await tx.career.create({
      data: {
        characterId: character.id,
        title: "Junior clerk",
        employer: "Beltline Grocery",
        annualSalaryMinor: ENTRY_ANNUAL_SALARY_MINOR,
        level: 1,
        startedTick: 0,
      },
    });

    const assets = await tx.asset.findMany({ orderBy: { symbol: "asc" } });
    await tx.pricePoint.createMany({
      data: assets.map((asset) => ({
        gameId: game.id,
        assetId: asset.id,
        tick: 0,
        priceMinor: asset.fundamentalMinor,
        sentimentBp: 0,
        fundamentalMinor: asset.fundamentalMinor,
      })),
    });

    await appendLedgerRun(tx, game.id, [
      {
        portfolioId: portfolio.id,
        account: "CASH",
        direction: "CREDIT",
        amountMinor: START_CASH_MINOR,
        balanceAfterMinor: START_CASH_MINOR,
        reason: "DEPOSIT",
        refType: "GAME",
        refId: game.id,
        tick: 0,
      },
    ]);

    return { gameId: game.id };
  });
}

export async function canCreateGame(userId: string): Promise<boolean> {
  const active = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  return !active;
}

/* -------------------------------------------------------------------- */
/* Advance                                                               */
/* -------------------------------------------------------------------- */

export interface AdvanceOutcome {
  tick: number;
  headline: string | null;
}

/**
 * Advance exactly one tick. Refuses when a life event awaits a choice.
 * Per-tick order (docs/GAME_DESIGN §2): salary → expenses → market →
 * limit orders → follow-ups already scheduled → stat drift → achievements.
 */
export async function advanceGame(userId: string): Promise<AdvanceOutcome> {
  return prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);
    if (game.status !== "ACTIVE") {
      throw new GameError("GAME_OVER", "This life has already ended.");
    }
    const target = game.tick + 1;

    const character = await tx.character.findUnique({ where: { gameId: game.id } });
    const portfolio = await tx.portfolio.findUnique({ where: { gameId: game.id } });
    if (!character || !portfolio) {
      throw new GameError("NO_GAME", "Game state incomplete in database.");
    }
    const pendingEvents = await tx.lifeEvent.count({
      where: { gameId: game.id, resolvedAt: null },
    });
    if (pendingEvents > 0) {
      throw new GameError("PENDING_EVENT", "Resolve the pending life event first.");
    }

    const drafts: Array<Omit<LedgerDraft, "gameId" | "tick">> = [];
    let cash = portfolio.cashMinor;

    // ---- Salary --------------------------------------------------------
    const career = await tx.career.findFirst({
      where: { characterId: character.id, endedTick: null },
    });
    if (career) {
      const pay = monthlyPay(career.annualSalaryMinor, game.tick);
      if (pay.minor > 0n) {
        cash += pay.minor;
        drafts.push({
          portfolioId: portfolio.id, account: "CASH", direction: "CREDIT",
          amountMinor: pay.minor, balanceAfterMinor: cash, reason: "SALARY",
          refType: "CAREER", refId: career.id,
        });
      }
    }

    // ---- Expenses (forced 20%-spread sales when cash falls short) ------
    const expenses = await tx.expenseRule.findMany({
      where: { gameId: game.id, active: true, cadence: "MONTHLY" },
    });
    let unpaidPenalty = 0;
    for (const expense of expenses) {
      if (expense.amountMinor <= cash) {
        cash -= expense.amountMinor;
        drafts.push({
          portfolioId: portfolio.id, account: "CASH", direction: "DEBIT",
          amountMinor: expense.amountMinor, balanceAfterMinor: cash,
          reason: "EXPENSE", refType: "EXPENSE_RULE", refId: expense.id,
        });
        continue;
      }
      // Shortfall: liquidate holdings at −20% spreads, then pay any remainder.
      const sale = await collectForcedSale(tx, game.id, portfolio.id, expense.amountMinor - cash, target);
      if (sale.proceeds > 0n) {
        cash += sale.proceeds;
        drafts.push({
          portfolioId: portfolio.id, account: "CASH", direction: "CREDIT",
          amountMinor: sale.proceeds, balanceAfterMinor: cash,
          reason: "TRADE_SELL", refType: "FORCED_SALE", refId: expense.id,
        });
        for (const leg of sale.legs) {
          drafts.push({
            portfolioId: portfolio.id, account: "ASSET", assetId: leg.assetId,
            direction: "DEBIT", amountMinor: leg.basisMinor,
            balanceAfterMinor: leg.remainingBasisMinor,
            reason: "TRADE_SELL", refType: "FORCED_SALE", refId: expense.id,
          });
        }
      }
      // Release everything still owed, limited to available cash.
      const paid = expense.amountMinor <= cash ? expense.amountMinor : cash;
      if (paid > 0n) {
        cash -= paid;
        drafts.push({
          portfolioId: portfolio.id, account: "CASH", direction: "DEBIT",
          amountMinor: paid, balanceAfterMinor: cash,
          reason: "EXPENSE", refType: "EXPENSE_RULE_PARTIAL", refId: expense.id,
        });
      }
      if (expense.amountMinor > paid) unpaidPenalty += 5;
    }

    // ---- Education completions -----------------------------------------
    const due = await tx.education.findMany({
      where: {
        characterId: character.id,
        status: "IN_PROGRESS",
        completesTick: { lte: target },
      },
    });
    let knowledgeGain = 0;
    for (const edu of due) {
      await tx.education.update({ where: { id: edu.id }, data: { status: "COMPLETED" } });
      knowledgeGain += edu.knowledgeGain;
    }

    // ---- Life-event follow-ups that were scheduled at past choices ------
    const resolvedEvents = await tx.lifeEvent.findMany({
      where: { gameId: game.id, resolvedAt: { not: null } },
    });
    for (const event of resolvedEvents) {
      const outcome = (event.outcome ?? {}) as Record<string, unknown>;
      const { followupCostMinor, followupAtTick, followupCharged, payoffAtTick, payoffCharged } =
        outcome as {
          followupCostMinor?: number;
          followupAtTick?: number;
          followupCharged?: boolean;
          payoffAtTick?: number;
          payoffCharged?: boolean;
        };

      if (followupAtTick === target && !followupCharged && (followupCostMinor ?? 0) > 0) {
        const cost = BigInt(followupCostMinor!);
        await tx.lifeEvent.update({
          where: { id: event.id },
          data: { outcome: { ...outcome, followupCharged: true } },
        });
        const paid = cash >= cost ? cost : cash;
        cash -= paid;
        drafts.push({
          portfolioId: portfolio.id, account: "CASH", direction: "DEBIT",
          amountMinor: paid, balanceAfterMinor: cash, reason: "LIFE_EVENT",
          refType: "LIFE_EVENT_FOLLOWUP", refId: event.id,
        });
        if (paid < cost) unpaidPenalty += 5;
      }

      if (payoffAtTick === target && !payoffCharged) {
        const payoff = startupPayoffMinor(game.seed, event.tick);
        await tx.lifeEvent.update({
          where: { id: event.id },
          data: { outcome: { ...outcome, payoffCharged: true } },
        });
        if (payoff > 0n) {
          cash += payoff;
          drafts.push({
            portfolioId: portfolio.id, account: "CASH", direction: "CREDIT",
            amountMinor: payoff, balanceAfterMinor: cash, reason: "LIFE_EVENT",
            refType: "LIFE_EVENT_PAYOFF", refId: event.id,
          });
        }
      }
    }

    // ---- Market: one headline, then prices ------------------------------
    const assets = await tx.asset.findMany({ orderBy: { symbol: "asc" } });
    const previousPrices = new Map<string, {
      priceMinor: bigint; sentimentBp: number; fundamentalMinor: bigint;
    }>();
    for (const point of await tx.pricePoint.findMany({ where: { gameId: game.id, tick: game.tick } })) {
      previousPrices.set(point.assetId, {
        priceMinor: point.priceMinor,
        sentimentBp: point.sentimentBp,
        fundamentalMinor: point.fundamentalMinor,
      });
    }

    const sectorByAssetId = new Map(assets.map((asset) => [asset.id, asset.sector]));
    const event = rollMarketEvent(game.seed, target, [...sectorByAssetId.values()]);
    if (event) {
      await tx.marketEvent.upsert({
        where: {
          gameId_tick_type_title: {
            gameId: game.id, tick: target, type: event.type, title: event.title,
          },
        },
        update: {},
        create: {
          gameId: game.id, tick: target, type: event.type,
          title: event.title, body: event.body,
          effects: event.effects as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const freshPrices = new Map<string, bigint>();
    for (const [assetIndex, asset] of assets.entries()) {
      const previous = previousPrices.get(asset.id);
      if (!previous) continue;
      const shock = marketShock(event?.effects, asset.sector);
      const next = nextPrice({
        seed: game.seed,
        tick: target,
        assetIndex,
        symbol: asset.symbol,
        previousPriceMinor: previous.priceMinor,
        fundamentalMinor: previous.fundamentalMinor,
        previousSentimentBp: previous.sentimentBp,
        volatilityBp: asset.volatilityBp,
        betaBp: asset.betaBp,
        eventShockMicro: shock * 100, // bp → micro
      });
      freshPrices.set(asset.id, next.priceMinor);
      await tx.pricePoint.create({
        data: {
          gameId: game.id, assetId: asset.id, tick: target,
          priceMinor: next.priceMinor, sentimentBp: next.sentimentBp,
          fundamentalMinor: previous.fundamentalMinor,
        },
      });
    }

    // ---- Single settled cash write before limit fills ------------------
    await tx.portfolio.update({
      where: { id: portfolio.id },
      data: { cashMinor: cash },
    });

    // ---- Resting limit orders fill against the new tick ----------------
    const resting = await tx.order.findMany({
      where: { gameId: game.id, status: "PENDING" },
      include: { asset: true },
    });
    for (const order of resting) {
      const price = freshPrices.get(order.assetId);
      if (price === undefined || order.limitPriceMinor === null) continue;
      const fills =
        order.side === "BUY" ? price <= order.limitPriceMinor : price >= order.limitPriceMinor;
      if (!fills) continue;
      try {
        if (order.side === "BUY") {
          await fillBuy(tx, {
            gameId: game.id, portfolioId: portfolio.id, orderId: order.id,
            assetId: order.assetId, quantity: order.quantity, priceMinor: price, tick: target,
          });
        } else {
          await fillSell(tx, {
            gameId: game.id, portfolioId: portfolio.id, orderId: order.id,
            assetId: order.assetId, quantity: order.quantity, priceMinor: price, tick: target,
          });
        }
      } catch (error) {
        if (!(error instanceof FillError)) throw error;
        await tx.order.update({
          where: { id: order.id },
          data: { status: "REJECTED", tickResolved: target },
        });
      }
    }

    // ---- Stat drift, knowledge, aging -----------------------------------
    let stats: Stats = {
      health: character.health,
      happiness: character.happiness,
      knowledge: character.knowledge,
      reputation: character.reputation,
    };
    const rawDrift = baseStatDrift(target);
    stats = applyStatDelta(stats, {
      ...rawDrift,
      happiness: (rawDrift.happiness ?? 0) - unpaidPenalty,
    });
    if (knowledgeGain > 0) {
      stats.knowledge = Math.min(100, stats.knowledge + knowledgeGain);
      await tx.character.update({
        where: { id: character.id },
        data: { knowledge: stats.knowledge },
      });
    }

    // ---- Life events: at most one pending card per tick -----------------
    const rolled = rollLifeEvent(game.seed, target);
    if (rolled && !isTerminalAge(target)) {
      await tx.lifeEvent.create({
        data: {
          gameId: game.id, templateKey: rolled.key,
          title: rolled.title, body: rolled.body,
          choices: rolled.choices as unknown as Prisma.InputJsonValue, tick: target,
        },
      });
    }

    // ---- Achievements ----------------------------------------------------
    await unlockAchievements(tx, game.id, {
      filledOrderCount: await tx.order.count({ where: { gameId: game.id, status: "FILLED" } }),
      bestRealizedMinor: await bestRealized(tx, game.id),
      netWorthMinor: await netWorthOf(tx, portfolio.id, cash, freshPrices),
      completedEducationCount: await tx.education.count({
        where: { characterId: character.id, status: "COMPLETED", knowledgeGain: { gte: 40 } },
      }),
      currentAge: ageAt(target),
    });

    // ---- Tick + terminal states ------------------------------------------
    await tx.game.update({ where: { id: game.id }, data: { tick: target } });

    const died = stats.health <= 0 || ageAt(target) >= 90;
    if (died) {
      await tx.game.update({ where: { id: game.id }, data: { status: "DECEASED" } });
    }

    await appendLedgerRun(tx, game.id, drafts.map((draft) => ({ ...draft, tick: target })));

    return { tick: target, headline: event?.title ?? null };
  });
}

function marketShock(
  effects: unknown,
  assetSector: string,
): number {
  if (effects === null || typeof effects !== "object") return 0;
  const fx = effects as Record<string, unknown>;

  if (fx.bySector && typeof fx.bySector === "object") {
    return shockForSector(effects, assetSector);
  }
  if (typeof fx.targetSector === "string") {
    return fx.targetSector === assetSector ? shockForAsset(effects) : 0;
  }
  return shockForAsset(effects); // global (REGIME) or plain shockBp
}

async function findGameForUpdate(tx: Tx, userId: string) {
  const game = await tx.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!game) throw new GameError("NO_GAME", "Create a character first.");
  await tx.$queryRaw`SELECT id FROM "games" WHERE id = ${game.id} FOR UPDATE`;
  return game;
}

interface ForcedSaleLegs {
  proceeds: bigint;
  legs: Array<{ assetId: string; basisMinor: bigint; remainingBasisMinor: bigint }>;
}

async function collectForcedSale(
  tx: Tx,
  gameId: string,
  portfolioId: string,
  neededMinor: bigint,
  tick: number,
): Promise<ForcedSaleLegs> {
  const holdings = await tx.holding.findMany({
    where: { portfolioId },
    include: { asset: true },
  });
  const legs: ForcedSaleLegs["legs"] = [];
  let proceeds = 0n;
  for (const holding of holdings) {
    if (proceeds >= neededMinor) break;
    const point = await tx.pricePoint.findFirst({
      where: { gameId, assetId: holding.assetId },
      orderBy: { tick: "desc" },
    });
    const price = point?.priceMinor ?? holding.averageCostMinor;
    const spreadPrice = (price * 80n) / 100n; // forced at −20%
    const gross = spreadPrice * BigInt(holding.quantity);
    const basis = holding.averageCostMinor * BigInt(holding.quantity);
    proceeds += gross;
    legs.push({ assetId: holding.assetId, basisMinor: basis, remainingBasisMinor: 0n });
    await tx.holding.delete({ where: { id: holding.id } });
  }
  if (proceeds > 0n) {
    await tx.portfolio.update({
      where: { id: portfolioId },
      data: { cashMinor: { increment: proceeds } },
    });
    void tick;
  }
  return { proceeds, legs };
}

async function netWorthOf(
  tx: Tx,
  portfolioId: string,
  cashMinor: bigint,
  freshPrices: Map<string, bigint>,
): Promise<bigint> {
  let netWorth = cashMinor;
  const holdings = await tx.holding.findMany({ where: { portfolioId } });
  for (const holding of holdings) {
    const price = freshPrices.get(holding.assetId) ?? holding.averageCostMinor;
    netWorth += price * BigInt(holding.quantity);
  }
  return netWorth;
}

async function bestRealized(tx: Tx, gameId: string): Promise<bigint> {
  const rows = await tx.ledgerEntry.findMany({
    where: { gameId, reason: "TRADE_SELL", refType: "ORDER" },
    orderBy: { sequence: "asc" },
  });
  const byRef = new Map<string, { proceeds: bigint; basis: bigint }>();
  for (const row of rows) {
    const slot = byRef.get(row.refId) ?? { proceeds: 0n, basis: 0n };
    if (row.account === "CASH" && row.direction === "CREDIT") {
      slot.proceeds += row.amountMinor;
    }
    if (row.account === "ASSET" && row.direction === "DEBIT") {
      slot.basis += row.amountMinor;
    }
    byRef.set(row.refId, slot);
  }
  let best = 0n;
  for (const { proceeds, basis } of byRef.values()) {
    const realized = proceeds - basis;
    if (realized > best) best = realized;
  }
  return best;
}

async function unlockAchievements(
  tx: Tx,
  gameId: string,
  universe: {
    filledOrderCount: number;
    bestRealizedMinor: bigint;
    netWorthMinor: bigint;
    completedEducationCount: number;
    currentAge: number;
  },
): Promise<void> {
  const keys = eligibleAchievements(universe);
  for (const key of keys) {
    await tx.playerAchievement.upsert({
      where: { gameId_achievementKey: { gameId, achievementKey: key } },
      update: {},
      create: { gameId, achievementKey: key },
    });
  }
}

/* -------------------------------------------------------------------- */
/* Life events                                                           */
/* -------------------------------------------------------------------- */

export interface LifeEventView {
  id: string;
  templateKey: string;
  title: string;
  body: string;
  tick: number;
  choices: Array<{ key: string; label: string; hint: string }>;
}

export async function activeGame(userId: string) {
  return findGameForUpdateClient(userId);
}

/** Snapshot helpers used by pages (read-only, no lock). */
export async function loadDashboard(userId: string) {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return game;
}

async function findGameForUpdateClient(userId: string) {
  return prisma.$transaction(async (tx) => findGameForUpdate(tx, userId));
}

export async function pendingLifeEvent(userId: string): Promise<LifeEventView | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (!game) return null;
  const event = await prisma.lifeEvent.findFirst({
    where: { gameId: game.id, resolvedAt: null },
    orderBy: { tick: "desc" },
  });
  if (!event) return null;
  return {
    id: event.id,
    templateKey: event.templateKey,
    title: event.title,
    body: event.body,
    tick: event.tick,
    choices: (event.choices as unknown as LifeEventView["choices"]) ?? [],
  };
}

/**
 * Resolve the pending life event with a choice. Cash choices (PAY / INVEST)
 * debit here with a LIFE_EVENT row; stat choices apply via choiceStats.
 * Follow-up cash lands inside advanceGame at the scheduled tick.
 */
export async function resolveLifeEvent(
  userId: string,
  input: { templateKey: string; choiceKey: string },
): Promise<void> {
  const template = templateByKey(input.templateKey);
  if (!template) throw new GameError("BAD_EVENT", "Unknown life event.");

  await prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);
    const event = await tx.lifeEvent.findFirst({
      where: { gameId: game.id, templateKey: input.templateKey, resolvedAt: null },
    });
    if (!event) {
      throw new GameError("NOT_PENDING", "This life event is already resolved.");
    }
    const choice = event.choices as unknown as LifeEventView["choices"];
    const chosen = choice?.find((candidate) => candidate.key === input.choiceKey);
    if (!chosen) throw new GameError("BAD_CHOICE", "Unknown choice.");

    const character = (await tx.character.findUniqueOrThrow({
      where: { gameId: game.id },
    })) as Character;
    const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });

    const outcome: Record<string, unknown> = { choice: input.choiceKey };
    let cashDelta = 0n;

    if (input.templateKey === "CAR_REPAIR") {
      if (input.choiceKey === "PAY") {
        cashDelta = -(template.cashMinor ?? 0n);
      } else {
        const followup = delayedRepairFollowupCost(game.seed, event.tick, template.cashMinor ?? 0n);
        if (followup > 0n) {
          outcome.followupCostMinor = Number(followup);
          outcome.followupAtTick = event.tick + 3;
        }
      }
    }
    if (input.templateKey === "FRIEND_STARTUP") {
      if (input.choiceKey === "INVEST") {
        cashDelta = -(template.cashMinor ?? 0n);
        outcome.payoffAtTick = event.tick + 6;
      }
    }

    if (cashDelta !== 0n) {
      if (cashDelta < 0n && portfolio.cashMinor < -cashDelta) {
        throw new GameError("INSUFFICIENT_FUNDS", "Not enough cash for this choice.");
      }
      const updated = await tx.portfolio.update({
        where: { id: portfolio.id },
        data: { cashMinor: { increment: cashDelta } },
      });
      await appendLedgerRun(tx, game.id, [
        {
          portfolioId: portfolio.id, account: "CASH",
          direction: cashDelta < 0n ? "DEBIT" : "CREDIT",
          amountMinor: cashDelta < 0n ? -cashDelta : cashDelta,
          balanceAfterMinor: updated.cashMinor, reason: "LIFE_EVENT",
          refType: "LIFE_EVENT", refId: event.id, tick: event.tick,
        },
      ]);
    }

    const statChanges = choiceStats(input.templateKey, input.choiceKey);
    const stats = applyStatDelta(
      {
        health: character.health, happiness: character.happiness,
        knowledge: character.knowledge, reputation: character.reputation,
      },
      statChanges,
    );
    await tx.character.update({
      where: { id: character.id },
      data: {
        health: stats.health, happiness: stats.happiness,
        knowledge: stats.knowledge, reputation: stats.reputation,
      },
    });

    await tx.lifeEvent.update({
      where: { id: event.id },
      data: {
        chosenKey: input.choiceKey,
        outcome: outcome as unknown as Prisma.InputJsonValue,
        resolvedAt: new Date(),
      },
    });
  });
}

/* -------------------------------------------------------------------- */
/* Education                                                             */
/* -------------------------------------------------------------------- */

export async function enrollEducation(
  userId: string,
  programKey: string,
): Promise<void> {
  const program = programByKey(programKey);
  if (!program) throw new GameError("UNKNOWN_PROGRAM", "Unknown program.");

  await prisma.$transaction(async (tx) => {
    const game = await findGameForUpdate(tx, userId);
    if (game.status !== "ACTIVE") {
      throw new GameError("GAME_OVER", "This life has already ended.");
    }
    const character = await tx.character.findUniqueOrThrow({ where: { gameId: game.id } });
    const portfolio = await tx.portfolio.findUniqueOrThrow({ where: { gameId: game.id } });

    const already = await tx.education.findFirst({
      where: { characterId: character.id, status: "IN_PROGRESS" },
    });
    if (already) {
      throw new GameError("ALREADY_ENROLLED", "Character is already enrolled.");
    }
    if (portfolio.cashMinor < program.tuitionMinor) {
      throw new GameError("UNPAID_TUITION", "Not enough cash for tuition.");
    }

    const education = await tx.education.create({
      data: {
        characterId: character.id,
        programKey: program.key,
        name: program.name,
        tuitionMinor: program.tuitionMinor,
        knowledgeGain: program.knowledgeGain,
        durationTicks: program.durationTicks,
        startedTick: game.tick,
        completesTick: game.tick + program.durationTicks,
        status: "IN_PROGRESS",
      },
    });
    const updated = await tx.portfolio.update({
      where: { id: portfolio.id },
      data: { cashMinor: { decrement: program.tuitionMinor } },
    });
    await appendLedgerRun(tx, game.id, [
      {
        portfolioId: portfolio.id, account: "CASH", direction: "DEBIT",
        amountMinor: program.tuitionMinor, balanceAfterMinor: updated.cashMinor,
        reason: "EDUCATION", refType: "EDUCATION", refId: education.id, tick: game.tick,
      },
    ]);
  });
}

export interface EducationProgramView {
  id: string;
  key: string;
  name: string;
  label: string;
  tuitionMinor: bigint;
  startTick: number;
  completesTick: number;
  knowledgeGain: number;
  progress: number;
  monthsLeft: number;
}

export interface EducationStateView {
  currentProgram: EducationProgramView | null;
  fullDegrees: Array<{
    id: string;
    key: string;
    label: string;
    completedTick: number;
  }>;
}

export async function educationState(userId: string): Promise<EducationStateView> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { character: true },
  });
  if (!game || !game.character) {
    return { currentProgram: null, fullDegrees: [] };
  }

  const current = await prisma.education.findFirst({
    where: { characterId: game.character.id, status: "IN_PROGRESS" },
    orderBy: { startedTick: "desc" },
  });

  const completed = await prisma.education.findMany({
    where: { characterId: game.character.id, status: "COMPLETED" },
    orderBy: { completesTick: "asc" },
  });

  let currentProgram: EducationProgramView | null = null;
  if (current) {
    const elapsed = Math.max(0, game.tick - current.startedTick);
    const total = current.durationTicks;
    const progress = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;
    const monthsLeft = Math.max(0, current.completesTick - game.tick);
    currentProgram = {
      id: current.id,
      key: current.programKey,
      name: current.name,
      label: current.name,
      tuitionMinor: current.tuitionMinor,
      startTick: current.startedTick,
      completesTick: current.completesTick,
      knowledgeGain: current.knowledgeGain,
      progress,
      monthsLeft,
    };
  }

  const fullDegrees = completed.map((item) => ({
    id: item.id,
    key: item.programKey,
    label: item.name,
    completedTick: item.completesTick,
  }));

  return { currentProgram, fullDegrees };
}

/* -------------------------------------------------------------------- */
/* Read helpers for pages                                                */
/* -------------------------------------------------------------------- */

export interface GameSnapshot {
  gameId: string;
  tick: number;
  status: string;
  character: Character & {
    birthYear: number;
    age: number;
  };
  cashMinor: bigint;
  cash: bigint;
  date: string;
  age: number;
  portfolioValue: bigint;
  netWorth: bigint;
  salaryNet: bigint;
  pendingLifeEvent: {
    id: string;
    templateKey: string;
    title: string;
    description: string;
    choices: Array<{
      key: string;
      label: string;
      text: string;
      hint: string;
    }>;
  } | null;
  recentLedger: Array<{
    tick: number;
    text: string;
    amountMinor: bigint;
  }>;
}

export async function gameSnapshot(userId: string): Promise<GameSnapshot | null> {
  const game = await prisma.game.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      character: {
        include: {
          careers: {
            where: { endedTick: null },
            take: 1,
          },
        },
      },
      portfolio: {
        include: {
          holdings: {
            include: { asset: true },
          },
        },
      },
    },
  });
  if (!game?.character || !game.portfolio) return null;

  const currentAge = ageAt(game.tick);
  const birthYear = game.startDate.getUTCFullYear() - 18;

  const holdings = game.portfolio.holdings;
  let portfolioValue = 0n;
  if (holdings.length > 0) {
    const latestPoints = await prisma.pricePoint.findMany({
      where: {
        gameId: game.id,
        tick: game.tick,
        assetId: { in: holdings.map((h) => h.assetId) },
      },
    });
    const priceMap = new Map(latestPoints.map((p) => [p.assetId, p.priceMinor]));
    for (const h of holdings) {
      const price = priceMap.get(h.assetId) ?? h.averageCostMinor;
      portfolioValue += price * BigInt(h.quantity);
    }
  }

  const activeCareer = game.character.careers[0];
  const salaryNet = activeCareer ? monthlyPay(activeCareer.annualSalaryMinor, game.tick).minor : 0n;

  const pending = await prisma.lifeEvent.findFirst({
    where: { gameId: game.id, resolvedAt: null },
    orderBy: { tick: "desc" },
  });
  let pendingLifeEventView: GameSnapshot["pendingLifeEvent"] = null;
  if (pending) {
    const choicesRaw = (pending.choices as unknown as Array<{ key: string; label: string; hint: string }>) ?? [];
    pendingLifeEventView = {
      id: pending.id,
      templateKey: pending.templateKey,
      title: pending.title,
      description: pending.body,
      choices: choicesRaw.map((c) => ({
        key: c.key,
        label: c.label,
        text: `${c.label} (${c.hint})`,
        hint: c.hint,
      })),
    };
  }

  const recentRows = await prisma.ledgerEntry.findMany({
    where: { gameId: game.id, account: "CASH" },
    orderBy: { sequence: "desc" },
    take: 6,
  });
  const recentLedger = recentRows.map((row) => {
    const signedAmount = row.direction === "DEBIT" ? -row.amountMinor : row.amountMinor;
    let label = row.reason.replace("_", " ");
    if (row.reason === "SALARY") label = "Monthly salary";
    else if (row.reason === "EXPENSE") label = "Living expenses";
    else if (row.reason === "TRADE_BUY") label = "Stock purchase";
    else if (row.reason === "TRADE_SELL") label = "Stock sale";
    else if (row.reason === "EDUCATION") label = "Tuition payment";
    else if (row.reason === "LIFE_EVENT") label = "Life event";
    else if (row.reason === "DEPOSIT") label = "Initial cash";
    return {
      tick: row.tick,
      text: label,
      amountMinor: signedAmount,
    };
  });

  const date = gameDateFor(
    game.startDate.getUTCFullYear(),
    game.startDate.getUTCMonth() + 1,
    game.tick,
  );

  return {
    gameId: game.id,
    tick: game.tick,
    status: game.status,
    character: {
      ...game.character,
      birthYear,
      age: currentAge,
    },
    cashMinor: game.portfolio.cashMinor,
    cash: game.portfolio.cashMinor,
    date: date.label,
    age: currentAge,
    portfolioValue,
    netWorth: game.portfolio.cashMinor + portfolioValue,
    salaryNet,
    pendingLifeEvent: pendingLifeEventView,
    recentLedger,
  };
}

/** Prisma type re-export avoided; clients fetch through the snapshot above. */
export type { AchievementKey };
