/**
 * 仅 Next 站点（与 Python Pipeline 同机时可与 ecosystem.config.cjs 合并）
 * cd biyanews && pm2 start deploy/ecosystem.web.cjs
 */
const root = require("path").join(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "yayanews-web",
      cwd: root,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 30,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://yayanews.cryptooptiontool.com",
      },
    },
  ],
};
