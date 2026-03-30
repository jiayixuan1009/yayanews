'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Article } from '@yayanews/types';
import { DERIVATIVES_SUBCATEGORIES } from '@yayanews/types';
import ArticleCard from './ArticleCard';

interface Props {
  initialArticles: Article[];
}

export default function DerivativesSubTabs({ initialArticles }: Props) {
  const [activeSub, setActiveSub] = useState('');
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchArticles = useCallback(async (sub: string) => {
    setLoading(true);
    setError('');
    try {
      const url = sub
        ? `/api/articles?category=derivatives&subcategory=${sub}&limit=30`
        : `/api/articles?category=derivatives&limit=30`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArticles(data.articles ?? data);
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSub === '') {
      setArticles(initialArticles);
    } else {
      fetchArticles(activeSub);
    }
  }, [activeSub, fetchArticles, initialArticles]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#ddd5ca] pb-4">
        <button
          onClick={() => setActiveSub('')}
          className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
            activeSub === ''
              ? 'border-[#14261f] bg-white text-[#14261f]'
              : 'border-[#ddd5ca] bg-[#f7f4ee] text-[#667067] hover:text-[#14261f]'
          }`}
        >
          All desks
        </button>
        {DERIVATIVES_SUBCATEGORIES.map(sub => (
          <button
            key={sub.slug}
            onClick={() => setActiveSub(sub.slug)}
            className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
              activeSub === sub.slug
                ? 'border-[#14261f] bg-white text-[#14261f]'
                : 'border-[#ddd5ca] bg-[#f7f4ee] text-[#667067] hover:text-[#14261f]'
            }`}
          >
            {sub.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#667067]" role="status" aria-label="加载中">
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          加载中...
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => fetchArticles(activeSub)} className="mt-2 text-xs uppercase tracking-[0.14em] text-[#1d5c4f] hover:underline">重试</button>
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-4">
          {articles.map(a => <ArticleCard key={a.id} article={a} />)}
        </div>
      ) : (
        <p className="py-16 text-center text-[#667067]">该子分类暂无资讯</p>
      )}
    </>
  );
}
