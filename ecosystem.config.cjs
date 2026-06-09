/**
 * PM2 常驻：Next.js Web + Finnhub WebSocket + Pipeline 调度 + RQ Worker
 * 需在项目根目录执行，且已配置 .env（LLM_API_KEY、FINNHUB_KEY 等）
 *   cd /var/www/yayanews && pm2 start ecosystem.config.cjs
 *
 * Python 进程说明：
 *   PM2 不接受裸命令名如 "python"，需要传完整路径。
 *   此处使用 interpreter: "python3" 配合 script 为模块入口脚本的方式兼容 Ubuntu。
 */
const path = require('path');
const { readEnvFile } = require('./scripts/lib/read-env.cjs');

const root = __dirname;
let baseEnv = {};
try {
  baseEnv = Object.fromEntries(readEnvFile(path.join(root, '.env')));
} catch (e) {
  console.warn('No .env file found or failed to parse. Proceeding with default env.');
}

// 确保与系统当前环境变量合并，避免丢失某些继承信息
// 注意：必须清除代理变量，否则 pg 数据库连接会被 SOCKS5 代理劫持导致超时
const mergedEnv = { 
  ...process.env, 
  ...baseEnv,
  PYTHONPATH: path.join(root, "apps", "pipeline"),
  ALL_PROXY: '',
  HTTP_PROXY: '',
  HTTPS_PROXY: '',
  all_proxy: '',
  http_proxy: '',
  https_proxy: '',
};
mergedEnv.PIPELINE_DATA_DIR = mergedEnv.PIPELINE_DATA_DIR || path.join(root, "apps", "pipeline", "data");
let pythonBin = mergedEnv.PYTHON_BIN || "python3";
try {
  if (!path.isAbsolute(pythonBin)) {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    try {
      pythonBin = require('child_process').execSync(`${whichCmd} ${pythonBin}`).toString().split('\n')[0].trim();
    } catch (err) {
      // If "python" fails (common on Ubuntu where only python3 exists), explicitly try python3
      pythonBin = require('child_process').execSync(`${whichCmd} python3`).toString().split('\n')[0].trim();
    }
  }
} catch (e) {
  console.warn(`Could not resolve absolute path for ${pythonBin}, fallback to string value.`);
}

// --- Shared robust restart defaults ---
// exp_backoff_restart_delay: Exponential backoff caps restart storm (100ms base → ~3min max)
// max_restarts: 15 in 30s window prevents runaway restart loops
// min_uptime: "20s" means a restart only counts if app was stable <20s (prevents false positives)
// kill_timeout: 5000ms gives graceful SIGTERM time before SIGKILL
// listen_timeout: 8000ms for Next.js server readiness
const robustNode = {
  autorestart: true,
  exp_backoff_restart_delay: 200,
  max_restarts: 15,
  min_uptime: "20s",
  kill_timeout: 5000,
  listen_timeout: 8000,
};

module.exports = {
  apps: [
    {
      name: "yayanews",
      cwd: root,
      script: "apps/web/.next/standalone/apps/web/server.js",
      ...robustNode,
      max_memory_restart: "800M",
      env: {
        ...mergedEnv,
        NODE_ENV: "production",
        PORT: 3002,
        HOSTNAME: mergedEnv.WEB_HOSTNAME || "127.0.0.1",
      },
    },
    ...(mergedEnv.ENABLE_PYTHON_WORKERS === 'true' ? [
    {
      name: "yaya-finnhub-ws",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/daemon/finnhub_ws_flash.py",
      interpreter: pythonBin,
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 30,
      min_uptime: "20s",
      max_memory_restart: "200M",
      kill_timeout: 10000,
      env: mergedEnv,
    },
    {
      name: "yaya-pipeline-daemon",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/run_daemon.py",
      interpreter: pythonBin,
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 15,
      min_uptime: "30s",
      max_memory_restart: "300M",
      kill_timeout: 10000,
      env: mergedEnv,
    },
    {
      name: "yaya-worker-flash",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/worker.py",
      interpreter: pythonBin,
      instances: 1,
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 20,
      min_uptime: "20s",
      max_memory_restart: "200M",
      kill_timeout: 10000,
      env: { ...mergedEnv, RQ_QUEUES: "yayanews:flash" },
    },
    {
      name: "yaya-worker-articles",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/worker.py",
      interpreter: pythonBin,
      instances: 1,
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 20,
      min_uptime: "20s",
      max_memory_restart: "200M",
      kill_timeout: 10000,
      env: { ...mergedEnv, RQ_QUEUES: "yayanews:articles:high,yayanews:articles:default,yayanews:articles:low,yayanews:articles" },
    }
    ] : []),
    {
      name: "yaya-ws-gateway",
      cwd: path.join(root, "apps", "ws-server"),
      script: "dist/server.js",
      ...robustNode,
      max_memory_restart: "400M",
      // Pin WS_PORT so Nginx upstream and the gateway cannot drift silently.
      env: {
        ...mergedEnv,
        NODE_ENV: "production",
        WS_HOST: mergedEnv.WS_HOST || "127.0.0.1",
        WS_PORT: mergedEnv.WS_PORT || 3001,
      },
    },
    {
      name: "yaya-admin",
      cwd: root,
      script: "apps/admin/.next/standalone/apps/admin/server.js",
      ...robustNode,
      max_memory_restart: "600M",
      env: {
        ...mergedEnv,
        NODE_ENV: "production",
        PORT: 3003,
        HOSTNAME: mergedEnv.ADMIN_HOSTNAME || "127.0.0.1",
      },
    }
  ],
};
