import { NextRequest, NextResponse } from 'next/server';
import {
  executeLoopActions,
  getLoopDashboard,
  updateLoopActionStatus,
  updateLoopOpportunityStatus,
} from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const limit = Number(req.nextUrl.searchParams.get('limit') || '30');
  try {
    return NextResponse.json(await getLoopDashboard(limit));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const action = req.nextUrl.searchParams.get('action');
  try {
    if (action === 'execute') {
      const limit = Number(req.nextUrl.searchParams.get('limit') || '20');
      return NextResponse.json(await executeLoopActions(limit));
    }

    const id = Number(req.nextUrl.searchParams.get('id') || '0');
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    if (action === 'dismiss-action') {
      return NextResponse.json(await updateLoopActionStatus(id, 'dismissed'));
    }
    if (action === 'reopen-action') {
      return NextResponse.json(await updateLoopActionStatus(id, 'proposed'));
    }
    if (action === 'dismiss-opportunity') {
      return NextResponse.json(await updateLoopOpportunityStatus(id, 'dismissed'));
    }
    if (action === 'reopen-opportunity') {
      return NextResponse.json(await updateLoopOpportunityStatus(id, 'open'));
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
