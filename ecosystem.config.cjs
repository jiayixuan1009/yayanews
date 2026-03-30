/**
 * PM2 常驻：Next.js Web + Finnhub WebSocket + Pipeline 调度 + RQ Worker
 * 需在项目根目录执行，且已配置 .env（LLM_API_KEY、FINNHUB_KEY 等）
 *   cd /var/www/yayanews && pm2 start ecosystem.config.cjs
 *
 * Python 进程说明：
 *   PM2 不接受裸命令名如 "python"，需要传完整路径。
 *   此处使用 interpreter: "python3" 配合 script 为模块入口脚本的方式兼容 Ubuntu。
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
let baseEnv = {};
try {
  const envContent = fs.readFileSync(path.join(root, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        val = val.replace(/^["'](.*)["']$/, '$1');
        baseEnv[key] = val;
      }
    }
  });
} catch (e) {
  console.warn('No .env file found or failed to parse. Proceeding with default env.');
}

// 确保与系统当前环境变量合并，避免丢失某些继承信息
const mergedEnv = { ...process.env, ...baseEnv };
const pythonBin = mergedEnv.PYTHON_BIN || "python3";

module.exports = {
  apps: [
    {
      name: "yayanews",
      cwd: root,
      script: "apps/web/.next/standalone/apps/web/server.js",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      env: { ...mergedEnv, NODE_ENV: "production", PORT: 3002, HOSTNAME: "0.0.0.0" },
    },
    {
      name: "yaya-finnhub-ws",
      cwd: path.join(root, "apps", "pipeline"),
      script: pythonBin,
      args: "-m pipeline.daemon.finnhub_ws_flash",
      interpreter: "none",
      autorestart: true,
      max_restarts: 50,
      min_uptime: "10s",
      env: mergedEnv,
    },
    {
      name: "yaya-pipeline-daemon",
      cwd: path.join(root, "apps", "pipeline"),
      script: pythonBin,
      args: "-m pipeline.run_daemon",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "30s",
      env: mergedEnv,
    },
    {
      name: "yaya-ws-gateway",
      cwd: root,
      script: "apps/web/src/ws-server.js",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      env: mergedEnv,
    },
    {
      name: "yaya-pipeline-worker",
      cwd: path.join(root, "apps", "pipeline"),
      script: pythonBin,
      args: "-m pipeline.worker",
      interpreter: "none",
      instances: 4,
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      env: mergedEnv,
    },
  ],
};
