'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

const i18n = {
  zh: { newArticle: '📰 最新深度文章', readNow: '立即阅读', flash: '⚡ 突发快讯' },
  en: { newArticle: '📰 New In-Depth Article', readNow: 'Read now', flash: '⚡ Breaking Flash' },
};

export default function SiteLiveSubscriber() {
  const router = useRouter();
  const pathname = usePathname();
  const isEn = pathname?.startsWith('/en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = isEn ? i18n.en : i18n.zh;
    let ws: WebSocket;
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/`);
      ws.onerror = () => { /* silently ignore — WS not available in all deploy envs */ };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel && data.channel.startsWith('article:new')) {
            router.refresh();
            if (data.payload?.title) {
              toast(t.newArticle, {
                description: data.payload.title,
                duration: 6000,
                action: data.payload.slug ? {
                  label: t.readNow,
                  onClick: () => window.open(`/${isEn ? 'en' : 'zh'}/article/${data.payload.slug}`, '_blank'),
                } : undefined,
              });
            }
          } else if (data.channel && data.channel.startsWith('flash:new')) {
            router.refresh();
            
            // Check if the flash block is visible in viewport
            const flashBlock = document.getElementById('breaking-stream-block');
            if (flashBlock) {
              const rect = flashBlock.getBoundingClientRect();
              const isVisible = rect.top < window.innerHeight && rect.bottom >= 0;
              if (isVisible) {
                // If the user can see the 7x24 block, do not show popup
                return;
              }
            }

            if (data.payload?.title || data.payload?.content) {
              toast(t.flash, {
                description: data.payload.title || data.payload.content,
                duration: 5000,
              });
            }
          }
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.warn('[SiteLiveSubscriber] bad WS frame', e);
        }
      };
      ws.onclose = () => {
        if (!cancelled) setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [router, isEn]);

  return null;
}
