import type { NextRequest } from 'next/server';
import { getFlashMaxId, getPublishedArticleMaxId } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_MS = 2000;
const MAX_CONNECTION_MS = 10 * 60 * 1000;

/**
 * 首页用 SSE：快讯或已发布文章任一有新 id 即推送，客户端 router.refresh()。
 */
export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang') || 'zh';
  let flashSince = Math.max(0, parseInt(req.nextUrl.searchParams.get('flashSince') || '0', 10) || 0);
  let articleSince = Math.max(0, parseInt(req.nextUrl.searchParams.get('articleSince') || '0', 10) || 0);

  const encoder = new TextEncoder();
  const t0 = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      const tick = async () => {
        if (Date.now() - t0 > MAX_CONNECTION_MS) {
          clearInterval(iv);
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'end', reason: 'reconnect' })}\n\n`)
            );
          } catch {
            /* */
          }
          try {
            controller.close();
          } catch {
            /* */
          }
          return;
        }
        try {
          const fmax = await getFlashMaxId(lang);
          const amax = await getPublishedArticleMaxId(lang);
          const flashNew = fmax > flashSince;
          const articleNew = amax > articleSince;
          if (flashNew) flashSince = fmax;
          if (articleNew) articleSince = amax;
          if (flashNew || articleNew) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'update',
                  flash: flashNew,
                  articles: articleNew,
                  flashMaxId: fmax,
                  articleMaxId: amax,
                })}\n\n`
              )
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
