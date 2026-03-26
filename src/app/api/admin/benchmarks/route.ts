import { NextRequest, NextResponse } from 'next/server';
import { getBenchmarks } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);
    const data = getBenchmarks(limit, offset);
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const projectRoot = path.resolve(process.cwd());
  const cmd = `python -m pipeline.tools.speed_benchmark --limit 10 --hours 24`;

  return new Promise<NextResponse>((resolve) => {
    exec(cmd, { cwd: projectRoot, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(NextResponse.json({
          ok: false,
          error: err.message,
          stdout,
          stderr,
        }, { status: 500 }));
        return;
      }
      resolve(NextResponse.json({ ok: true, output: stdout }));
    });
  });
}
