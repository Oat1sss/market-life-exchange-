/**
 * Achievement unlock rules — pure predicates over a game snapshot. Unlocks are
 * idempotent at the database level (composite PK); these predicates just prove
 * eligibility.
 */
export interface AchievementUniverse {
  filledOrderCount: number;
  bestRealizedMinor: bigint;
  netWorthMinor: bigint;
  completedEducationCount: number;
  currentAge: number;
}

export type AchievementKey =
  | "FIRST_TRADE"
  | "FIRST_PROFIT"
  | "NET_WORTH_10K"
  | "NET_WORTH_100K"
  | "DEGREE_EARNED"
  | "SURVIVE_65";

export const ACHIEVEMENT_UIDS: Record<AchievementKey, string> = {
  FIRST_TRADE: "FIRST_TRADE",
  FIRST_PROFIT: "FIRST_PROFIT",
  NET_WORTH_10K: "NET_WORTH_10K",
  NET_WORTH_100K: "NET_WORTH_100K",
  DEGREE_EARNED: "DEGREE_EARNED",
  SURVIVE_65: "SURVIVE_65",
};

export function eligibleAchievements(
  universe: AchievementUniverse,
): AchievementKey[] {
  const unlocked: AchievementKey[] = [];
  if (universe.filledOrderCount >= 1) {
    unlocked.push("FIRST_TRADE");
  }
  if (universe.bestRealizedMinor > 0n) {
    unlocked.push("FIRST_PROFIT");
  }
  if (universe.netWorthMinor >= 10_000n * 100n) {
    unlocked.push("NET_WORTH_10K");
  }
  if (universe.netWorthMinor >= 100_000n * 100n) {
    unlocked.push("NET_WORTH_100K");
  }
  if (universe.completedEducationCount >= 1) {
    unlocked.push("DEGREE_EARNED");
  }
  if (universe.currentAge >= 65) {
    unlocked.push("SURVIVE_65");
  }
  return unlocked;
}
