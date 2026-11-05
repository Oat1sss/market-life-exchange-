/**
 * Life events (docs/GAME_DESIGN.md §4): template definitions here, instances
 * in the database. Selection uses (seed, tick); the client only submits which
 * choice it made. Pending events gate `advance`.
 */
import type { Stats } from "./character";
import * as Rng from "./rng";

export type LifeEventTemplateKey =
  | "CAR_REPAIR"
  | "LAYOFF_RUMOR"
  | "FRIEND_STARTUP";

export interface LifeEventChoice {
  key: string;
  label: string;
  hint: string;
}

export interface LifeEventTemplate {
  key: LifeEventTemplateKey;
  title: string;
  body: string;
  /** Earliest tick at which the event can fire. */
  minTick: number;
  /** Base monthly firing probability. */
  probability: number;
  choices: [LifeEventChoice, LifeEventChoice];
  /** Cash cost when the event resolves negatively (via choice or followup). */
  cashMinor?: bigint;
}

export const LIFE_EVENT_TEMPLATES: LifeEventTemplate[] = [
  {
    key: "CAR_REPAIR",
    title: "The car makes a new noise",
    body:
      "Six hundred credits is the polite estimate. The mechanic can look at it this week — or it drives until it doesn't.",
    minTick: 4,
    probability: 0.08,
    cashMinor: 60_000n, // 600 credits
    choices: [
      { key: "PAY", label: "Pay 600 now", hint: "Cash −600" },
      { key: "DELAY", label: "Drive it and hope", hint: "Happiness −8; may cost more later" },
    ],
  },
  {
    key: "LAYOFF_RUMOR",
    title: "Word of a layoff round",
    body:
      "A shared calendar filled with names nobody will say out loud. Nights are free; weekends are quiet at the office.",
    minTick: 3,
    probability: 0.06,
    choices: [
      { key: "STUDY", label: "Study nights", hint: "Knowledge +6, Happiness −4" },
      { key: "IGNORE", label: "Stay heads-down", hint: "Reputation −3" },
    ],
  },
  {
    key: "FRIEND_STARTUP",
    title: "A friend's startup asks for 500",
    body:
      "It's a spreadsheet and a promise. Half the time you multiply it. Half the time you never mention it again.",
    minTick: 12,
    probability: 0.05,
    cashMinor: 50_000n, // 500 credits (choice A), +140,000 payoff 50%
    choices: [
      { key: "INVEST", label: "Wire the 500", hint: "Cash −500; 50% chance of +1,400 later" },
      { key: "DECLINE", label: "Politely decline", hint: "Happiness −2" },
    ],
  },
];

export function templateByKey(key: string): LifeEventTemplate | undefined {
  return LIFE_EVENT_TEMPLATES.find((template) => template.key === key);
}

/**
 * Deterministic pick: fire at most one event per tick. Returns the template
 * key or null. Each template uses its own HMAC draw so a fired event does not
 * suppress the others' probability paths.
 */
export function rollLifeEvent(
  seed: bigint,
  tick: number,
): LifeEventTemplate | null {
  for (const template of LIFE_EVENT_TEMPLATES) {
    if (tick < template.minTick) continue;
    if (Rng.deriveChance(seed, `life:${template.key}`, tick, template.probability)) {
      return template;
    }
  }
  return null;
}

/** Choose the follow-up cash amount for a DELAYED car repair (paid at +3). */
export function delayedRepairFollowupCost(seed: bigint, tick: number, baseMinor: bigint): bigint {
  // 20% chance the delay costs ~1.75×, else no follow-up at all.
  const unlucky = Rng.deriveChance(seed, "life-followup:CAR_REPAIR", tick, 0.2);
  return unlucky ? (baseMinor * 7n) / 4n : 0n;
}

/** Startup payoff at +6 ticks: 50% × 1,400 credits, else nothing. */
export function startupPayoffMinor(seed: bigint, tick: number): bigint {
  return Rng.deriveChance(seed, "life-payoff:FRIEND_STARTUP", tick, 0.5)
    ? 140_000n
    : 0n;
}

/** Choice effect map, applied server-side to stats. */
export function choiceStats(
  templateKey: string,
  choiceKey: string,
): Partial<Stats> {
  if (templateKey === "CAR_REPAIR" && choiceKey === "DELAY") {
    return { happiness: -8 };
  }
  if (templateKey === "LAYOFF_RUMOR") {
    if (choiceKey === "STUDY") return { knowledge: 6, happiness: -4 };
    if (choiceKey === "IGNORE") return { reputation: -3 };
  }
  if (templateKey === "FRIEND_STARTUP" && choiceKey === "DECLINE") {
    return { happiness: -2 };
  }
  return {};
}
