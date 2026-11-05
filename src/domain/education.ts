/**
 * Education catalog and rules (docs/GAME_DESIGN.md §4). Programs are code
 * constants; enrollment persists a row per character. Tuition is debited at
 * start; knowledge is granted on completion.
 */
export interface EducationProgram {
  key: string;
  name: string;
  tuitionMinor: bigint;
  knowledgeGain: number;
  durationTicks: number;
}

export const EDUCATION_PROGRAMS: EducationProgram[] = [
  {
    key: "SHORT_COURSE",
    name: "Evening certificate course",
    tuitionMinor: 20_000n, // 200 credits
    knowledgeGain: 8,
    durationTicks: 3,
  },
  {
    key: "DEGREE",
    name: "University degree",
    tuitionMinor: 240_000n, // 2,400 credits
    knowledgeGain: 40,
    durationTicks: 24,
  },
];

export function programByKey(key: string): EducationProgram | undefined {
  return EDUCATION_PROGRAMS.find((program) => program.key === key);
}

/** Knowledge threshold for a promotion attempt, per current career level. */
export function promotionKnowledgeThreshold(level: number): number {
  return 40 + level * 15;
}
