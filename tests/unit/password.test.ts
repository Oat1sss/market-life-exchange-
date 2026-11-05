import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/password";
import { LoginSchema, RegisterSchema } from "@/lib/validation/auth";

describe("password hashing", () => {
  it("roundtrips a password through hash and verify", async () => {
    const hash = await hashPassword("hitratine4ker");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).toContain("m=19456,t=2,p=1");
    expect(await verifyPassword("hitratine4ker", hash)).toBe(true);
    expect(await verifyPassword("hitratine4kerX", hash)).toBe(false);
  });

  it("produces different hashes for identical inputs (random salt)", async () => {
    const a = await hashPassword("hitratine4ker");
    const b = await hashPassword("hitratine4ker");
    expect(a).not.toBe(b);
  });

  it("exposes a valid dummy hash so failed lookups still do full work", async () => {
    expect(DUMMY_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    const match = await verifyPassword("mktlife-no-user-once", DUMMY_HASH);
    expect(match).toBe(true);
    const mismatch = await verifyPassword("anything-else", DUMMY_HASH);
    expect(mismatch).toBe(false);
  });
});

describe("auth validation schemas", () => {
  it("normalizes emails to lowercase", () => {
    expect(RegisterSchema.parse({ email: "  Mixed@Mail.COM ", password: "hitratine4ker" }).email).toBe("mixed@mail.com");
  });

  it("rejects weak passwords with field errors", () => {
    const parsed = RegisterSchema.safeParse({ email: "a@mail.com", password: "short" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors.password ?? [];
      expect(fields.some((message) => message.includes("8"))).toBe(true);
    }
  });

  it("login requires only a shaped password presence", () => {
    expect(
      LoginSchema.safeParse({ email: "a@mail.com", password: "" }).success,
    ).toBe(false);
    expect(
      LoginSchema.safeParse({ email: "a@mail.com", password: "x" }).success,
    ).toBe(true);
  });
});
