import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

interface PipelineMetrics {
  queued: number;
  started: number;
  failed: number;
  failedTotal: number;
  finished: number;
}

interface PipelineHeartbeat {
  ts?: number;
  msg?: string;
  queued?: number;
  started?: number;
  failed?: number;
  failed_total?: number;
  failed_recent?: number;
  finished?: number;
}

type PipelineState = 'running' | 'paused' | 'offline';

function resolvePipelineDataDir() {
  const configured = process.env.PIPELINE_DATA_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  const productionDefault = '/var/www/yayanews/apps/pipeline/data';
  if (fs.existsSync(productionDefault)) {
    return productionDefault;
  }

  if (process.cwd().toLowerCase().includes('d:\\news')) {
    return path.join('d:\\news', 'yayanews-production', 'apps', 'pipeline', 'data');
  }

  let current = process.cwd();
  while (current.length > 5 && !fs.existsSync(path.join(current, 'apps', 'pipeline'))) {
    current = path.dirname(current);
  }
  return path.join(current, 'apps', 'pipeline', 'data');
}

const PIPELINE_DATA = resolvePipelineDataDir();

const STATUS_FILE = path.join(PIPELINE_DATA, 'daemon_status.txt');
const HEARTBEAT_FILE = path.join(PIPELINE_DATA, 'daemon_heartbeat.txt');
const CONFIG_FILE = path.join(PIPELINE_DATA, 'daemon_config.json');
const RUN_LOG_FILE = path.join(PIPELINE_DATA, 'pipeline_run.log');

function getStatus() {
  let statusStr = 'running';
  try {
    statusStr = fs.readFileSync(STATUS_FILE, 'utf-8').trim();
  } catch {
    // Missing status file means the daemon should be considered enabled.
  }

  const requestedRunning = statusStr !== 'paused';
  let running = requestedRunning;
  let state: PipelineState = requestedRunning ? 'running' : 'paused';
  let heartbeatAgeSeconds: number | null = null;
  let lastHeartbeatAt: string | null = null;
  let log = '';
  let metrics: PipelineMetrics = { queued: 0, started: 0, failed: 0, failedTotal: 0, finished: 0 };

  try {
    const rawHb = fs.readFileSync(HEARTBEAT_FILE, 'utf-8');
    const hb = JSON.parse(rawHb) as PipelineHeartbeat;
    const ts = Number(hb.ts || 0);
    const date = ts > 0 ? new Date(ts * 1000) : null;
    const dateStr = date ? date.toLocaleString('zh-CN') : '未知时间';
    lastHeartbeatAt = date ? date.toISOString() : null;
    heartbeatAgeSeconds = ts > 0 ? Math.floor(Date.now() / 1000 - ts) : null;

    metrics = {
      queued: hb.queued || 0,
      started: hb.started || 0,
      failed: hb.failed_recent ?? hb.failed ?? 0,
      failedTotal: hb.failed_total ?? hb.failed ?? 0,
      finished: hb.finished || 0,
    };

    if ((heartbeatAgeSeconds == null || heartbeatAgeSeconds > 120) && requestedRunning) {
      running = false;
      state = 'offline';
      log = `[${dateStr}] 警告: 守护进程心跳已超过 2 分钟，后台调度可能已离线。\n最后消息: ${hb.msg || '-'}`;
    } else {
      log = `[${dateStr}] 守护进程心跳: ${hb.msg || 'idle'}`;
    }
  } catch (err: any) {
    if (requestedRunning) {
      running = false;
      state = 'offline';
    }
    log = statusStr === 'paused'
      ? '系统已暂停。'
      : `目前没有获取到心跳数据。\n[DEBUG] 路径: ${HEARTBEAT_FILE}\n[DEBUG] 错误: ${err?.message || '未知'}`;
  }

  if (statusStr === 'paused') {
    running = false;
    state = 'paused';
    log = `[已暂停] 内容生产 Pipeline 当前处于暂停状态。\n${log}`;
  } else {
    const prefix = state === 'offline'
      ? '[离线异常] 后台守护进程未按时写入心跳。'
      : '[运行中] 后台 PM2 常驻调度模式。';
    log = `${prefix}\n${log}`;
  }

  try {
    if (fs.existsSync(RUN_LOG_FILE)) {
      const runLog = fs.readFileSync(RUN_LOG_FILE, 'utf-8');
      log += '\n\n' + runLog.slice(-8000);
    }
  } catch {
    // Ignore optional log read failures.
  }

  return {
    running,
    state,
    pid: running ? 1 : null,
    log,
    metrics,
    heartbeatAgeSeconds,
    lastHeartbeatAt,
  };
}

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  return NextResponse.json(getStatus());
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = req.nextUrl;
  const action = url.searchParams.get('action') || 'start';

  if (action !== 'start' && action !== 'stop') {
    return NextResponse.json({ error: '无效的操作指令' }, { status: 400 });
  }

  try {
    const dir = path.dirname(STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (action === 'stop') {
      fs.writeFileSync(STATUS_FILE, 'paused');
      return NextResponse.json({ success: true, message: '已请求暂停 Pipeline' });
    }

    const mode = url.searchParams.get('mode') || 'all';
    const articles = clampInt(url.searchParams.get('articles'), 1, 50, 10);
    const flash = clampInt(url.searchParams.get('flash'), 1, 100, 15);

    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ mode, articles, flash, timestamp: Date.now() }));
    fs.writeFileSync(STATUS_FILE, 'running');
    return NextResponse.json({ success: true, pid: 1, message: '已请求恢复 Pipeline' });
  } catch (err: any) {
    return NextResponse.json({ error: '状态写入失败: ' + err.message }, { status: 500 });
  }
}

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
