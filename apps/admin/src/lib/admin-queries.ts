import { queryAll, queryGet, queryRun } from '@yayanews/database';
import type { Article, FlashNews, Category } from '@yayanews/types';

/* ── Dashboard 统计 ── */

export interface ProcessingStats {
  avgArticleSeconds: number | null;
  avgFlashSeconds: number | null;
  maxArticleSeconds: number | null;
  maxFlashSeconds: number | null;
  todayAvgArticleSeconds: number | null;
  todayAvgFlashSeconds: number | null;
}

export interface DashboardStats {
  totalArticles: number;
  totalFlash: number;
  totalViews: number;
  todayArticles: number;
  todayFlash: number;
  categoryStats: { slug: string; name: string; articles: number; flash: number }[];
  recentArticles: Article[];
  dailyTrend: { date: string; articles: number; flash: number }[];
  processingStats: ProcessingStats;
}

export async function getDashboardStats(lang?: string, startDate?: string, endDate?: string): Promise<DashboardStats> {
  const condsA: string[] = [];
  const condsF: string[] = [];
  
  if (lang && lang !== 'all') {
    condsA.push(`lang = '${lang}'`);
    condsF.push(`lang = '${lang}'`);
  }
  
  const isD = (s?: string) => s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const sd = isD(startDate) ? startDate : null;
  const ed = isD(endDate) ? endDate : null;
  
  if (sd) {
    condsA.push(`date(created_at) >= '${sd}'::date`);
    condsF.push(`date(published_at) >= '${sd}'::date`);
  }
  if (ed) {
    condsA.push(`date(created_at) <= '${ed}'::date`);
    condsF.push(`date(published_at) <= '${ed}'::date`);
  }

  const whereA = condsA.length > 0 ? `WHERE ${condsA.join(' AND ')}` : '';
  const whereF = condsF.length > 0 ? `WHERE ${condsF.join(' AND ')}` : '';
  const andA = condsA.length > 0 ? `AND ${condsA.join(' AND ')}` : '';
  const andF = condsF.length > 0 ? `AND ${condsF.join(' AND ')}` : '';
  
  const catCondsA = condsA.map(c => typeof c === 'string' ? c.replace(/lang\ =/g, 'a.lang =').replace(/date\(created_at\)/g, 'date(a.created_at)') : '');
  const catCondsF = condsF.map(c => typeof c === 'string' ? c.replace(/lang\ =/g, 'f.lang =').replace(/date\(published_at\)/g, 'date(f.published_at)') : '');
  const andCatA = catCondsA.length > 0 ? `AND ${catCondsA.join(' AND ')}` : '';
  const andCatF = catCondsF.length > 0 ? `AND ${catCondsF.join(' AND ')}` : '';

  const [{ c: totalArticles }] = await queryAll<{ c: number }>(`SELECT COUNT(*)::int as c FROM articles ${whereA}`);
  const [{ c: totalFlash }] = await queryAll<{ c: number }>(`SELECT COUNT(*)::int as c FROM flash_news ${whereF}`);
  const [{ c: totalViews }] = await queryAll<{ c: number }>(`SELECT COALESCE(SUM(view_count),0)::int as c FROM articles ${whereA}`);

  const [{ c: todayArticles }] = await queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM articles WHERE date(created_at) = CURRENT_DATE ${lang && lang !== 'all' ? `AND lang = '${lang}'` : ''}`
  );

  const [{ c: todayFlash }] = await queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM flash_news WHERE date(published_at) = CURRENT_DATE ${lang && lang !== 'all' ? `AND lang = '${lang}'` : ''}`
  );

  const categoryStats = await queryAll<DashboardStats['categoryStats'][0]>(`
    SELECT c.slug, c.name,
      (SELECT COUNT(*)::int FROM articles a WHERE a.category_id=c.id ${andCatA}) as articles,
      (SELECT COUNT(*)::int FROM flash_news f WHERE f.category_id=c.id ${andCatF}) as flash
    FROM categories c ORDER BY c.sort_order
  `);

  const recentArticles = await queryAll<Article & { category_name: string; category_slug: string }>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    ${whereA}
    ORDER BY a.created_at DESC LIMIT 10
  `);

  const trendStart = sd ? `'${sd}'::date` : `CURRENT_DATE - INTERVAL '6 days'`;
  const trendEnd = ed ? `'${ed}'::date` : `CURRENT_DATE`;

  const dailyTrend = await queryAll<DashboardStats['dailyTrend'][0]>(`
    SELECT d.date::text,
      COALESCE(ac.cnt, 0)::int as articles,
      COALESCE(fc.cnt, 0)::int as flash
    FROM (
      SELECT generate_series(${trendStart}, ${trendEnd}, '1 day')::date AS date
    ) d
    LEFT JOIN (SELECT date(created_at) as dt, COUNT(*)::int as cnt FROM articles ${whereA} GROUP BY dt) ac ON ac.dt=d.date
    LEFT JOIN (SELECT date(published_at) as dt, COUNT(*)::int as cnt FROM flash_news ${whereF} GROUP BY dt) fc ON fc.dt=d.date
    ORDER BY d.date
  `);

  const processingStats = await queryGet<ProcessingStats>(`
    SELECT
      (SELECT AVG(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL ${andA}) as "avgArticleSeconds",
      (SELECT AVG(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL ${andF}) as "avgFlashSeconds",
      (SELECT MAX(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL ${andA}) as "maxArticleSeconds",
      (SELECT MAX(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL ${andF}) as "maxFlashSeconds",
      (SELECT AVG(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(created_at)=CURRENT_DATE ${andA}) as "todayAvgArticleSeconds",
      (SELECT AVG(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(created_at)=CURRENT_DATE ${andF}) as "todayAvgFlashSeconds"
  `);

  return { totalArticles, totalFlash, totalViews, todayArticles, todayFlash, categoryStats, recentArticles, dailyTrend, processingStats: processingStats! };
}

/* ── 文章管理（含所有状态） ── */

export interface AdminArticleListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  subcategory?: string;
  status?: string;
  search?: string;
  lang?: string;
}

export interface AdminArticleListResult {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAdminArticles(params: AdminArticleListParams = {}): Promise<AdminArticleListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const binds: unknown[] = [];
  let paramIdx = 1;

  if (params.category) {
    where += ` AND c.slug = $${paramIdx++}`;
    binds.push(params.category);
  }
  if (params.subcategory) {
    where += ` AND a.subcategory = $${paramIdx++}`;
    binds.push(params.subcategory);
  }
  if (params.status) {
    where += ` AND a.status = $${paramIdx++}`;
    binds.push(params.status);
  }
  if (params.search) {
    where += ` AND (a.title ILIKE $${paramIdx} OR a.summary ILIKE $${paramIdx})`;
    binds.push(`%${params.search}%`);
    paramIdx++;
  }
  if (params.lang && params.lang !== 'all') {
    where += ` AND a.lang = $${paramIdx++}`;
    binds.push(params.lang);
  }

  const [{ c: total }] = await queryAll<{ c: number }>(`
    SELECT COUNT(*)::int as c FROM articles a LEFT JOIN categories c ON a.category_id=c.id WHERE ${where}
  `, binds);

  const articles = await queryAll<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
      CASE WHEN a.collected_at IS NOT NULL AND a.published_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.published_at - a.collected_at))::int
        ELSE NULL END as processing_seconds
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    WHERE ${where}
    ORDER BY a.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `, [...binds, pageSize, offset]);

  return { articles, total, page, pageSize };
}

export async function getAdminArticleById(id: number): Promise<Article | undefined> {
  const article = await queryGet<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
      CASE WHEN a.collected_at IS NOT NULL AND a.published_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.published_at - a.collected_at))::int
        ELSE NULL END as processing_seconds
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id WHERE a.id=$1
  `, [id]);
  
  if (article) {
    const tags = await queryAll<{ id: number; name: string; slug: string }>(`
      SELECT t.* FROM tags t JOIN article_tags at ON t.id=at.tag_id WHERE at.article_id=$1
    `, [article.id]);
    article.tags = tags;
  }
  return article;
}

/* ── 快讯管理 ── */

export interface AdminFlashListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  lang?: string;
}

export interface AdminFlashListResult {
  items: FlashNews[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAdminFlash(params: AdminFlashListParams = {}): Promise<AdminFlashListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 30;
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const binds: unknown[] = [];
  let paramIdx = 1;

  if (params.category) {
    where += ` AND c.slug = $${paramIdx++}`;
    binds.push(params.category);
  }
  if (params.subcategory) {
    where += ` AND f.subcategory = $${paramIdx++}`;
    binds.push(params.subcategory);
  }
  if (params.search) {
    where += ` AND (f.title ILIKE $${paramIdx} OR f.content ILIKE $${paramIdx})`;
    binds.push(`%${params.search}%`);
    paramIdx++;
  }
  if (params.lang && params.lang !== 'all') {
    where += ` AND f.lang = $${paramIdx++}`;
    binds.push(params.lang);
  }

  const [{ c: total }] = await queryAll<{ c: number }>(`
    SELECT COUNT(*)::int as c FROM flash_news f LEFT JOIN categories c ON f.category_id=c.id WHERE ${where}
  `, binds);

  const items = await queryAll<FlashNews>(`
    SELECT f.*, c.name as category_name,
      CASE WHEN f.collected_at IS NOT NULL AND f.published_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (f.published_at - f.collected_at))::int
        ELSE NULL END as processing_seconds
    FROM flash_news f LEFT JOIN categories c ON f.category_id=c.id
    WHERE ${where}
    ORDER BY f.published_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `, [...binds, pageSize, offset]);

  return { items, total, page, pageSize };
}

/* ── 速度监控统计 ── */

export interface PipelineRun {
  id: number;
  run_type: string;
  started_at: string;
  finished_at: string;
  total_seconds: number;
  items_requested: number;
  items_produced: number;
  stage_timings: string;
  channel_timings: string;
  error_count: number;
  notes: string;
}

export interface SpeedDistributionBucket {
  range: string;
  article_count: number;
  flash_count: number;
}

export interface SpeedTrendPoint {
  date: string;
  avg_article: number | null;
  avg_flash: number | null;
  p95_article: number | null;
  p95_flash: number | null;
  count_article: number;
  count_flash: number;
}

export interface ChannelSpeedStat {
  channel: string;
  avg_seconds: number;
  min_seconds: number;
  max_seconds: number;
  run_count: number;
}

export interface SpeedStats {
  overview: {
    avgArticle: number | null;
    avgFlash: number | null;
    p50Article: number | null;
    p50Flash: number | null;
    p95Article: number | null;
    p95Flash: number | null;
    fastestArticle: number | null;
    fastestFlash: number | null;
    slowestArticle: number | null;
    slowestFlash: number | null;
    totalRuns: number;
    todayRuns: number;
    todayAvgArticle: number | null;
    todayAvgFlash: number | null;
    yesterdayAvgArticle: number | null;
    yesterdayAvgFlash: number | null;
    perItemArticle: number | null;
    perItemFlash: number | null;
  };
  distribution: SpeedDistributionBucket[];
  trend: SpeedTrendPoint[];
  recentRuns: PipelineRun[];
  articleProcessing: {
    avg: number | null;
    p50: number | null;
    p95: number | null;
    fastest: number | null;
    slowest: number | null;
    count: number;
  };
  flashProcessing: {
    avg: number | null;
    p50: number | null;
    p95: number | null;
    fastest: number | null;
    slowest: number | null;
    count: number;
  };
}

function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function getSpeedStats(): Promise<SpeedStats> {
  const allArticleRuns = await queryAll<{ total_seconds: number }>(
    "SELECT total_seconds::int FROM pipeline_runs WHERE run_type='article' AND started_at >= NOW() - INTERVAL '24 hours' ORDER BY total_seconds"
  );
  const allFlashRuns = await queryAll<{ total_seconds: number }>(
    "SELECT total_seconds::int FROM pipeline_runs WHERE run_type='flash' AND started_at >= NOW() - INTERVAL '24 hours' ORDER BY total_seconds"
  );

  const artTimes = allArticleRuns.map(r => r.total_seconds);
  const flashTimes = allFlashRuns.map(r => r.total_seconds);

  const [{ c: totalRuns }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM pipeline_runs WHERE started_at >= NOW() - INTERVAL '24 hours'");
  const [{ c: todayRuns }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM pipeline_runs WHERE date(started_at)=CURRENT_DATE");

  const [{ v: todayAvgArticle }] = await queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='article' AND date(started_at)=CURRENT_DATE"
  );
  const [{ v: todayAvgFlash }] = await queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='flash' AND date(started_at)=CURRENT_DATE"
  );

  const [{ v: yesterdayAvgArticle }] = await queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='article' AND date(started_at)=CURRENT_DATE - INTERVAL '1 day'"
  );
  const [{ v: yesterdayAvgFlash }] = await queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='flash' AND date(started_at)=CURRENT_DATE - INTERVAL '1 day'"
  );

  const [{ v: perItemArticle }] = await queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds * 1.0 / NULLIF(items_produced,0)) as v FROM pipeline_runs WHERE run_type='article' AND started_at >= NOW() - INTERVAL '24 hours' AND items_produced>0"
  );
  const [{ v: perItemFlash }] = await queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds * 1.0 / NULLIF(items_produced,0)) as v FROM pipeline_runs WHERE run_type='flash' AND started_at >= NOW() - INTERVAL '24 hours' AND items_produced>0"
  );

  const artProcessingTimes = await queryAll<{ secs: number }>(
    `SELECT EXTRACT(EPOCH FROM (published_at - collected_at))::int as secs
     FROM articles WHERE collected_at IS NOT NULL AND published_at >= NOW() - INTERVAL '24 hours'
     ORDER BY secs`
  );
  const artProcArr = artProcessingTimes.map(r => r.secs).filter(s => s >= 0);

  const flashProcessingTimes = await queryAll<{ secs: number }>(
    `SELECT EXTRACT(EPOCH FROM (published_at - collected_at))::int as secs
     FROM flash_news WHERE collected_at IS NOT NULL AND published_at >= NOW() - INTERVAL '24 hours'
     ORDER BY secs`
  );
  const flashProcArr = flashProcessingTimes.map(r => r.secs).filter(s => s >= 0);

  const buckets = [
    { range: '<10s', min: 0, max: 10 },
    { range: '10-30s', min: 10, max: 30 },
    { range: '30-60s', min: 30, max: 60 },
    { range: '1-3m', min: 60, max: 180 },
    { range: '3-5m', min: 180, max: 300 },
    { range: '5-10m', min: 300, max: 600 },
    { range: '>10m', min: 600, max: Infinity },
  ];

  const distribution: SpeedDistributionBucket[] = buckets.map(b => ({
    range: b.range,
    article_count: artProcArr.filter(s => s >= b.min && s < b.max).length,
    flash_count: flashProcArr.filter(s => s >= b.min && s < b.max).length,
  }));

  const trend = await queryAll<SpeedTrendPoint>(`
    SELECT d.date::text,
      (SELECT AVG(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(published_at)=d.date) as avg_article,
      (SELECT AVG(EXTRACT(EPOCH FROM (published_at - collected_at)))::int
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(published_at)=d.date) as avg_flash,
      (SELECT COUNT(*)::int FROM articles WHERE date(published_at)=d.date) as count_article,
      (SELECT COUNT(*)::int FROM flash_news WHERE date(published_at)=d.date) as count_flash
    FROM (
      SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day')::date AS date
    ) d ORDER BY d.date
  `);

  const recentRuns = await queryAll<PipelineRun>(
    "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 50"
  );

  return {
    overview: {
      avgArticle: artTimes.length ? artTimes.reduce((a, b) => a + b, 0) / artTimes.length : null,
      avgFlash: flashTimes.length ? flashTimes.reduce((a, b) => a + b, 0) / flashTimes.length : null,
      p50Article: percentile(artTimes, 50),
      p50Flash: percentile(flashTimes, 50),
      p95Article: percentile(artTimes, 95),
      p95Flash: percentile(flashTimes, 95),
      fastestArticle: artTimes.length ? artTimes[0] : null,
      fastestFlash: flashTimes.length ? flashTimes[0] : null,
      slowestArticle: artTimes.length ? artTimes[artTimes.length - 1] : null,
      slowestFlash: flashTimes.length ? flashTimes[flashTimes.length - 1] : null,
      totalRuns,
      todayRuns,
      todayAvgArticle,
      todayAvgFlash,
      yesterdayAvgArticle,
      yesterdayAvgFlash,
      perItemArticle: perItemArticle != null ? Math.round(perItemArticle * 10) / 10 : null,
      perItemFlash: perItemFlash != null ? Math.round(perItemFlash * 10) / 10 : null,
    },
    distribution,
    trend,
    recentRuns,
    articleProcessing: {
      avg: artProcArr.length ? Math.round(artProcArr.reduce((a, b) => a + b, 0) / artProcArr.length) : null,
      p50: percentile(artProcArr, 50),
      p95: percentile(artProcArr, 95),
      fastest: artProcArr.length ? artProcArr[0] : null,
      slowest: artProcArr.length ? artProcArr[artProcArr.length - 1] : null,
      count: artProcArr.length,
    },
    flashProcessing: {
      avg: flashProcArr.length ? Math.round(flashProcArr.reduce((a, b) => a + b, 0) / flashProcArr.length) : null,
      p50: percentile(flashProcArr, 50),
      p95: percentile(flashProcArr, 95),
      fastest: flashProcArr.length ? flashProcArr[0] : null,
      slowest: flashProcArr.length ? flashProcArr[flashProcArr.length - 1] : null,
      count: flashProcArr.length,
    },
  };
}

export async function deleteArticle(id: number): Promise<boolean> {
  await queryRun('DELETE FROM article_tags WHERE article_id=$1', [id]);
  const changes = await queryRun('DELETE FROM articles WHERE id=$1', [id]);
  return changes > 0;
}

export async function deleteFlash(id: number): Promise<boolean> {
  const changes = await queryRun('DELETE FROM flash_news WHERE id=$1', [id]);
  return changes > 0;
}

/* ── 时效对比（Speed Benchmarks） ── */

export interface BenchmarkRecord {
  id: number;
  article_id: number;
  article_title: string;
  our_published_at: string;
  competitor_title: string | null;
  competitor_source: string | null;
  competitor_url: string | null;
  competitor_published_at: string | null;
  diff_seconds: number | null;
  search_query: string;
  result_count: number;
  status: string;
  error_message: string;
  created_at: string;
}

export interface BenchmarkSummary {
  total: number;
  done: number;
  faster: number;
  slower: number;
  noResult: number;
  avgDiffSeconds: number | null;
  medianDiffSeconds: number | null;
  records: BenchmarkRecord[];
}

export interface PipelineQueueItem {
  id: number;
  title: string;
  status?: string;
  slug?: string;
  updated_at?: string;
  published_at?: string | null;
}

export interface PipelineSourceActivity {
  source: string;
  last_seen: string;
  count_24h: number;
}

export async function getPipelineQueues(): Promise<{ 
  pending: PipelineQueueItem[]; 
  published: PipelineQueueItem[];
  sources: PipelineSourceActivity[];
}> {
  const pending = await queryAll<PipelineQueueItem>(
    `SELECT id, title, status, updated_at FROM articles
     WHERE status IN ('draft','review') ORDER BY updated_at DESC LIMIT 40`
  );

  // 已投递 = 已发布文章列表
  const published = await queryAll<PipelineQueueItem>(
    `SELECT id, title, slug, published_at FROM articles
     WHERE status = 'published' ORDER BY published_at DESC LIMIT 40`
  );
  
  // Aggregate source activity from Flash News
  const sources = await queryAll<PipelineSourceActivity>(`
    SELECT 
      SPLIT_PART(source, '/', 1) as source,
      MAX(published_at) as last_seen,
      COUNT(*)::int as count_24h
    FROM flash_news 
    WHERE published_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      AND source IS NOT NULL AND source != ''
    GROUP BY SPLIT_PART(source, '/', 1)
    ORDER BY last_seen DESC
  `);

  return { pending, published, sources };
}

export async function getBenchmarks(limit = 50, offset = 0): Promise<BenchmarkSummary> {
  const [{ c: total }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks");
  const [{ c: done }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='done'");
  const [{ c: faster }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='done' AND diff_seconds < 0");
  const [{ c: slower }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='done' AND diff_seconds >= 0");
  const [{ c: noResult }] = await queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='no_result'");

  const avgRow = await queryGet<{ avg: number | null }>("SELECT AVG(diff_seconds) as avg FROM speed_benchmarks WHERE status='done' AND diff_seconds IS NOT NULL");

  const diffs = await queryAll<{ diff_seconds: number }>("SELECT diff_seconds FROM speed_benchmarks WHERE status='done' AND diff_seconds IS NOT NULL ORDER BY diff_seconds");
  let medianDiffSeconds: number | null = null;
  if (diffs.length > 0) {
    const mid = Math.floor(diffs.length / 2);
    medianDiffSeconds = diffs.length % 2 === 0
      ? (diffs[mid - 1].diff_seconds + diffs[mid].diff_seconds) / 2
      : diffs[mid].diff_seconds;
  }

  const records = await queryAll<BenchmarkRecord>(`
    SELECT * FROM speed_benchmarks
    ORDER BY created_at DESC LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return {
    total,
    done,
    faster,
    slower,
    noResult,
    avgDiffSeconds: avgRow?.avg !== null && avgRow?.avg !== undefined ? Math.round(avgRow.avg) : null,
    medianDiffSeconds: medianDiffSeconds !== null ? Math.round(medianDiffSeconds) : null,
    records,
  };
}
