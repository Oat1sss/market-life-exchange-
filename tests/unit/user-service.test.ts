/**
 * Integration facts for the registration service against a real Postgres.
 * Each test owns unique emails under a dedicated test domain and cleans up
 * after itself, so it never fights with real data in the shared dev database.
 */
import { afterEach, describe, expect, it } from "vitest";
import { registerUser } from "@/server/services/user-service";
import { prisma } from "@/server/db";

const EMAIL_DOMAIN = "register-task3.test";
const emails: string[] = [];

afterEach(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { contains: EMAIL_DOMAIN } } });
    emails.length = 0;
  }
});

async function uniqueEmail(): Promise<string> {
  const email = `task3-${Date.now()}-${Math.floor(Math.random() * 1e9)}@${EMAIL_DOMAIN}`;
  emails.push(email);
  return email;
}

describe("registerUser", () => {
  it("creates a user with an Argon2id hash", async () => {
    const email = await uniqueEmail();
    const result = await registerUser({ email, password: "hitratine4ker" });
    if (!result.ok) throw new Error(`unexpected rejection: ${result.code}`);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { passwordHash: true, displayName: true },
    });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.displayName.length).toBeGreaterThan(0);
  });

  it("rejects a duplicate email instead of creating twice", async () => {
    const email = await uniqueEmail();
    const first = await registerUser({ email, password: "hitratine4ker" });
    expect(first.ok).toBe(true);

    const second = await registerUser({ email, password: "another1pass" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("EMAIL_TAKEN");

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("stores emails normalized to lowercase", async () => {
    const email = await uniqueEmail();
    await registerUser({ email, password: "hitratine4ker" });

    const found = await prisma.user.findUnique({ where: { email } });
    expect(found).not.toBeNull();
    expect(found?.email).toBe(email);
    expect(found?.email).toBe(found?.email.toLowerCase());
  });
});
