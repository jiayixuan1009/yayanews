import { NextResponse } from 'next/server';
import { prisma } from '@yayanews/db';

export async function GET(request: Request) {
  try {
    const rawUrl = new URL(request.url);
    const auth = request.headers.get('x-admin-secret');
    if (auth !== 'yayanews2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const unassigned = await prisma.article.findMany({
      where: { topicId: null, tickers: { not: null, not: "" } },
      select: { tickers: true }
    });

    const counts: Record<string, number> = {};
    unassigned.forEach(a => {
      const t = a.tickers?.replace(/["\[\]]/g, '').split(',') || [];
      t.forEach(tag => {
        const key = tag.trim().toUpperCase();
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 50);
    return NextResponse.json({ count: unassigned.length, topTickers: sorted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
