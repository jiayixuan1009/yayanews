'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function SiteLiveSubscriber() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
              toast('📰 最新深度文章', {
                description: data.payload.title,
                duration: 6000,
                action: data.payload.slug ? {
                  label: '立即阅读',
                  onClick: () => window.open(`/article/${data.payload.slug}`, '_blank'),
                } : undefined,
              });
            }
          } else if (data.channel && data.channel.startsWith('flash:new')) {
            router.refresh();
            if (data.payload?.title || data.payload?.content) {
              toast('⚡ 突发快讯', {
                description: data.payload.title || data.payload.content,
                duration: 5000,
              });
            }
          }
        } catch (e) {}
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
  }, [router]);

  return null;
}
