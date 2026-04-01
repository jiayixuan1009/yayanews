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
const mergedEnv = { 
  ...process.env, 
  ...baseEnv,
  PYTHONPATH: path.join(root, "apps", "pipeline")
};
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

module.exports = {
  apps: [
    {
      name: "yayanews",
      cwd: root,
      script: "apps/web/.next/standalone/apps/web/server.js",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "1G",
      env: { ...mergedEnv, NODE_ENV: "production", PORT: 3002, HOSTNAME: "0.0.0.0" },
    },
    {
      name: "yaya-finnhub-ws",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/daemon/finnhub_ws_flash.py",
      interpreter: pythonBin,
      autorestart: true,
      max_restarts: 50,
      min_uptime: "10s",
      kill_timeout: 10000,
      env: mergedEnv,
    },
    {
      name: "yaya-pipeline-daemon",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/run_daemon.py",
      interpreter: pythonBin,
      autorestart: true,
      max_restarts: 20,
      min_uptime: "30s",
      max_memory_restart: "400M",
      kill_timeout: 10000,
      env: mergedEnv,
    },
    {
      name: "yaya-ws-gateway",
      cwd: path.join(root, "apps", "ws-server"),
      script: "dist/server.js",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "800M",
      env: mergedEnv,
    },
    {
      name: "yaya-admin",
      cwd: root,
      script: "apps/admin/.next/standalone/apps/admin/server.js",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "1G",
      env: { ...mergedEnv, NODE_ENV: "production", PORT: 3003, HOSTNAME: "0.0.0.0" },
    },
    {
      name: "yaya-worker-flash",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/worker.py",
      interpreter: pythonBin,
      instances: 8,
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "800M",
      kill_timeout: 10000,
      env: { ...mergedEnv, RQ_QUEUES: "yayanews:flash" },
    },
    {
      name: "yaya-worker-articles",
      cwd: path.join(root, "apps", "pipeline"),
      script: "pipeline/worker.py",
      interpreter: pythonBin,
      instances: 8,
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
      max_memory_restart: "800M",
      kill_timeout: 10000,
      env: { ...mergedEnv, RQ_QUEUES: "yayanews:articles" },
    },
  ],
};
