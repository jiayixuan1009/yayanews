import type { NextRequest } from 'next/server';
import { getFlashMaxId } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_MS = 1500;
const MAX_CONNECTION_MS = 10 * 60 * 1000;

/**
 * SSE：当快讯表出现比 since 更大的 id 时推送，客户端再拉 /api/flash。
 * ?cat= 与列表筛选一致（仅该分类有新 id 时才推）。
 */
export async function GET(req: NextRequest) {
  const since = Math.max(0, parseInt(req.nextUrl.searchParams.get('since') || '0', 10) || 0);
  const cat = req.nextUrl.searchParams.get('cat') || undefined;
  const lang = req.nextUrl.searchParams.get('lang') || 'zh';

  const encoder = new TextEncoder();
  let last = since;
  const t0 = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const stop = () => {
        if (stopped) return;
        stopped = true;
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const safeEnqueue = (chunk: string) => {
        if (stopped) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 客户端已断开：停止后续轮询，避免未处理的 rejection。
          stop();
        }
      };

      // 递归 setTimeout：上一次查询 await 完成后才排下一次，避免重入与竞态。
      const tick = async () => {
        if (stopped) return;
        try {
          if (Date.now() - t0 > MAX_CONNECTION_MS) {
            safeEnqueue(`data: ${JSON.stringify({ type: 'end', reason: 'reconnect' })}\n\n`);
            stop();
            return;
          }
          const m = await getFlashMaxId(lang, cat);
          if (m > last) {
            last = m;
            safeEnqueue(`data: ${JSON.stringify({ type: 'flash', maxId: m })}\n\n`);
          }
          safeEnqueue(': ping\n\n');
        } catch (e) {
          safeEnqueue(`data: ${JSON.stringify({ type: 'error', message: String(e) })}\n\n`);
        } finally {
          if (!stopped) timer = setTimeout(tick, POLL_MS);
        }
      };

      timer = setTimeout(tick, 0);
      req.signal.addEventListener('abort', stop);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
