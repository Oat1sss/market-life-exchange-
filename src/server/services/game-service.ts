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
import {
  BACKGROUNDS,
  applyStatDelta,
  type BackgroundKey,
} from "@/domain/character";
import { choiceStats } from "@/domain/life-events";
import { ageAt, gameDateFor } from "@/domain/calendar";
import { monthlyPay } from "@/domain/payroll";
import { nextPrice } from "@/domain/market/prices";
import { economySnapshot, sectorPressure } from "@/domain/economy";
import { buildBondMarket } from "@/domain/bonds";
import { rollMarketEvent, shockForSector, shockForAsset } from "@/domain/market/events";
import { MAX_SAVE_SLOTS } from "@/domain/saves";
import {
  delayedRepairFollowupCost,
  templateByKey,
} from "@/domain/life-events";
import { eligibleAchievements, type AchievementKey } from "@/domain/achievements";
import { programByKey } from "@/domain/education";
import { prisma } from "@/server/db";
import { appendLedgerRun, type LedgerDraft } from "./ledger";
import { fillBuy, fillSell, FillError } from "./trade-fill";
import { settleFutures } from "./futures-service";
import { settleBonds } from "./bond-service";
import { loadDirectives } from "./control-service";
import { futuresPnlMinor } from "@/domain/futures";

// Demo exchange accounts start with a simulated balance so every market is
// reachable on day one. Real funding is simulated through the deposit flow.
const START_CASH_MINOR = 1_000_000_000_000n; // Rp 10.000.000.000,00 modal demo

type Tx = Prisma.TransactionClient;

export class GameError extends Error {
  constructor(
    public code:
      | "NO_GAME" | "GAME_OVER" | "PENDING_EVENT" | "INSUFFICIENT_FUNDS"
      | "BAD_EVENT" | "NOT_PENDING" | "BAD_CHOICE" | "NAME_REQUIRED"
      | "ALREADY_ENROLLED" | "UNKNOWN_PROGRAM" | "UNPAID_TUITION"
      | "SLOTS_FULL",
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
    const usedSlots = await tx.game.count({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    });
    if (usedSlots >= MAX_SAVE_SLOTS) {
      throw new GameError(
        "SLOTS_FULL",
        `Semua ${MAX_SAVE_SLOTS} slot simpan sudah terisi. Hapus salah satu slot terlebih dahulu.`,
      );
    }

    // Only one life is ACTIVE at a time; the previous one is parked as PAUSED.
    await tx.game.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });

    const game = await tx.game.create({
      data: { userId, seed: newSeed(), startDate },
    });

    const stats = BACKGROUNDS[input.background].stats;
    await tx.character.create({
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
  }, { timeout: 20_000 });
}

export async function canCreateGame(userId: string): Promise<boolean> {
  const used = await prisma.game.count({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
  });
  return used < MAX_SAVE_SLOTS;
}

/* -------------------------------------------------------------------- */
/* Advance                                                               */
/* -------------------------------------------------------------------- */

export interface AdvanceOutcome {
  tick: number;
  headline: string | null;
}

/**
 * Advance the simulated market by one tick. This is a demo exchange, not a
 * life sim: there are no salaries, bills or random life events. A tick only
 * moves prices, settles futures, fills resting limit orders, and unlocks
 * achievements.
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
    const drafts: Array<Omit<LedgerDraft, "gameId" | "tick">> = [];
    const cash = portfolio.cashMinor;

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

    // Macro overlay: replay the deterministic economy up to this tick so stock
    // prices react to earnings, resource costs, policy and media pressure
    // instead of only to the standalone headline event.
    // Board decisions are replayed as inputs (see control-service), so the
    // price model sees the same world the economy page shows.
    const { inputs: directives } = await loadDirectives(game.id);
    const world = economySnapshot({
      seed: game.seed,
      assets,
      pace: "MONTH",
      monthsElapsed: target,
      startYear: game.startDate.getUTCFullYear(),
      startMonth: game.startDate.getUTCMonth() + 1,
      directives,
    });
    const macroPressure = sectorPressure(world);

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
    const pricePointsToInsert: Array<{
      gameId: string;
      assetId: string;
      tick: number;
      priceMinor: bigint;
      sentimentBp: number;
      fundamentalMinor: bigint;
    }> = [];

    for (const [assetIndex, asset] of assets.entries()) {
      const previous = previousPrices.get(asset.id);
      if (!previous) {
        pricePointsToInsert.push({
          gameId: game.id,
          assetId: asset.id,
          tick: target,
          priceMinor: asset.fundamentalMinor,
          sentimentBp: 0,
          fundamentalMinor: asset.fundamentalMinor,
        });
        freshPrices.set(asset.id, asset.fundamentalMinor);
        continue;
      }
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
        // bp → micro; macro pressure is damped so it nudges rather than drives.
        eventShockMicro: shock * 100 + (macroPressure[asset.sector] ?? 0) * 40,
      });
      freshPrices.set(asset.id, next.priceMinor);
      pricePointsToInsert.push({
        gameId: game.id,
        assetId: asset.id,
        tick: target,
        priceMinor: next.priceMinor,
        sentimentBp: next.sentimentBp,
        fundamentalMinor: previous.fundamentalMinor,
      });
    }

    if (pricePointsToInsert.length > 0) {
      await tx.pricePoint.createMany({
        data: pricePointsToInsert,
      });
    }

    // ---- Futures mark-to-market: liquidate positions whose equity hit zero
    await settleFutures(tx, game.id, target, freshPrices);

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

    // ---- Bonds: monthly coupons and principal at maturity --------------
    // Runs after the stale cash snapshot write above so the credits survive.
    await settleBonds(tx, game, target);

    if (knowledgeGain > 0) {
      await tx.character.update({
        where: { id: character.id },
        data: { knowledge: Math.min(100, character.knowledge + knowledgeGain) },
      });
    }

    // ---- Achievements ----------------------------------------------------
    await unlockAchievements(tx, game.id, {
      filledOrderCount: await tx.order.count({ where: { gameId: game.id, status: "FILLED" } }),
      bestRealizedMinor: await bestRealized(tx, game.id),
      netWorthMinor:
        (await netWorthOf(tx, portfolio.id, cash, freshPrices)) +
        (await bondValueOf(tx, game.id, world.bonds, target)),
      completedEducationCount: await tx.education.count({
        where: { characterId: character.id, status: "COMPLETED", knowledgeGain: { gte: 40 } },
      }),
      currentAge: ageAt(target),
    });

    // ---- Tick ------------------------------------------------------------
    await tx.game.update({ where: { id: game.id }, data: { tick: target } });

    await appendLedgerRun(tx, game.id, drafts.map((draft) => ({ ...draft, tick: target })));

    return { tick: target, headline: event?.title ?? null };
  }, { timeout: 20_000 });
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

async function bondValueOf(
  db: Tx | typeof prisma,
  gameId: string,
  quotes: ReturnType<typeof economySnapshot>["bonds"],
  tick: number,
): Promise<bigint> {
  const holdings = await db.bondHolding.findMany({ where: { gameId } });
  if (holdings.length === 0) return 0n;
  const instruments = buildBondMarket(quotes, tick);
  return holdings.reduce((total, holding) => {
    const instrument = instruments.find((candidate) => candidate.key === holding.bondKey);
    return total + (instrument?.priceMinor ?? 0n) * BigInt(holding.quantity);
  }, 0n);
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
  }, { timeout: 20_000 });
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
  }, { timeout: 20_000 });
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

  // Open futures contribute margin + unrealized P&L to net worth.
  const openFutures = await prisma.futuresPosition.findMany({
    where: { gameId: game.id, status: "OPEN" },
  });
  let futuresEquity = 0n;
  if (openFutures.length > 0) {
    const futuresPoints = await prisma.pricePoint.findMany({
      where: {
        gameId: game.id,
        tick: game.tick,
        assetId: { in: openFutures.map((position) => position.assetId) },
      },
    });
    const futuresPriceMap = new Map(futuresPoints.map((point) => [point.assetId, point.priceMinor]));
    for (const position of openFutures) {
      const mark = futuresPriceMap.get(position.assetId) ?? position.entryPriceMinor;
      futuresEquity +=
        position.marginMinor +
        futuresPnlMinor(position.side, position.entryPriceMinor, mark, position.quantity);
    }
  }

  // Bonds are marked at the same macro price used by the bond page and the
  // advance settlement, so buying a bond does not make net worth drop.
  const bondRows = await prisma.bondHolding.findMany({ where: { gameId: game.id } });
  let bondValue = 0n;
  if (bondRows.length > 0) {
    const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
    const world = economySnapshot({
      seed: game.seed,
      assets,
      pace: "MONTH",
      monthsElapsed: game.tick,
      startYear: game.startDate.getUTCFullYear(),
      startMonth: game.startDate.getUTCMonth() + 1,
    });
    bondValue = await bondValueOf(prisma, game.id, world.bonds, game.tick);
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
    else if (row.reason === "BOND_BUY") label = "Bond purchase";
    else if (row.reason === "BOND_SELL") label = "Bond sale";
    else if (row.reason === "BOND_COUPON") label = "Bond coupon";
    else if (row.reason === "BOND_MATURITY") label = "Bond redemption";
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
    netWorth: game.portfolio.cashMinor + portfolioValue + futuresEquity + bondValue,
    salaryNet,
    pendingLifeEvent: pendingLifeEventView,
    recentLedger,
  };
}

/** Prisma type re-export avoided; clients fetch through the snapshot above. */
export type { AchievementKey };
