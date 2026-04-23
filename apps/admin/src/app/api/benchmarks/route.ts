import { NextRequest, NextResponse } from 'next/server';
import { getBenchmarks } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);
    const data = await getBenchmarks(limit, offset);
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[benchmarks][GET]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const projectRoot = path.resolve(process.cwd());
  const pythonBin = process.env.PYTHON_BIN || 'python3';
  // Hardcoded args; never derive from request to keep this RCE-safe.
  const args = ['-m', 'pipeline.tools.speed_benchmark', '--limit', '10', '--hours', '24'];

  return new Promise<NextResponse>((resolve) => {
    const child = spawn(pythonBin, args, {
      cwd: projectRoot,
      timeout: 120_000,
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      console.error('[benchmarks][POST] spawn error:', err, 'stderr:', stderr);
      resolve(NextResponse.json({ ok: false, error: 'Failed to start benchmark' }, { status: 500 }));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`[benchmarks][POST] exit ${code}`, 'stderr:', stderr);
        resolve(NextResponse.json({ ok: false, error: 'Benchmark failed', exitCode: code }, { status: 500 }));
        return;
      }
      resolve(NextResponse.json({ ok: true, output: stdout }));
    });
  });
}
