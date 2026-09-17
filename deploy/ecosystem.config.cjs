/**
 * PM2 process file for native VPS deploy.
 * From repo root: pm2 start deploy/ecosystem.config.cjs
 */
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
        // SSR catalog fetches — never go through the public domain
        API_INTERNAL_URL: "http://127.0.0.1:4000",
      },
    },
  ],
};
