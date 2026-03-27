import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Next.js standalone mode changes process.cwd() to .next/standalone, so we must compensate.
const basePath = process.cwd().includes('.next')
  ? path.join(process.cwd(), '..', '..')
  : process.cwd();

const STATUS_FILE = path.join(basePath, 'data', 'daemon_status.txt');
const HEARTBEAT_FILE = path.join(basePath, 'data', 'daemon_heartbeat.txt');
const CONFIG_FILE = path.join(basePath, 'data', 'daemon_config.json');
const RUN_LOG_FILE = path.join(basePath, 'data', 'pipeline_run.log');

function getStatus() {
  let statusStr = 'running';
  try {
    statusStr = fs.readFileSync(STATUS_FILE, 'utf-8').trim();
  } catch { /* default to running */ }

  let log = '';
  let running = statusStr !== 'paused';
  const pid = running ? 1 : null; // Representing PM2 daemon Active state

  try {
    const rawHb = fs.readFileSync(HEARTBEAT_FILE, 'utf-8');
    const hb = JSON.parse(rawHb);
    const dateStr = new Date(hb.ts * 1000).toLocaleString('zh-CN');
    
    if (Date.now() / 1000 - hb.ts > 120 && running) {
       // If no heartbeat for 2 minutes and it claims to be running, it might be dead
       log = `[${dateStr}] 警告: 离线超过 2 分钟，后台守护进程可能意外退出。\n最后信息: ${hb.msg}`;
       running = false;
    } else {
       log = `[${dateStr}] 守护进程心跳: ${hb.msg}`;
    }
  } catch {
    log = statusStr === 'paused' ? '系统已暂停' : '守护进程启动中，等待心跳信号...';
  }

  // If paused, prepend a clear message
  if (statusStr === 'paused') {
    log = `[已暂停] 生产管道目前处于中断状态。\n${log}`;
  } else {
    log = `[运行中] (后台 PM2 7x24 常驻调度模式)\n${log}`;
  }

  try {
    if (fs.existsSync(RUN_LOG_FILE)) {
      const runLog = fs.readFileSync(RUN_LOG_FILE, 'utf-8');
      // Serve the last ~8000 chars to avoid massive payload but contain enough info for parsing
      log += '\n\n' + runLog.slice(-8000);
    }
  } catch { /* ignore log read fail */ }

  return { running, pid, log };
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
      return NextResponse.json({ success: true, message: '已请求中断 Pipeline' });
    }

    if (action === 'start') {
      const mode = url.searchParams.get('mode') || 'all';
      const articles = parseInt(url.searchParams.get('articles') || '10', 10);
      const flash = parseInt(url.searchParams.get('flash') || '15', 10);
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ mode, articles, flash, timestamp: Date.now() }));
      fs.writeFileSync(STATUS_FILE, 'running');
      return NextResponse.json({ success: true, pid: 1, message: '已请求恢复 Pipeline' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: '状态写入失败: ' + err.message }, { status: 500 });
  }
}

