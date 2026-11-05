/**
 * Deterministic randomness for the market simulation.
 *
 * There is no mutable PRNG state: every draw is derived from
 * HMAC-SHA256(seed, "label:tick:index"). That makes any game replayable from
 * its persisted seed and makes market tests reproducible across runs and
 * machines. `Math.random` must never be used for gameplay.
 */
import { createHmac } from "node:crypto";

const TWO_POW_53 = 9_007_199_254_740_992;

function digest(seed: bigint, label: string, tick: number, index: number): Buffer {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError(`Tick must be a non-negative integer: ${tick}`);
  }
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError(`Index must be a non-negative integer: ${index}`);
  }
  return createHmac("sha256", seed.toString(16))
    .update(`${label}:${tick}:${index}`)
    .digest();
}

/**
 * Uniform draw in [0, 1). Uses the top 53 bits of the HMAC output so the
 * value is exactly representable and identical on every platform.
 */
export function deriveUniform(
  seed: bigint,
  label: string,
  tick: number,
  index = 0,
): number {
  const bits = digest(seed, label, tick, index).readBigUInt64BE(0) >> 11n;
  return Number(bits) / TWO_POW_53;
}

/**
 * Standard normal draw via Box–Muller. Uses floating-point transcendental
 * functions, which are deterministic for a given engine/build; tests assert
 * distribution and reproducibility rather than bit-identical values.
 */
export function deriveGaussian(
  seed: bigint,
  label: string,
  tick: number,
  index = 0,
): number {
  const u1 = deriveUniform(seed, label, tick, index * 2);
  const u2 = deriveUniform(seed, label, tick, index * 2 + 1);
  const safeU1 = Math.max(u1, Number.EPSILON);
  return Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
}

/** Uniform integer in [min, maxExclusive). */
export function deriveInt(
  seed: bigint,
  label: string,
  tick: number,
  min: number,
  maxExclusive: number,
  index = 0,
): number {
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(maxExclusive) ||
    maxExclusive <= min
  ) {
    throw new RangeError(`Invalid integer range [${min}, ${maxExclusive})`);
  }
  const span = maxExclusive - min;
  return min + Math.floor(deriveUniform(seed, label, tick, index) * span);
}

/** Deterministic probability check, `probability` in [0, 1]. */
export function deriveChance(
  seed: bigint,
  label: string,
  tick: number,
  probability: number,
  index = 0,
): boolean {
  if (!(probability >= 0 && probability <= 1)) {
    throw new RangeError(`Probability must be within [0, 1]: ${probability}`);
  }
  return deriveUniform(seed, label, tick, index) < probability;
}
