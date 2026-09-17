import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./normalize-database-url";

export { normalizeDatabaseUrl } from "./normalize-database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: normalizeDatabaseUrl(process.env.DATABASE_URL || "") } },
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

// Reuse one client across hot reloads and long-lived PM2 workers.
globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export default prisma;
