import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('db1162aa32014bba89ab29ba04a5ddba', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
