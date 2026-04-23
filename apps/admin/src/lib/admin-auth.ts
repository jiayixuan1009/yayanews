import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { log } from './logger';

function getConfiguredAdminToken(): string | null {
  const token = process.env.ADMIN_API_TOKEN?.trim();
  return token ? token : null;
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export function requireAuth(req: NextRequest): NextResponse | null {
  const configuredToken = getConfiguredAdminToken();
  if (!configuredToken) {
    log.error('ADMIN_API_TOKEN is not configured for admin API access');
    return NextResponse.json(
      { error: 'Server misconfigured', message: 'Admin auth token is not configured' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('admin_token')?.value;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  const token = bearerToken || cookieToken;

  if (!token || !tokensMatch(token, configuredToken)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid admin token required' },
      { status: 401 }
    );
  }

  return null;
}
