/**
 * Game clock (see docs/ARCHITECTURE.md §The three clocks).
 * One tick = one in-game month. Age starts at 18. Game date = start_date +
 * `tick` months, computed server-side; the client never sends a tick.
 */
export const START_AGE = 18;

export interface GameDate {
  year: number;
  /** 1–12 */
  month: number;
  label: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Deterministic conversion from (startYear, startMonth1, tick) to game date. */
export function gameDateFor(
  startYear: number,
  startMonth1: number,
  tick: number,
): GameDate {
  const totalIndex = startYear * 12 + (startMonth1 - 1) + tick;
  const year = Math.floor(totalIndex / 12);
  const month = (totalIndex % 12) + 1;
  return { year, month, label: `${MONTH_NAMES[month - 1]} ${year}` };
}

export function ageAt(tick: number): number {
  return START_AGE + Math.floor(tick / 12);
}

export type LifeStage = "YOUNG_ADULT" | "ADULT" | "MIDLIFE" | "SENIOR";

export function lifeStageAt(tick: number): LifeStage {
  const age = ageAt(tick);
  if (age < 30) return "YOUNG_ADULT";
  if (age < 50) return "ADULT";
  if (age < 65) return "MIDLIFE";
  return "SENIOR";
}

/** Index of the month within the current year of life (0–11). */
export function monthOfYearIndex(tick: number): number {
  return ((tick % 12) + 12) % 12;
}

export const RETIREMENT_AGE = 65;
export const DEATH_AGE = 90;

/** Advance is refused past these bounds; the run is terminal. */
export function isTerminalAge(tick: number): boolean {
  return ageAt(tick) >= DEATH_AGE;
}
