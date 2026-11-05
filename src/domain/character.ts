/**
 * Character rules — pure domain. Stats are integers 0–100; the database CHECK
 * constraints mirror these bounds, so nothing may clamp upstream of them.
 */
export type StatKey = "health" | "happiness" | "knowledge" | "reputation";

export interface Stats {
  health: number;
  happiness: number;
  knowledge: number;
  reputation: number;
}

export const STAT_BOUNDS = { min: 0, max: 100 } as const;

export function clampStat(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Stat must be an integer: ${value}`);
  }
  return Math.min(STAT_BOUNDS.max, Math.max(STAT_BOUNDS.min, value));
}

export function applyStatDelta(
  stats: Stats,
  deltas: Partial<Stats>,
): Stats {
  return {
    health: clampStat(stats.health + (deltas.health ?? 0)),
    happiness: clampStat(stats.happiness + (deltas.happiness ?? 0)),
    knowledge: clampStat(stats.knowledge + (deltas.knowledge ?? 0)),
    reputation: clampStat(stats.reputation + (deltas.reputation ?? 0)),
  };
}

/** Backgrounds adjust starting stats only (cash is identical for all). */
export type BackgroundKey = "SCHOLAR" | "HUSTLER" | "CREATIVE";

export const BACKGROUNDS: Record<
  BackgroundKey,
  { label: string; blurb: string; stats: Stats }
> = {
  SCHOLAR: {
    label: "Scholar",
    blurb: "Booked solid; grades and patience.",
    stats: { health: 45, happiness: 50, knowledge: 70, reputation: 45 },
  },
  HUSTLER: {
    label: "Hustler",
    blurb: "Everyone knows your name; the ledger knows the rest.",
    stats: { health: 55, happiness: 55, knowledge: 40, reputation: 60 },
  },
  CREATIVE: {
    label: "Creative",
    blurb: "Moods move markets; you move moods.",
    stats: { health: 50, happiness: 65, knowledge: 45, reputation: 40 },
  },
};

/** Per-month drift before events; deterministic rolls add randomness later. */
export function baseStatDrift(tick: number): Partial<Stats> {
  // Slight happiness decay each month; health decay begins in adulthood.
  const stage = tickToStageIndex(tick);
  return {
    happiness: -1,
    health: stage >= 1 ? -1 : 0,
  };
}

function tickToStageIndex(tick: number): number {
  const age = 18 + Math.floor(tick / 12);
  if (age >= 65) return 3;
  if (age >= 50) return 2;
  if (age >= 30) return 1;
  return 0;
}
