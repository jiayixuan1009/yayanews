import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbModule = require('@yayanews/database');
    const resolvedPath = require.resolve('@yayanews/database');
    return NextResponse.json({
      success: true,
      keys: Object.keys(dbModule),
      resolvedPath,
      qGet: typeof dbModule.queryGet,
      qAll: typeof dbModule.queryAll
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.toString(),
      stack: err.stack
    });
  }
}
