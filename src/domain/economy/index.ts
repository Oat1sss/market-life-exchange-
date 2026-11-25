/**
 * Public entry point for the macro-economy.
 *
 * `economySnapshot` is a read-only projection: it replays the deterministic
 * world from the game seed up to the requested calendar month at the requested
 * time pace. Nothing is persisted, so a page can render it at any pace without
 * mutating game state.
 */
import { PACES } from "./catalog";
import { simulateWorld } from "./engine";
import type { DirectiveInput } from "./directives";
import type { AssetLike, PaceKey, World } from "./types";

export * from "./types";
export * from "./catalog";
export { simulateWorld, stepWorld, companySummary } from "./engine";
export { buildWorld, snapshotMacro } from "./world";
export {
  tierFor,
  nextTierFor,
  stakePct,
  sharesForTier,
  stakeViews,
  type StakeView,
  type ControlTierView,
} from "./ownership";
export {
  DIRECTIVES,
  DIRECTIVE_BY_KIND,
  DIRECTIVE_COOLDOWN_MONTHS,
  DIVIDEND_PAYOUT_RATIO,
  applyDirective,
  canIssue,
  dividendPayout,
  isDirectiveKind,
  tierForStake,
  tierRank,
  type DirectiveDefinition,
  type DirectiveInput,
  type DirectiveKind,
} from "./directives";

/** Upper bound on replayed steps so an old save still renders fast. */
export const MAX_REPLAY_STEPS = 600;

export interface EconomySnapshotInput {
  seed: bigint;
  assets: AssetLike[];
  pace: PaceKey;
  /** Calendar months elapsed in the game (one game tick = one month). */
  monthsElapsed: number;
  startYear: number;
  /** 1–12 */
  startMonth: number;
  /** Board decisions applied during the replay, ordered by month internally. */
  directives?: DirectiveInput[];
}

export function economySnapshot(input: EconomySnapshotInput): World {
  const months = PACES[input.pace].months;
  const periods = Math.max(
    0,
    Math.min(MAX_REPLAY_STEPS, Math.round(input.monthsElapsed / months)),
  );
  return simulateWorld({
    seed: input.seed,
    assets: input.assets,
    pace: input.pace,
    startYear: input.startYear,
    startMonth: input.startMonth,
    calendarMonths: Math.max(0, input.monthsElapsed - periods * months),
    periods,
    directives: input.directives,
  });
}

/**
 * Forward-looking pressure per sector, in bp, for the price model. Crypto has
 * no macro sector and is unaffected.
 */
export function sectorPressure(world: World): Record<string, number> {
  const pressure: Record<string, number> = {};
  for (const sector of world.sectors) {
    pressure[sector.key] = sector.pressureBp;
  }
  return pressure;
}
