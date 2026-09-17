/**
 * PM2 process file for native VPS deploy.
 * From repo root: pm2 start deploy/ecosystem.config.cjs
 */
const path = require("path");
const fs = require("fs");

// Load root .env into this process so PM2 injects fresh values on start/restart.
const rootEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
}

const databaseUrl = process.env.DATABASE_URL || "";
const directUrl = process.env.DIRECT_URL || databaseUrl;

module.exports = {
  apps: [
    {
      name: "aes-api",
      cwd: "./apps/api",
      script: "dist/index.js",
      interpreter: "node",
      node_args: "--env-file=../../.env",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        DIRECT_URL: directUrl,
        JWT_SECRET: process.env.JWT_SECRET || "",
        CORS_ORIGIN: process.env.CORS_ORIGIN || "",
        APP_URL: process.env.APP_URL || "",
        API_URL: process.env.API_URL || "",
        API_PORT: process.env.API_PORT || "4000",
      },
    },
    {
      name: "aes-web",
      cwd: "./apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3016",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3016,
        HOSTNAME: "0.0.0.0",
        API_INTERNAL_URL: "http://127.0.0.1:4000",
        NEXT_PUBLIC_API_URL:
          process.env.NEXT_PUBLIC_API_URL || "https://aienterprisestudio.com",
      },
    },
  ],
};
