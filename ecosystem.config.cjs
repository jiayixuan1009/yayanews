/**
 * PM2 常驻：Finnhub WebSocket 快讯缓冲 + Pipeline 周期调度
 * 需在 biyanews 目录执行，且已配置 .env（LLM_API_KEY、FINNHUB_KEY 等）
 *   cd biyanews && pm2 start ecosystem.config.cjs
 */
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "yaya-finnhub-ws",
      cwd: root,
      script: "python",
      args: "-m pipeline.daemon.finnhub_ws_flash",
      autorestart: true,
      max_restarts: 50,
      min_uptime: "10s",
    },
    {
      name: "yaya-pipeline-daemon",
      cwd: root,
      script: "python",
      args: "-m pipeline.run_daemon",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "30s",
    },
  ],
};
