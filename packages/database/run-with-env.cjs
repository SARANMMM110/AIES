/**
 * Load monorepo root .env, then run a command with that environment.
 * Usage: node ./run-with-env.cjs prisma migrate deploy
 */
const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node run-with-env.cjs <command> [args...]");
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
