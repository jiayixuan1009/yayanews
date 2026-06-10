#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readEnvFile } from '../lib/read-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const appDir = process.env.APP_DIR || repoRoot;
const envPath = process.env.ENV_PATH || path.join(appDir, '.env');
const pipelineDataDir = process.env.PIPELINE_DATA_DIR || path.join(appDir, 'apps', 'pipeline', 'data');

const REQUIRED_ENV = [
  'DATABASE_URL',
  'ADMIN_API_TOKEN',
  'LLM_API_KEY',
  'LLM_BASE_URL',
  'LLM_MODEL',
  'ENABLE_PYTHON_WORKERS',
];

const EXPECTED_PM2_APPS = [
  'yayanews',
  'yaya-admin',
  'yaya-ws-gateway',
  'yaya-finnhub-ws',
  'yaya-pipeline-daemon',
  'yaya-worker-flash',
  'yaya-worker-articles',
];

function section(title) {
  console.log(`\n== ${title} ==`);
}

function ok(label, details = '') {
  console.log(`OK   ${label}${details ? ` - ${details}` : ''}`);
}

function warn(label, details = '') {
  console.log(`WARN ${label}${details ? ` - ${details}` : ''}`);
}

function fail(label, details = '') {
  console.log(`FAIL ${label}${details ? ` - ${details}` : ''}`);
}

function safeHost(value) {
  if (!value) return '';
  try {
    return new URL(value).host;
  } catch {
    return String(value).replace(/\/\/.*@/, '//<redacted>@').slice(0, 80);
  }
}

function readEnvSafe() {
  if (!fs.existsSync(envPath)) {
    fail('.env', `missing at ${envPath}`);
    return new Map();
  }
  ok('.env', envPath);
  return readEnvFile(envPath);
}

function inspectEnv(env) {
  section('Environment');
  for (const key of REQUIRED_ENV) {
    const value = env.get(key);
    if (!value || /^your-|please-generate|placeholder/i.test(value)) {
      warn(key, 'missing or placeholder');
      continue;
    }
    if (/URL|BASE/i.test(key)) {
      ok(key, `set host=${safeHost(value)}`);
    } else {
      ok(key, `set len=${value.length}`);
    }
  }

  const redisUrl = env.get('REDIS_URL');
  const redisHost = env.get('REDIS_HOST');
  const redisPort = env.get('REDIS_PORT');
  if (redisUrl) {
    ok('Redis', `REDIS_URL set host=${safeHost(redisUrl)}`);
  } else if (redisHost && redisPort) {
    ok('Redis', `REDIS_HOST/REDIS_PORT set host=${redisHost}:${redisPort}`);
  } else {
    warn('Redis', 'missing REDIS_URL or REDIS_HOST/REDIS_PORT');
  }

  const proxyKeys = ['ALL_PROXY', 'HTTPS_PROXY', 'HTTP_PROXY', 'all_proxy', 'https_proxy', 'http_proxy'];
  const activeProxyKeys = proxyKeys.filter(key => process.env[key]);
  if (activeProxyKeys.length > 0) {
    warn('shell proxy env', `${activeProxyKeys.join(', ')} set; PM2 clears proxies, so shell API probes may differ from workers`);
  }
}

function inspectHeartbeat() {
  section('Pipeline Heartbeat');
  const file = path.join(pipelineDataDir, 'daemon_heartbeat.txt');
  if (!fs.existsSync(file)) {
    warn('heartbeat', `missing at ${file}`);
    return;
  }

  try {
    const hb = JSON.parse(fs.readFileSync(file, 'utf8'));
    const age = hb.ts ? Math.floor(Date.now() / 1000 - Number(hb.ts)) : null;
    const status = age != null && age <= 120 ? ok : warn;
    status('heartbeat', `age=${age ?? 'unknown'}s queued=${hb.queued ?? 0} started=${hb.started ?? 0} failed24h=${hb.failed_recent ?? hb.failed ?? 0} finished=${hb.finished ?? 0}`);
    if (hb.msg) console.log(`INFO msg=${String(hb.msg).slice(0, 160)}`);
  } catch (err) {
    fail('heartbeat', err.message);
  }
}

function inspectPm2() {
  section('PM2');
  try {
    const raw = execFileSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 10000 });
    const apps = JSON.parse(raw);
    for (const name of EXPECTED_PM2_APPS) {
      const app = apps.find(item => item.name === name);
      if (!app) {
        warn(name, 'missing');
        continue;
      }
      const status = app.pm2_env?.status || 'unknown';
      const restarts = app.pm2_env?.restart_time ?? 0;
      const memMb = app.monit?.memory ? Math.round(app.monit.memory / 1024 / 1024) : 0;
      (status === 'online' ? ok : warn)(name, `status=${status} restarts=${restarts} memory=${memMb}MB`);
    }
  } catch (err) {
    warn('pm2', `unavailable: ${err.message}`);
  }
}

function inspectRq() {
  section('RQ');
  const script = path.join(appDir, 'apps', 'pipeline', 'scripts', 'inspect_rq.py');
  if (!fs.existsSync(script)) {
    warn('RQ inspect', `missing script at ${script}`);
    return;
  }

  const pythonCandidates = [
    process.env.PYTHON_BIN,
    path.join(appDir, 'apps', 'pipeline', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    path.join(appDir, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    process.platform === 'win32' ? 'python.exe' : 'python3',
  ].filter(Boolean);

  const python = pythonCandidates.find(candidate => {
    if (candidate.includes(path.sep)) return fs.existsSync(candidate);
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  });

  if (!python) {
    warn('RQ inspect', 'python not found');
    return;
  }

  try {
    const output = execFileSync(python, [script, '--limit', '3'], {
      cwd: appDir,
      env: { ...process.env, ENV_PATH: envPath },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
    });
    process.stdout.write(output.trimEnd() + '\n');
  } catch (err) {
    const stdout = String(err.stdout || '').trim();
    const stderr = String(err.stderr || '').trim();
    const hint = (stderr || stdout || err.message).split(/\r?\n/).filter(Boolean).slice(-1)[0] || err.message;
    warn('RQ inspect', hint.slice(0, 220));
  }
}

async function inspectDb(env) {
  section('Database');
  const databaseUrl = env.get('DATABASE_URL');
  if (!databaseUrl) {
    warn('database', 'DATABASE_URL missing');
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  try {
    await client.connect();
    ok('connect', safeHost(databaseUrl));

    const pending = await client.query(`
      SELECT status, COUNT(*)::int AS count, MIN(updated_at) AS oldest, MAX(updated_at) AS newest
      FROM articles
      WHERE status IN ('draft','review')
      GROUP BY status
      ORDER BY status
    `);
    if (pending.rows.length === 0) ok('draft/review', 'none');
    else console.table(pending.rows);

    const activity24h = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM flash_news WHERE published_at >= NOW() - INTERVAL '24 hours') AS flash_24h,
        (SELECT COUNT(*)::int FROM articles WHERE status='published' AND published_at >= NOW() - INTERVAL '24 hours') AS articles_24h
    `);
    ok('published flash 24h', String(activity24h.rows[0]?.flash_24h ?? 0));
    ok('published articles 24h', String(activity24h.rows[0]?.articles_24h ?? 0));

    const runs24h = await client.query(`
      SELECT
        run_type,
        COUNT(*)::int AS runs,
        COALESCE(SUM(items_produced), 0)::int AS produced,
        COALESCE(SUM(error_count), 0)::int AS errors,
        MAX(started_at) AS latest_started
      FROM pipeline_runs
      WHERE started_at >= NOW() - INTERVAL '24 hours'
      GROUP BY run_type
      ORDER BY latest_started DESC
    `);
    if (runs24h.rows.length === 0) warn('pipeline runs 24h', 'none');
    else console.table(runs24h.rows);

    try {
      const llm24h = await client.query(`
        SELECT
          route,
          model,
          status,
          COUNT(*)::int AS calls,
          MAX(created_at) AS latest_call
        FROM llm_usage
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY route, model, status
        ORDER BY latest_call DESC
        LIMIT 12
      `);
      if (llm24h.rows.length === 0) warn('LLM usage 24h', 'none recorded');
      else console.table(llm24h.rows);
    } catch (err) {
      warn('LLM usage', `unavailable: ${err.message}`);
    }
  } catch (err) {
    fail('database', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  console.log(`YayaNews health report`);
  console.log(`appDir=${appDir}`);
  console.log(`time=${new Date().toISOString()}`);

  const env = readEnvSafe();
  inspectEnv(env);
  inspectHeartbeat();
  inspectPm2();
  inspectRq();
  await inspectDb(env);
}

main().catch(err => {
  fail('health-report', err.stack || err.message);
  process.exitCode = 1;
});
