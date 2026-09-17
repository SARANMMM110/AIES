import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function databaseUrl() {
  const raw = process.env.DATABASE_URL || "";
  if (!raw) return raw;
  // Cap pool size for long-lived PM2 workers talking to Supabase session pooler.
  if (/[?&]connection_limit=/.test(raw)) return raw;
  return `${raw}${raw.includes("?") ? "&" : "?"}connection_limit=5&pool_timeout=20`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

// Reuse one client across hot reloads and long-lived PM2 workers.
globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export default prisma;
