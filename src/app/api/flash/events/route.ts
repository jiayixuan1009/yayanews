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
      const tick = () => {
        if (Date.now() - t0 > MAX_CONNECTION_MS) {
          clearInterval(iv);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end', reason: 'reconnect' })}\n\n`));
          } catch {
            /* closed */
          }
          try {
            controller.close();
          } catch {
            /* */
          }
          return;
        }
        try {
          const m = getFlashMaxId(lang, cat);
          if (m > last) {
            last = m;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'flash', maxId: m })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(e) })}\n\n`)
          );
        }
      };
      const iv = setInterval(tick, POLL_MS);
      tick();
      req.signal.addEventListener('abort', () => {
        clearInterval(iv);
        try {
          controller.close();
        } catch {
          /* */
        }
      });
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
