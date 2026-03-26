import { getDb } from './db';
import type { Article, FlashNews, Category } from './types';

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

export function getDashboardStats(): DashboardStats {
  const db = getDb();

  const totalArticles = (db.prepare("SELECT COUNT(*) as c FROM articles").get() as { c: number }).c;
  const totalFlash = (db.prepare("SELECT COUNT(*) as c FROM flash_news").get() as { c: number }).c;
  const totalViews = (db.prepare("SELECT COALESCE(SUM(view_count),0) as c FROM articles").get() as { c: number }).c;

  const todayArticles = (db.prepare(
    "SELECT COUNT(*) as c FROM articles WHERE date(created_at)=date('now')"
  ).get() as { c: number }).c;

  const todayFlash = (db.prepare(
    "SELECT COUNT(*) as c FROM flash_news WHERE date(published_at)=date('now')"
  ).get() as { c: number }).c;

  const categoryStats = db.prepare(`
    SELECT c.slug, c.name,
      (SELECT COUNT(*) FROM articles a WHERE a.category_id=c.id) as articles,
      (SELECT COUNT(*) FROM flash_news f WHERE f.category_id=c.id) as flash
    FROM categories c ORDER BY c.sort_order
  `).all() as DashboardStats['categoryStats'];

  const recentArticles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    ORDER BY a.created_at DESC LIMIT 10
  `).all() as Article[];

  const dailyTrend = db.prepare(`
    SELECT d.date,
      COALESCE(ac.cnt, 0) as articles,
      COALESCE(fc.cnt, 0) as flash
    FROM (
      SELECT date('now', '-' || n || ' days') as date
      FROM (SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6)
    ) d
    LEFT JOIN (SELECT date(created_at) as dt, COUNT(*) as cnt FROM articles GROUP BY dt) ac ON ac.dt=d.date
    LEFT JOIN (SELECT date(published_at) as dt, COUNT(*) as cnt FROM flash_news GROUP BY dt) fc ON fc.dt=d.date
    ORDER BY d.date
  `).all() as DashboardStats['dailyTrend'];

  const processingStats = db.prepare(`
    SELECT
      (SELECT AVG(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL) as avgArticleSeconds,
      (SELECT AVG(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL) as avgFlashSeconds,
      (SELECT MAX(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL) as maxArticleSeconds,
      (SELECT MAX(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL) as maxFlashSeconds,
      (SELECT AVG(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(created_at)=date('now')) as todayAvgArticleSeconds,
      (SELECT AVG(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(created_at)=date('now')) as todayAvgFlashSeconds
  `).get() as ProcessingStats;

  return { totalArticles, totalFlash, totalViews, todayArticles, todayFlash, categoryStats, recentArticles, dailyTrend, processingStats };
}

/* ── 文章管理（含所有状态） ── */

export interface AdminArticleListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  subcategory?: string;
  status?: string;
  search?: string;
}

export interface AdminArticleListResult {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}

export function getAdminArticles(params: AdminArticleListParams = {}): AdminArticleListResult {
  const db = getDb();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const binds: unknown[] = [];

  if (params.category) {
    where += ' AND c.slug = ?';
    binds.push(params.category);
  }
  if (params.subcategory) {
    where += ' AND a.subcategory = ?';
    binds.push(params.subcategory);
  }
  if (params.status) {
    where += ' AND a.status = ?';
    binds.push(params.status);
  }
  if (params.search) {
    where += ' AND (a.title LIKE ? OR a.summary LIKE ?)';
    const q = `%${params.search}%`;
    binds.push(q, q);
  }

  const total = (db.prepare(`
    SELECT COUNT(*) as c FROM articles a LEFT JOIN categories c ON a.category_id=c.id WHERE ${where}
  `).get(...binds) as { c: number }).c;

  const articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
      CASE WHEN a.collected_at IS NOT NULL AND a.published_at IS NOT NULL
        THEN CAST((julianday(a.published_at) - julianday(a.collected_at)) * 86400 AS INTEGER)
        ELSE NULL END as processing_seconds
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    WHERE ${where}
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(...binds, pageSize, offset) as Article[];

  return { articles, total, page, pageSize };
}

export function getAdminArticleById(id: number): Article | undefined {
  const db = getDb();
  const article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
      CASE WHEN a.collected_at IS NOT NULL AND a.published_at IS NOT NULL
        THEN CAST((julianday(a.published_at) - julianday(a.collected_at)) * 86400 AS INTEGER)
        ELSE NULL END as processing_seconds
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id WHERE a.id=?
  `).get(id) as Article | undefined;
  if (article) {
    const tags = db.prepare(`
      SELECT t.* FROM tags t JOIN article_tags at ON t.id=at.tag_id WHERE at.article_id=?
    `).all(article.id) as { id: number; name: string; slug: string }[];
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
}

export interface AdminFlashListResult {
  items: FlashNews[];
  total: number;
  page: number;
  pageSize: number;
}

export function getAdminFlash(params: AdminFlashListParams = {}): AdminFlashListResult {
  const db = getDb();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 30;
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const binds: unknown[] = [];

  if (params.category) {
    where += ' AND c.slug = ?';
    binds.push(params.category);
  }
  if (params.subcategory) {
    where += ' AND f.subcategory = ?';
    binds.push(params.subcategory);
  }
  if (params.search) {
    where += ' AND (f.title LIKE ? OR f.content LIKE ?)';
    const q = `%${params.search}%`;
    binds.push(q, q);
  }

  const total = (db.prepare(`
    SELECT COUNT(*) as c FROM flash_news f LEFT JOIN categories c ON f.category_id=c.id WHERE ${where}
  `).get(...binds) as { c: number }).c;

  const items = db.prepare(`
    SELECT f.*, c.name as category_name,
      CASE WHEN f.collected_at IS NOT NULL AND f.published_at IS NOT NULL
        THEN CAST((julianday(f.published_at) - julianday(f.collected_at)) * 86400 AS INTEGER)
        ELSE NULL END as processing_seconds
    FROM flash_news f LEFT JOIN categories c ON f.category_id=c.id
    WHERE ${where}
    ORDER BY f.published_at DESC LIMIT ? OFFSET ?
  `).all(...binds, pageSize, offset) as FlashNews[];

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

export function getSpeedStats(): SpeedStats {
  const db = getDb();

  // ── Pipeline runs overview ──
  const allArticleRuns = db.prepare(
    "SELECT total_seconds FROM pipeline_runs WHERE run_type='article' ORDER BY total_seconds"
  ).all() as { total_seconds: number }[];
  const allFlashRuns = db.prepare(
    "SELECT total_seconds FROM pipeline_runs WHERE run_type='flash' ORDER BY total_seconds"
  ).all() as { total_seconds: number }[];

  const artTimes = allArticleRuns.map(r => r.total_seconds);
  const flashTimes = allFlashRuns.map(r => r.total_seconds);

  const totalRuns = (db.prepare("SELECT COUNT(*) as c FROM pipeline_runs").get() as { c: number }).c;
  const todayRuns = (db.prepare("SELECT COUNT(*) as c FROM pipeline_runs WHERE date(started_at)=date('now')").get() as { c: number }).c;

  const todayAvgArticle = (db.prepare(
    "SELECT AVG(total_seconds) as v FROM pipeline_runs WHERE run_type='article' AND date(started_at)=date('now')"
  ).get() as { v: number | null }).v;
  const todayAvgFlash = (db.prepare(
    "SELECT AVG(total_seconds) as v FROM pipeline_runs WHERE run_type='flash' AND date(started_at)=date('now')"
  ).get() as { v: number | null }).v;

  const yesterdayAvgArticle = (db.prepare(
    "SELECT AVG(total_seconds) as v FROM pipeline_runs WHERE run_type='article' AND date(started_at)=date('now','-1 day')"
  ).get() as { v: number | null }).v;
  const yesterdayAvgFlash = (db.prepare(
    "SELECT AVG(total_seconds) as v FROM pipeline_runs WHERE run_type='flash' AND date(started_at)=date('now','-1 day')"
  ).get() as { v: number | null }).v;

  const perItemArticle = (db.prepare(
    "SELECT AVG(total_seconds * 1.0 / NULLIF(items_produced,0)) as v FROM pipeline_runs WHERE run_type='article' AND items_produced>0"
  ).get() as { v: number | null }).v;
  const perItemFlash = (db.prepare(
    "SELECT AVG(total_seconds * 1.0 / NULLIF(items_produced,0)) as v FROM pipeline_runs WHERE run_type='flash' AND items_produced>0"
  ).get() as { v: number | null }).v;

  // ── Per-article processing time from collected_at -> published_at ──
  const artProcessingTimes = db.prepare(
    `SELECT CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER) as secs
     FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL
     ORDER BY secs`
  ).all() as { secs: number }[];
  const artProcArr = artProcessingTimes.map(r => r.secs).filter(s => s >= 0);

  const flashProcessingTimes = db.prepare(
    `SELECT CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER) as secs
     FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL
     ORDER BY secs`
  ).all() as { secs: number }[];
  const flashProcArr = flashProcessingTimes.map(r => r.secs).filter(s => s >= 0);

  // ── Distribution: processing seconds bucketed ──
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

  // ── 14-day trend ──
  const trend = db.prepare(`
    SELECT d.date,
      (SELECT AVG(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM articles WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(published_at)=d.date) as avg_article,
      (SELECT AVG(CAST((julianday(published_at) - julianday(collected_at)) * 86400 AS INTEGER))
       FROM flash_news WHERE collected_at IS NOT NULL AND published_at IS NOT NULL AND date(published_at)=d.date) as avg_flash,
      (SELECT COUNT(*) FROM articles WHERE date(published_at)=d.date) as count_article,
      (SELECT COUNT(*) FROM flash_news WHERE date(published_at)=d.date) as count_flash
    FROM (
      SELECT date('now', '-' || n || ' days') as date
      FROM (SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
            UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
            UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13)
    ) d ORDER BY d.date
  `).all() as SpeedTrendPoint[];

  // ── Recent pipeline runs ──
  const recentRuns = db.prepare(
    "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 50"
  ).all() as PipelineRun[];

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

export function deleteArticle(id: number): boolean {
  const db = getDb();
  db.prepare('DELETE FROM article_tags WHERE article_id=?').run(id);
  const result = db.prepare('DELETE FROM articles WHERE id=?').run(id);
  return result.changes > 0;
}

export function deleteFlash(id: number): boolean {
  const result = getDb().prepare('DELETE FROM flash_news WHERE id=?').run(id);
  return result.changes > 0;
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

export function getPipelineQueues(): { pending: PipelineQueueItem[]; published: PipelineQueueItem[] } {
  const db = getDb();
  const pending = db
    .prepare(
      `SELECT id, title, status, updated_at FROM articles
       WHERE status IN ('draft','review') ORDER BY updated_at DESC LIMIT 40`
    )
    .all() as PipelineQueueItem[];
  const published = db
    .prepare(
      `SELECT id, title, slug, published_at FROM articles
       WHERE status = 'published' ORDER BY published_at DESC LIMIT 30`
    )
    .all() as PipelineQueueItem[];
  return { pending, published };
}

export function getBenchmarks(limit = 50, offset = 0): BenchmarkSummary {
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as c FROM speed_benchmarks").get() as { c: number }).c;
  const done = (db.prepare("SELECT COUNT(*) as c FROM speed_benchmarks WHERE status='done'").get() as { c: number }).c;
  const faster = (db.prepare("SELECT COUNT(*) as c FROM speed_benchmarks WHERE status='done' AND diff_seconds < 0").get() as { c: number }).c;
  const slower = (db.prepare("SELECT COUNT(*) as c FROM speed_benchmarks WHERE status='done' AND diff_seconds >= 0").get() as { c: number }).c;
  const noResult = (db.prepare("SELECT COUNT(*) as c FROM speed_benchmarks WHERE status='no_result'").get() as { c: number }).c;

  const avgRow = db.prepare("SELECT AVG(diff_seconds) as avg FROM speed_benchmarks WHERE status='done' AND diff_seconds IS NOT NULL").get() as { avg: number | null };

  const diffs = db.prepare("SELECT diff_seconds FROM speed_benchmarks WHERE status='done' AND diff_seconds IS NOT NULL ORDER BY diff_seconds").all() as { diff_seconds: number }[];
  let medianDiffSeconds: number | null = null;
  if (diffs.length > 0) {
    const mid = Math.floor(diffs.length / 2);
    medianDiffSeconds = diffs.length % 2 === 0
      ? (diffs[mid - 1].diff_seconds + diffs[mid].diff_seconds) / 2
      : diffs[mid].diff_seconds;
  }

  const records = db.prepare(`
    SELECT * FROM speed_benchmarks
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset) as BenchmarkRecord[];

  return {
    total,
    done,
    faster,
    slower,
    noResult,
    avgDiffSeconds: avgRow.avg !== null ? Math.round(avgRow.avg) : null,
    medianDiffSeconds: medianDiffSeconds !== null ? Math.round(medianDiffSeconds) : null,
    records,
  };
}
