/**
 * PM2 常驻：Next.js Web + Finnhub WebSocket + Pipeline 调度 + RQ Worker
 * 需在项目根目录执行，且已配置 .env（LLM_API_KEY、FINNHUB_KEY 等）
 *   cd /var/www/yayanews && pm2 start ecosystem.config.cjs
 *
 * Python 进程说明：
 *   PM2 不接受裸命令名如 "python"，需要传完整路径。
 *   此处使用 interpreter: "python3" 配合 script 为模块入口脚本的方式兼容 Ubuntu。
 */
const root = __dirname;
const pythonBin = process.env.PYTHON_BIN || "python3";

module.exports = {
  apps: [
    {
      name: "yayanews",
      cwd: root,
      script: "node_modules/.bin/next",
      args: "start",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      env: { NODE_ENV: "production", PORT: 3002 },
    },
    {
      name: "yaya-finnhub-ws",
      cwd: root,
      script: pythonBin,
      args: "-m pipeline.daemon.finnhub_ws_flash",
      interpreter: "none",
      autorestart: true,
      max_restarts: 50,
      min_uptime: "10s",
    },
    {
      name: "yaya-pipeline-daemon",
      cwd: root,
      script: pythonBin,
      args: "-m pipeline.run_daemon",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "30s",
    },
    {
      name: "yaya-ws-gateway",
      cwd: root,
      script: "src/ws-server.js",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
    },
    {
      name: "yaya-pipeline-worker",
      cwd: root,
      script: pythonBin,
      args: "-m pipeline.worker",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
    },
  ],
};
