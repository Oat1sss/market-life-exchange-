/**
 * Per-asset "personality" for the demo chart and live tape.
 *
 * Prices that settle into the database always come from `nextPrice`; this
 * module only shapes how a symbol *looks* between server ticks, so BTC trends
 * smoothly while a micro-cap chops, and no two charts animate alike.
 *
 * Real crypto charts are not pure white noise: trends persist for a while,
 * volatility clusters in calm and wild phases, fat-tail candles appear every
 * so often, and alts tend to follow the same market pulse. The profile carries
 * those traits so the synthetic tape feels like a real exchange chart.
 */

export interface ChartProfile {
  /** Stable seed derived from the symbol. */
  seed: number;
  /** Typical live step size as a fraction of price (0.002 = 0.2%). */
  volatility: number;
  /** Typical historical candle range as a fraction of price. */
  historyVolatility: number;
  /** Persistent drift per live step, as a fraction of price. */
  drift: number;
  /** Wick depth multiplier for synthesized candles. */
  wick: number;
  /** How strongly momentum carries between live steps (0–1). */
  momentum: number;
  /** Volume scaling for synthesized bars. */
  volume: number;
  /** How strongly the asset follows the shared market pulse. */
  marketBeta: number;
  /** Chance of a fat-tail jump per historical candle. */
  jumpChance: number;
  /** Jump size in multiples of volatility. */
  jumpScale: number;
  /** Label describing the behaviour, shown in the chart header. */
  archetype: string;
}

export type ChartKind = "CRYPTO" | "STOCK";

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

/**
 * Smooth value noise in [-1, 1]. Consecutive samples are interpolated, so the
 * result drifts slowly instead of jumping every step — ideal for market
 * regimes, trends and volatility cycles.
 */
export function smoothNoise(seed: number, t: number): number {
  const index = Math.floor(t);
  const fraction = t - index;
  const a = seededRandom(seed ^ Math.imul(index + 1, 0x9e3779b1))() * 2 - 1;
  const b = seededRandom(seed ^ Math.imul(index + 2, 0x9e3779b1))() * 2 - 1;
  const eased = fraction * fraction * (3 - 2 * fraction);
  return a + (b - a) * eased;
}

const ARCHETYPES = [
  "Tren halus",
  "Volatil tinggi",
  "Pasar sideways",
  "Momentum kuat",
  "Sering gap",
] as const;

export function profileFor(
  symbol: string,
  kind: ChartKind = "CRYPTO",
): ChartProfile {
  const seed = hash(`chart:${symbol}`);
  const pick = (shift: number) => ((seed >>> shift) & 0xff) / 255;
  const crypto = kind === "CRYPTO";

  // Crypto moves faster and chops harder than a listed stock. Live steps are
  // per animation tick; historical candles are per chart candle, so they use
  // a much larger scale (a monthly crypto candle can easily move 3–8%).
  const volatility = crypto
    ? 0.0018 + pick(3) * 0.0062 // 0.18% – 0.80% per live step
    : 0.0007 + pick(3) * 0.0028; // 0.07% – 0.35% per live step
  const historyVolatility = crypto
    ? 0.028 + pick(5) * 0.055 // 2.8% – 8.3% per candle
    : 0.01 + pick(5) * 0.022; // 1.0% – 3.2% per candle
  const drift = (pick(7) - 0.5) * (crypto ? 0.0022 : 0.0012);
  const wick = 0.25 + pick(11) * 1.15;
  const momentum = 0.55 + pick(15) * 0.4;
  const volume = 0.6 + pick(19) * 1.9;
  const marketBeta = crypto ? 0.45 + pick(23) * 0.55 : 0.15 + pick(23) * 0.3;
  const jumpChance = crypto ? 0.03 + pick(27) * 0.03 : 0.008 + pick(27) * 0.012;
  const jumpScale = crypto ? 2.5 + pick(31) * 3 : 1.5 + pick(31) * 2;
  const volatileCut = crypto ? 0.0055 : 0.0025;
  const archetype =
    ARCHETYPES[
      volatility > volatileCut
        ? 1
        : Math.abs(drift) < 0.0003
          ? 2
          : drift > 0
            ? 3
            : 0
    ]!;

  return {
    seed,
    volatility,
    historyVolatility,
    drift,
    wick,
    momentum,
    volume,
    marketBeta,
    jumpChance,
    jumpScale,
    archetype,
  };
}

/**
 * One synthetic live step, deterministic in (symbol, step).
 *
 * The step blends three forces: its own momentum, a shared market pulse (all
 * crypto pairs react to it, like alts following BTC), and occasional jumps.
 * A slow volatility cycle makes calm stretches alternate with busy ones.
 */
export function liveStep(
  profile: ChartProfile,
  price: number,
  momentum: number,
  step: number,
): { price: number; momentum: number } {
  const rand = seededRandom(profile.seed ^ Math.imul(step + 1, 0x9e3779b1));

  // Volatility clustering: 0.4×–1.6× the base step size, changing slowly.
  const regime = Math.max(
    0.4,
    1 + smoothNoise(profile.seed ^ 0x1f123bb5, step / 40) * 0.6,
  );
  const vol = profile.volatility * regime;

  // Shared market pulse. The seed is constant, so every symbol sees the same
  // rhythm and correlated assets move together.
  const market = smoothNoise(0x51ed270b, step / 32);

  // Rare fat-tail step (a pump/dump), much less frequent than a candle jump.
  const jumpRand = seededRandom(
    profile.seed ^ Math.imul(step + 1, 0xc2b2ae35),
  );
  const jump =
    jumpRand() < profile.jumpChance * 0.12
      ? (jumpRand() - 0.5) * 2 * profile.jumpScale * vol
      : 0;

  const impulse = (rand() - 0.5) * 2 * vol;
  const nextMomentum =
    momentum * profile.momentum +
    profile.drift +
    impulse * (1 - profile.momentum * 0.5) +
    market * profile.marketBeta * vol * 0.35 +
    jump;

  const micro = (rand() - 0.5) * vol * 0.6;
  const next = Math.max(price * (1 + nextMomentum + micro), price * 0.5);
  return { price: next, momentum: nextMomentum };
}

/** Runtime guard for values that arrive from props. */
export function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
