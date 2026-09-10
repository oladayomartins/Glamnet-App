import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./database-url";

/**
 * A single Prisma client per process. Next.js hot-reloads modules in
 * development, so the client is cached on `globalThis` to avoid exhausting
 * connections across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Omitted entirely when nothing needs overriding, so the datasource falls
    // back to DATABASE_URL exactly as Prisma would resolve it on its own.
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
