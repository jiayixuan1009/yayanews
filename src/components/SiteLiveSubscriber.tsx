'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  flashMaxId: number;
  articleMaxId: number;
};

/**
 * 首页挂载：服务端有新快讯或新文章时触发整页 RSC 刷新。
 */
export default function SiteLiveSubscriber({ flashMaxId, articleMaxId }: Props) {
  const router = useRouter();
  const flashRef = useRef(flashMaxId);
  const articleRef = useRef(articleMaxId);
  flashRef.current = flashMaxId;
  articleRef.current = articleMaxId;

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    const connect = () => {
      if (cancelled) return;
      const qs = new URLSearchParams({
        flashSince: String(flashRef.current),
        articleSince: String(articleRef.current),
      });
      es = new EventSource(`/api/live/events?${qs}`);
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data) as {
            type?: string;
            flash?: boolean;
            articles?: boolean;
            flashMaxId?: number;
            articleMaxId?: number;
          };
          if (d.type === 'update' && (d.flash || d.articles)) {
            if (typeof d.flashMaxId === 'number') flashRef.current = d.flashMaxId;
            if (typeof d.articleMaxId === 'number') articleRef.current = d.articleMaxId;
            router.refresh();
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        if (!cancelled) setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [router]);

  return null;
}
