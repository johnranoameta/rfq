/**
 * PM2 process file for Next.js production (`next start`).
 * Prerequisite: `npm run build`
 *
 * Usage:
 *   npx pm2 start ecosystem.config.cjs --env production
 *   npx pm2 logs rfq-ui
 *   npx pm2 stop rfq-ui
 */
module.exports = {
  apps: [
    {
      name: "rfq-ui",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: "5s",
      max_memory_restart: "1G",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
