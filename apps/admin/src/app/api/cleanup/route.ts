import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredArticles, deleteExpiredFlash } from '@/lib/admin-cleanup';
import { requireAuth } from '@/lib/admin-auth';
import { log as baseLog } from '@/lib/logger';

const log = baseLog.child({ route: '/api/cleanup' });

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { target, days } = body;

    if (!target || (target !== 'articles' && target !== 'flash')) {
      return NextResponse.json({ error: '无效的清理目标' }, { status: 400 });
    }

    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 0) {
      return NextResponse.json({ error: '无效的时间范围' }, { status: 400 });
    }

    let deletedCount = 0;
    if (target === 'articles') {
      deletedCount = await deleteExpiredArticles(daysNum);
    } else {
      deletedCount = await deleteExpiredFlash(daysNum);
    }

    return NextResponse.json({
      success: true,
      message: `数据清理完成。物理删除了 ${deletedCount} 条过期 ${target === 'articles' ? '文章' : '快讯'}记录。`,
      deletedCount,
    });
  } catch (err: any) {
    log.error({ err }, 'cleanup failed');
    return NextResponse.json({ error: '数据清理执行异常: ' + err.message }, { status: 500 });
  }
}
