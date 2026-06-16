import { NextResponse } from 'next/server';

const body = 'google-site-verification: google557e7d124058718a.html';

export async function GET() {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
