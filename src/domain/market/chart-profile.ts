/**
 * Per-asset "personality" for the demo chart and live tape.
 *
 * Prices that settle into the database always come from `nextPrice`; this
 * module only shapes how a symbol *looks* between server ticks, so BTC trends
 * smoothly while a micro-cap chops, and no two charts animate alike.
 */

export interface ChartProfile {
  /** Stable seed derived from the symbol. */
  seed: number;
  /** Typical live step size as a fraction of price (0.002 = 0.2%). */
  volatility: number;
  /** Persistent drift per live step, as a fraction of price. */
  drift: number;
  /** Wick depth multiplier for synthesized candles. */
  wick: number;
  /** How strongly momentum carries between live steps (0–1). */
  momentum: number;
  /** Volume scaling for synthesized bars. */
  volume: number;
  /** Label describing the behaviour, shown in the chart header. */
  archetype: string;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** mulberry32 — deterministic, cheap, good enough for a visual tape. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARCHETYPES = [
  "Tren halus",
  "Volatil tinggi",
  "Pasar sideways",
  "Momentum kuat",
  "Sering gap",
] as const;

export function profileFor(symbol: string): ChartProfile {
  const seed = hash(`chart:${symbol}`);
  const pick = (shift: number) => ((seed >>> shift) & 0xff) / 255;

  const volatility = 0.0022 + pick(3) * 0.009; // 0.22% – 1.12%
  const drift = (pick(7) - 0.5) * 0.0022; // ±0.11% per step
  const wick = 0.25 + pick(11) * 1.15;
  const momentum = 0.55 + pick(15) * 0.4;
  const volume = 0.6 + pick(19) * 1.9;
  const archetype =
    ARCHETYPES[
      volatility > 0.008
        ? 1
        : Math.abs(drift) < 0.0003
          ? 2
          : drift > 0
            ? 3
            : 0
    ]!;

  return { seed, volatility, drift, wick, momentum, volume, archetype };
}

/** One synthetic live step, deterministic in (symbol, step). */
export function liveStep(
  profile: ChartProfile,
  price: number,
  momentum: number,
  step: number,
): { price: number; momentum: number } {
  const rand = seededRandom(profile.seed ^ Math.imul(step + 1, 0x9e3779b1));
  const impulse = (rand() - 0.5) * 2 * profile.volatility;
  const nextMomentum =
    momentum * profile.momentum +
    profile.drift +
    impulse * (1 - profile.momentum * 0.5);
  const micro = (rand() - 0.5) * profile.volatility * 0.6;
  const next = Math.max(price * (1 + nextMomentum + micro), price * 0.5);
  return { price: next, momentum: nextMomentum };
}

/** Runtime guard for values that arrive from props. */
export function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
