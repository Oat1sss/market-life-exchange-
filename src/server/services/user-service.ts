/**
 * User registration service. Rejection and creation happen server-side; the
 * email uniqueness is enforced by the `users.email` unique index, so a race
 * between two registrations cannot produce duplicates.
 */
import { Prisma } from "@/generated/prisma/index";
import { hashPassword } from "@/server/password";
import { prisma } from "@/server/db";
import type { RegisterInput } from "@/lib/validation/auth";

export type RegistrationResult =
  | { ok: true; userId: string }
  | { ok: false; code: "EMAIL_TAKEN" };

const DISPLAY_NAME_MAX = 80;

function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  const name = localPart.length > 0 ? localPart : "Player";
  return name.length > DISPLAY_NAME_MAX ? name.slice(0, DISPLAY_NAME_MAX) : name;
}

export async function registerUser(
  input: RegisterInput,
): Promise<RegistrationResult> {
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        displayName: displayNameFromEmail(input.email),
      },
      select: { id: true },
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, code: "EMAIL_TAKEN" };
    }
    throw error;
  }
}
