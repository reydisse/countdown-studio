// PM2 process manager config
// Usage:
//   npm i -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save          ← persist across reboots
//   pm2 startup       ← generate & run the startup command it prints

module.exports = {
  apps: [
    {
      name: "showstack",
      script: "./packages/server/src/index.js",

      // ── Environment ────────────────────────────────────────────────────────
      env: {
        NODE_ENV: "production",
        PORT: 9876,

        // Public URL of your Cloudflare Tunnel subdomain.
        // Asset URLs stored in the DB will use this as their base.
        SERVER_BASE_URL: "https://countdownstudio.faithfireproduction.com",

        // Where media lives on disk (defaults to ~/ShowPilot/media if unset)
        // SHOWPILOT_MEDIA_DIR: '/mnt/media/showpilot',
      },

      // ── Reliability ────────────────────────────────────────────────────────
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,

      // ── Logging ────────────────────────────────────────────────────────────
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
