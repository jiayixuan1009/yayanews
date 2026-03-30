import { NextRequest, NextResponse } from 'next/server';
import { deleteFlash } from '@/lib/admin-queries';
import { requireAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const ok = await deleteFlash(Number(params.id));
    return NextResponse.json({ success: ok });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
