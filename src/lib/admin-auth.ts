import { NextRequest, NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || 'yayanews-admin-default-token-change-me';

export function requireAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('admin_token')?.value;
  const queryToken = req.nextUrl.searchParams.get('token');

  const token = authHeader?.replace('Bearer ', '') || cookieToken || queryToken;

  if (!token || token !== ADMIN_TOKEN) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid admin token required' },
      { status: 401 }
    );
  }

  return null;
}
