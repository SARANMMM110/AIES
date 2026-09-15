import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "@aes/database";

async function main() {
  // Verify database connectivity at boot
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    console.log(`[api] ${env.APP_NAME} listening on ${env.API_URL} (port ${env.API_PORT})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[api] failed to start", err);
  process.exit(1);
});
