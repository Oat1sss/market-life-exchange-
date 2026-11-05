/**
 * Password hashing (Argon2id) with one shared parameter set, so every hash in
 * the database — real ones and the no-user timing-equalizer — costs the same
 * verify time. Constants follow OWASP's Argon2id recommendation
 * (m=19456 KiB, t=2 iterations, p=1 lane).
 */
import { hash as argon2Hash, verify as argon2Verify } from "argon2";

const ARGON2_OPTIONS = {
  type: 2 as const, // argon2.argon2id
  timeCost: 2,
  memoryCost: 19_456,
  parallelism: 1,
};

/** Hash with a fresh random salt. Never store the plain text. */
export function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

/**
 * Constant-time-ish verification. When the email does not exist, callers pass
 * a stored `DUMMY_HASH` so both failure branches do one Argon2 verify.
 */
/** Verify `storedHash` against password: argon2 v0.45 API (digest first). */
export function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  return argon2Verify(storedHash, password);
}

/**
 * Hash of a fixed input ('mktlife-no-user-once'), generated once offline with
 * the same parameters. Not a secret: it lets an unknown email verification do
 * real work instead of returning early.
 */
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$O1oNohxCRnAbJa5MdczSUw$o1+TsBNIj9LRkcMJ+TOZqOW5ssidjN0SWC3we4/qX3A";

export {};
