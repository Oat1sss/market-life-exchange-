/**
 * Prisma client singleton (see docs/ARCHITECTURE.md "server/" layer).
 *
 * Prisma 7 connects through a driver adapter; the connection string comes
 * from DATABASE_URL in the environment. Never import this module from
 * src/domain — the domain layer has no I/O.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy it into .env (see README, Setup section).",
  );
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
