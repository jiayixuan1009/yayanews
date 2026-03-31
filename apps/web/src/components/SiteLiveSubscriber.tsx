'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
