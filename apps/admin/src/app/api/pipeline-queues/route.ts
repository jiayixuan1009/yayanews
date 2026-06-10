import { NextRequest, NextResponse } from 'next/server';
import { archiveStalePipelineDrafts, getPipelineQueues } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await getPipelineQueues());
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const action = req.nextUrl.searchParams.get('action');
  if (action !== 'archive-stale') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const hours = Number(req.nextUrl.searchParams.get('hours') || '2');
    return NextResponse.json(await archiveStalePipelineDrafts(hours));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
