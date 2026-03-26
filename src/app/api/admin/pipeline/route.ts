import { NextRequest, NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const PID_FILE = path.join(process.cwd(), 'data', 'pipeline.pid');
const LOG_FILE = path.join(process.cwd(), 'data', 'pipeline.log');

const VALID_MODES = ['all', 'articles', 'flash'] as const;
const MIN_COUNT = 1;
const MAX_ARTICLES = 50;
const MAX_FLASH = 100;

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n !== Math.floor(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readPid(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getStatus(): { running: boolean; pid: number | null; log: string } {
  const pid = readPid();
  const running = pid !== null && isProcessRunning(pid);
  let log = '';
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n');
    log = lines.slice(-80).join('\n');
  } catch { /* no log */ }

  if (!running && pid !== null) {
    try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
  }

  return { running, pid: running ? pid : null, log };
}

export function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  return NextResponse.json(getStatus());
}

export function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = req.nextUrl;
  const action = url.searchParams.get('action') || 'start';

  if (action !== 'start' && action !== 'stop') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (action === 'stop') {
    const pid = readPid();
    if (pid && isProcessRunning(pid)) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${pid} /T /F`, { timeout: 5000 });
        } else {
          process.kill(pid, 'SIGTERM');
        }
      } catch { /* already dead */ }
      try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
    }
    return NextResponse.json({ success: true, message: 'Pipeline stopped' });
  }

  const status = getStatus();
  if (status.running) {
    return NextResponse.json({ error: 'Pipeline is already running', pid: status.pid }, { status: 409 });
  }

  const modeRaw = url.searchParams.get('mode') || 'all';
  if (!VALID_MODES.includes(modeRaw as typeof VALID_MODES[number])) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  const articles = clampInt(url.searchParams.get('articles'), MIN_COUNT, MAX_ARTICLES, 10);
  const flash = clampInt(url.searchParams.get('flash'), MIN_COUNT, MAX_FLASH, 15);

  const args = ['-m', 'pipeline.run'];
  if (modeRaw === 'articles') {
    args.push('--articles-only', '--articles', String(articles));
  } else if (modeRaw === 'flash') {
    args.push('--flash-only', '--flash', String(flash));
  } else {
    args.push('--articles', String(articles), '--flash', String(flash));
  }

  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });
  const child = spawn('python', args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  child.unref();

  if (child.pid) {
    fs.writeFileSync(PID_FILE, String(child.pid));
  }

  child.on('exit', () => {
    try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
    logStream.end();
  });

  return NextResponse.json({ success: true, pid: child.pid, message: 'Pipeline started' });
}
