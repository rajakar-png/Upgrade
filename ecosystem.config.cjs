// PM2 Ecosystem Config — AstraNodes
// SQLite requires single writer: exec_mode must be "fork" (not "cluster")
// This file is used by deploy.sh which updates the cwd path at deploy time.
// For local dev, run: npm run dev (from backend/)

module.exports = {
  apps: [
    {
      name: "astranodes-api",
      script: "./src/server.js",
      cwd: "/opt/astranodes/backend",   // Updated by deploy.sh to match APP_DIR
      interpreter: "node",
      exec_mode: "fork",                // SQLite: single process only
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,             // 3 s cooldown between restarts
      max_restarts: 10,
      env_production: {
        NODE_ENV: "production",
        // All other vars are loaded from backend/.env at runtime
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/pm2/astranodes-error.log",
      out_file: "/var/log/pm2/astranodes-out.log",
      merge_logs: true,
    },
  ],
}
