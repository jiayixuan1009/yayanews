import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Diagnostic endpoint for module resolution.
 * Returns 404 in production unless ENABLE_DEBUG_ENDPOINTS=true is explicitly set.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  try {
    const dbModule = require('@yayanews/database');
    const resolvedPath = require.resolve('@yayanews/database');
    return NextResponse.json({
      success: true,
      keys: Object.keys(dbModule),
      resolvedPath,
      qGet: typeof dbModule.queryGet,
      qAll: typeof dbModule.queryAll,
    });
  } catch (err: unknown) {
    log.error({ err, route: '/api/debug' }, 'module resolution failed');
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
