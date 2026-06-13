'use client';

import { useEffect } from 'react';

interface ArticleViewBeaconProps {
  articleId: number;
}

export default function ArticleViewBeacon({ articleId }: ArticleViewBeaconProps) {
  useEffect(() => {
    if (!Number.isInteger(articleId) || articleId <= 0) return;

    const storageKey = `yayanews:article-view:${articleId}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Session storage can be disabled; still record the view best-effort.
    }

    const endpoint = `/api/articles/${articleId}/view`;
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob())) {
      return;
    }

    void fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      cache: 'no-store',
    });
  }, [articleId]);

  return null;
}
