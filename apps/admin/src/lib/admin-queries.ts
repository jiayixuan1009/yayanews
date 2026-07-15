import { randomUUID } from 'node:crypto';
import * as db from '@yayanews/database';
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

export interface LoopSummaryItem {
  opportunity_type: string;
  status: string;
  count: number;
  max_priority: number | null;
  last_seen_at: string | null;
}

export interface LoopOpportunityItem {
  id: number;
  opportunity_type: string;
  status: string;
  priority: number;
  score: number;
  entity_kind: string;
  entity_value: string;
  lang: string | null;
  title: string;
  reason: string;
  metrics: Record<string, unknown>;
  recommended_action: string;
  url: string | null;
  updated_at: string;
  last_seen_at: string;
}

export interface LoopActionItem {
  id: number;
  action_type: string;
  status: string;
  risk_level: string;
  target_kind: string;
  target_id: number | null;
  target_value: string | null;
  target_url: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  updated_at: string;
  opportunity_type: string | null;
  priority: number | null;
}

export interface LoopRunItem {
  id: number;
  run_type: string;
  mode: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  stats: Record<string, unknown>;
  notes: string;
}

export interface LoopDashboard {
  summaries: LoopSummaryItem[];
  opportunities: LoopOpportunityItem[];
  actions: LoopActionItem[];
  runs: LoopRunItem[];
}

export interface LoopExecuteResult {
  inspectedActions: number;
  updatedActions: number;
  results: {
    id: number;
    action_type: string;
    target_value: string | null;
    status: string;
    message: string;
  }[];
}

export interface LoopMutationResult {
  updated: number;
  message: string;
}

function buildDashboardFilter(
  alias: 'a' | 'f',
  dateColumn: 'created_at' | 'published_at',
  lang?: string,
  startDate?: string | null,
  endDate?: string | null,
  startIndex = 1
) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = startIndex;

  if (lang && lang !== 'all') {
    params.push(lang);
    clauses.push(`${alias}.lang = $${paramIndex++}`);
  }

  if (startDate) {
    params.push(startDate);
    clauses.push(`date(${alias}.${dateColumn}) >= $${paramIndex++}::date`);
  }

  if (endDate) {
    params.push(endDate);
    clauses.push(`date(${alias}.${dateColumn}) <= $${paramIndex++}::date`);
  }

  return {
    nextIndex: paramIndex,
    params,
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    and: clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '',
  };
}

export async function getDashboardStats(lang?: string, startDate?: string, endDate?: string): Promise<DashboardStats> {
  const isD = (s?: string) => s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const sd = isD(startDate) ? startDate : null;
  const ed = isD(endDate) ? endDate : null;

  const articleFilter = buildDashboardFilter('a', 'created_at', lang, sd, ed);
  const flashFilter = buildDashboardFilter('f', 'published_at', lang, sd, ed);
  const combinedArticleFilter = buildDashboardFilter('a', 'created_at', lang, sd, ed);
  const combinedFlashFilter = buildDashboardFilter(
    'f',
    'published_at',
    lang,
    sd,
    ed,
    combinedArticleFilter.nextIndex
  );
  const combinedParams = [...combinedArticleFilter.params, ...combinedFlashFilter.params];

  const todayArticleParams = lang && lang !== 'all' ? [lang] : [];
  const todayArticleLangClause = todayArticleParams.length > 0 ? 'AND a.lang = $1' : '';
  const todayFlashParams = lang && lang !== 'all' ? [lang] : [];
  const todayFlashLangClause = todayFlashParams.length > 0 ? 'AND f.lang = $1' : '';

  const [{ c: totalArticles }] = await db.queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM articles a ${articleFilter.where}`,
    articleFilter.params
  );
  const [{ c: totalFlash }] = await db.queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM flash_news f ${flashFilter.where}`,
    flashFilter.params
  );
  const [{ c: totalViews }] = await db.queryAll<{ c: number }>(
    `SELECT COALESCE(SUM(a.view_count),0)::int as c FROM articles a ${articleFilter.where}`,
    articleFilter.params
  );

  const [{ c: todayArticles }] = await db.queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM articles a WHERE date(a.created_at) = CURRENT_DATE ${todayArticleLangClause}`,
    todayArticleParams
  );

  const [{ c: todayFlash }] = await db.queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM flash_news f WHERE date(f.published_at) = CURRENT_DATE ${todayFlashLangClause}`,
    todayFlashParams
  );

  const categoryStats = await db.queryAll<DashboardStats['categoryStats'][0]>(`
    SELECT c.slug, c.name,
      (SELECT COUNT(*)::int FROM articles a WHERE a.category_id=c.id ${combinedArticleFilter.and}) as articles,
      (SELECT COUNT(*)::int FROM flash_news f WHERE f.category_id=c.id ${combinedFlashFilter.and}) as flash
    FROM categories c ORDER BY c.sort_order
  `, combinedParams);

  const recentArticles = await db.queryAll<Article & { category_name: string; category_slug: string }>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    ${articleFilter.where}
    ORDER BY a.created_at DESC LIMIT 10
  `, articleFilter.params);

  const trendStart = sd ? `'${sd}'::date` : `CURRENT_DATE - INTERVAL '6 days'`;
  const trendEnd = ed ? `'${ed}'::date` : `CURRENT_DATE`;

  const dailyTrend = await db.queryAll<DashboardStats['dailyTrend'][0]>(`
    SELECT d.date::text,
      COALESCE(ac.cnt, 0)::int as articles,
      COALESCE(fc.cnt, 0)::int as flash
    FROM (
      SELECT generate_series(${trendStart}, ${trendEnd}, '1 day')::date AS date
    ) d
    LEFT JOIN (SELECT date(a.created_at) as dt, COUNT(*)::int as cnt FROM articles a ${combinedArticleFilter.where} GROUP BY dt) ac ON ac.dt=d.date
    LEFT JOIN (SELECT date(f.published_at) as dt, COUNT(*)::int as cnt FROM flash_news f ${combinedFlashFilter.where} GROUP BY dt) fc ON fc.dt=d.date
    ORDER BY d.date
  `, combinedParams);

  const processingStats = await db.queryGet<ProcessingStats>(`
    SELECT
      (SELECT AVG(EXTRACT(EPOCH FROM (a.published_at - a.collected_at)))::int
       FROM articles a WHERE a.collected_at IS NOT NULL AND a.published_at IS NOT NULL ${combinedArticleFilter.and}) as "avgArticleSeconds",
      (SELECT AVG(EXTRACT(EPOCH FROM (f.published_at - f.collected_at)))::int
       FROM flash_news f WHERE f.collected_at IS NOT NULL AND f.published_at IS NOT NULL ${combinedFlashFilter.and}) as "avgFlashSeconds",
      (SELECT MAX(EXTRACT(EPOCH FROM (a.published_at - a.collected_at)))::int
       FROM articles a WHERE a.collected_at IS NOT NULL AND a.published_at IS NOT NULL ${combinedArticleFilter.and}) as "maxArticleSeconds",
      (SELECT MAX(EXTRACT(EPOCH FROM (f.published_at - f.collected_at)))::int
       FROM flash_news f WHERE f.collected_at IS NOT NULL AND f.published_at IS NOT NULL ${combinedFlashFilter.and}) as "maxFlashSeconds",
      (SELECT AVG(EXTRACT(EPOCH FROM (a.published_at - a.collected_at)))::int
       FROM articles a WHERE a.collected_at IS NOT NULL AND a.published_at IS NOT NULL AND date(a.created_at)=CURRENT_DATE ${combinedArticleFilter.and}) as "todayAvgArticleSeconds",
      (SELECT AVG(EXTRACT(EPOCH FROM (f.published_at - f.collected_at)))::int
       FROM flash_news f WHERE f.collected_at IS NOT NULL AND f.published_at IS NOT NULL AND date(f.created_at)=CURRENT_DATE ${combinedFlashFilter.and}) as "todayAvgFlashSeconds"
  `, combinedParams);

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

const AUTHOR_PROFILE_SQL = `
  CASE WHEN au.id IS NULL THEN NULL ELSE json_build_object(
    'id', au.id,
    'slug', au.slug,
    'display_name', au.display_name,
    'role', au.role,
    'bio', au.bio,
    'expertise', au.expertise,
    'avatar_url', au.avatar_url,
    'email_or_contact', au.email_or_contact,
    'profile_url', au.profile_url,
    'status', au.status,
    'review_status', au.review_status,
    'is_external_source', au.is_external_source,
    'external_source_url', au.external_source_url
  ) END as author_profile
`;

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

  const [{ c: total }] = await db.queryAll<{ c: number }>(`
    SELECT COUNT(*)::int as c FROM articles a LEFT JOIN categories c ON a.category_id=c.id WHERE ${where}
  `, binds);

  const articles = await db.queryAll<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
      COALESCE(au.display_name, NULLIF(TRIM(a.author), ''), 'YayaNews') as author,
      ${AUTHOR_PROFILE_SQL},
      CASE WHEN a.collected_at IS NOT NULL AND a.published_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.published_at - a.collected_at))::int
        ELSE NULL END as processing_seconds
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    LEFT JOIN authors au ON au.id = a.author_id
    WHERE ${where}
    ORDER BY a.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `, [...binds, pageSize, offset]);

  return { articles, total, page, pageSize };
}

export async function getAdminArticleById(id: number): Promise<Article | undefined> {
  const article = await db.queryGet<Article>(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
      COALESCE(au.display_name, NULLIF(TRIM(a.author), ''), 'YayaNews') as author,
      ${AUTHOR_PROFILE_SQL},
      CASE WHEN a.collected_at IS NOT NULL AND a.published_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (a.published_at - a.collected_at))::int
        ELSE NULL END as processing_seconds
    FROM articles a LEFT JOIN categories c ON a.category_id=c.id
    LEFT JOIN authors au ON au.id = a.author_id
    WHERE a.id=$1
  `, [id]);
  
  if (article) {
    const tags = await db.queryAll<{ id: number; name: string; slug: string }>(`
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

  const [{ c: total }] = await db.queryAll<{ c: number }>(`
    SELECT COUNT(*)::int as c FROM flash_news f LEFT JOIN categories c ON f.category_id=c.id WHERE ${where}
  `, binds);

  const items = await db.queryAll<FlashNews>(`
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
  const allArticleRuns = await db.queryAll<{ total_seconds: number }>(
    "SELECT total_seconds::int FROM pipeline_runs WHERE run_type='article' AND started_at >= NOW() - INTERVAL '24 hours' ORDER BY total_seconds"
  );
  const allFlashRuns = await db.queryAll<{ total_seconds: number }>(
    "SELECT total_seconds::int FROM pipeline_runs WHERE run_type='flash' AND started_at >= NOW() - INTERVAL '24 hours' ORDER BY total_seconds"
  );

  const artTimes = allArticleRuns.map(r => r.total_seconds);
  const flashTimes = allFlashRuns.map(r => r.total_seconds);

  const [{ c: totalRuns }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM pipeline_runs WHERE started_at >= NOW() - INTERVAL '24 hours'");
  const [{ c: todayRuns }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM pipeline_runs WHERE date(started_at)=CURRENT_DATE");

  const [{ v: todayAvgArticle }] = await db.queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='article' AND date(started_at)=CURRENT_DATE"
  );
  const [{ v: todayAvgFlash }] = await db.queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='flash' AND date(started_at)=CURRENT_DATE"
  );

  const [{ v: yesterdayAvgArticle }] = await db.queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='article' AND date(started_at)=CURRENT_DATE - INTERVAL '1 day'"
  );
  const [{ v: yesterdayAvgFlash }] = await db.queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds)::int as v FROM pipeline_runs WHERE run_type='flash' AND date(started_at)=CURRENT_DATE - INTERVAL '1 day'"
  );

  const [{ v: perItemArticle }] = await db.queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds * 1.0 / NULLIF(items_produced,0)) as v FROM pipeline_runs WHERE run_type='article' AND started_at >= NOW() - INTERVAL '24 hours' AND items_produced>0"
  );
  const [{ v: perItemFlash }] = await db.queryAll<{ v: number | null }>(
    "SELECT AVG(total_seconds * 1.0 / NULLIF(items_produced,0)) as v FROM pipeline_runs WHERE run_type='flash' AND started_at >= NOW() - INTERVAL '24 hours' AND items_produced>0"
  );

  const artProcessingTimes = await db.queryAll<{ secs: number }>(
    `SELECT EXTRACT(EPOCH FROM (published_at - collected_at))::int as secs
     FROM articles WHERE collected_at IS NOT NULL AND published_at >= NOW() - INTERVAL '24 hours'
     ORDER BY secs`
  );
  const artProcArr = artProcessingTimes.map(r => r.secs).filter(s => s >= 0);

  const flashProcessingTimes = await db.queryAll<{ secs: number }>(
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

  const trend = await db.queryAll<SpeedTrendPoint>(`
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

  const recentRuns = await db.queryAll<PipelineRun>(
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
  await db.queryRun('DELETE FROM article_tags WHERE article_id=$1', [id]);
  const changes = await db.queryRun('DELETE FROM articles WHERE id=$1', [id]);
  return changes > 0;
}

export async function deleteFlash(id: number): Promise<boolean> {
  const changes = await db.queryRun('DELETE FROM flash_news WHERE id=$1', [id]);
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
  age_seconds?: number | null;
}

export interface PipelinePendingSummary {
  total: number;
  draft: number;
  review: number;
  stale: number;
  staleHours: number;
  oldest_updated_at: string | null;
}

export interface PipelineSourceActivity {
  source: string;
  last_seen: string;
  count_24h: number;
}

export async function getPipelineQueues(): Promise<{ 
  pending: PipelineQueueItem[]; 
  pendingSummary: PipelinePendingSummary;
  pendingFlashCount: number;
  published: PipelineQueueItem[];
  sources: PipelineSourceActivity[];
}> {
  const staleHours = 2;
  const pending = await db.queryAll<PipelineQueueItem>(
    `SELECT id, title, status, updated_at,
      EXTRACT(EPOCH FROM (NOW() - updated_at))::int as age_seconds
     FROM articles
     WHERE status IN ('draft','review') ORDER BY updated_at DESC LIMIT 40`
  );

  const [summaryRow] = await db.queryAll<{
    total: number;
    draft: number;
    review: number;
    stale: number;
    oldest_updated_at: string | null;
  }>(
    `SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'draft')::int as draft,
      COUNT(*) FILTER (WHERE status = 'review')::int as review,
      COUNT(*) FILTER (WHERE updated_at < NOW() - ($1::int * INTERVAL '1 hour'))::int as stale,
      MIN(updated_at) as oldest_updated_at
     FROM articles
     WHERE status IN ('draft','review')`,
    [staleHours]
  );

  const pendingSummary: PipelinePendingSummary = {
    total: summaryRow?.total ?? 0,
    draft: summaryRow?.draft ?? 0,
    review: summaryRow?.review ?? 0,
    stale: summaryRow?.stale ?? 0,
    staleHours,
    oldest_updated_at: summaryRow?.oldest_updated_at ?? null,
  };

  // 已投递 = 已发布文章列表
  const published = await db.queryAll<PipelineQueueItem>(
    `SELECT id, title, slug, published_at FROM articles
     WHERE status = 'published' ORDER BY published_at DESC LIMIT 40`
  );
  
  // Aggregate source activity from Flash News
  const sources = await db.queryAll<PipelineSourceActivity>(`
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

  // 快讯排队数：查询 flash_news 中过去 10 分钟内接收但尚在缓冲的条目数
  // flash 直接入库，所以用「10 分钟内新增且接收时间 ≈ 当前」来估算 RQ 快讯队列负载
  const [{ c: pendingFlashCount }] = await db.queryAll<{ c: number }>(
    `SELECT COUNT(*)::int as c FROM flash_news
     WHERE published_at >= NOW() - INTERVAL '10 minutes'`
  );

  return { pending, pendingSummary, pendingFlashCount: pendingFlashCount ?? 0, published, sources };
}

export async function archiveStalePipelineDrafts(hours = 2): Promise<{ archived: number; ids: number[]; hours: number }> {
  const safeHours = Number.isFinite(hours) ? Math.min(168, Math.max(1, Math.floor(hours))) : 2;
  const rows = await db.queryAll<{ id: number }>(
    `UPDATE articles
     SET status = 'archived', updated_at = NOW()
     WHERE status IN ('draft','review')
       AND updated_at < NOW() - ($1::int * INTERVAL '1 hour')
     RETURNING id`,
    [safeHours]
  );

  return { archived: rows.length, ids: rows.map(row => row.id), hours: safeHours };
}

export async function getBenchmarks(limit = 50, offset = 0): Promise<BenchmarkSummary> {
  const [{ c: total }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks");
  const [{ c: done }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='done'");
  const [{ c: faster }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='done' AND diff_seconds < 0");
  const [{ c: slower }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='done' AND diff_seconds >= 0");
  const [{ c: noResult }] = await db.queryAll<{ c: number }>("SELECT COUNT(*)::int as c FROM speed_benchmarks WHERE status='no_result'");

  const avgRow = await db.queryGet<{ avg: number | null }>("SELECT AVG(diff_seconds) as avg FROM speed_benchmarks WHERE status='done' AND diff_seconds IS NOT NULL");

  const diffs = await db.queryAll<{ diff_seconds: number }>("SELECT diff_seconds FROM speed_benchmarks WHERE status='done' AND diff_seconds IS NOT NULL ORDER BY diff_seconds");
  let medianDiffSeconds: number | null = null;
  if (diffs.length > 0) {
    const mid = Math.floor(diffs.length / 2);
    medianDiffSeconds = diffs.length % 2 === 0
      ? (diffs[mid - 1].diff_seconds + diffs[mid].diff_seconds) / 2
      : diffs[mid].diff_seconds;
  }

  const records = await db.queryAll<BenchmarkRecord>(`
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

export async function getLoopDashboard(limit = 30): Promise<LoopDashboard> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 30)));

  const summaries = await db.queryAll<LoopSummaryItem>(
    `
    SELECT
      opportunity_type,
      status,
      COUNT(*)::int AS count,
      MAX(priority)::int AS max_priority,
      MAX(last_seen_at)::text AS last_seen_at
    FROM content_opportunities
    GROUP BY opportunity_type, status
    ORDER BY max_priority DESC NULLS LAST, count DESC, opportunity_type
    `
  );

  const opportunities = await db.queryAll<LoopOpportunityItem>(
    `
    SELECT
      id,
      opportunity_type,
      status,
      priority,
      score::float AS score,
      entity_kind,
      entity_value,
      lang,
      title,
      reason,
      metrics,
      recommended_action,
      url,
      updated_at::text,
      last_seen_at::text
    FROM content_opportunities
    WHERE status = 'open'
    ORDER BY priority DESC, score DESC, last_seen_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  const actions = await db.queryAll<LoopActionItem>(
    `
    SELECT
      a.id,
      a.action_type,
      a.status,
      a.risk_level,
      a.target_kind,
      a.target_id,
      a.target_value,
      a.target_url,
      a.payload,
      a.result,
      a.updated_at::text,
      o.opportunity_type,
      o.priority
    FROM loop_actions a
    LEFT JOIN content_opportunities o ON o.id = a.opportunity_id
    ORDER BY a.updated_at DESC, a.created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  const runs = await db.queryAll<LoopRunItem>(
    `
    SELECT
      id,
      run_type,
      mode,
      status,
      started_at::text,
      finished_at::text,
      stats,
      notes
    FROM loop_runs
    ORDER BY started_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return { summaries, opportunities, actions, runs };
}

const SAFE_LOOP_ACTIONS = [
  'translate_en_priority',
  'meta_rewrite_draft',
  'internal_link_draft',
  'topic_brief_draft',
  'feedback_review_draft',
];

function buildLoopActionResult(action: LoopActionItem & { score?: number | null }): {
  status: string;
  message: string;
  result: Record<string, unknown>;
} {
  const payload = action.payload || {};
  const metrics = (payload.metrics || {}) as Record<string, unknown>;

  if (action.action_type === 'translate_en_priority') {
    return {
      status: 'queued',
      message: 'Marked as an Agent 6 English localization priority.',
      result: {
        target_article_id: action.target_id,
        priority: action.priority,
        score: action.score ?? 0,
        metrics,
      },
    };
  }

  if (action.action_type === 'meta_rewrite_draft') {
    return {
      status: 'executed',
      message: 'Created a CTR rewrite brief. Published metadata was not changed.',
      result: {
        brief: [
          'Rewrite title/meta description around the highest-intent matching queries.',
          'Preserve canonical, language alternates, indexability, and factual claims.',
          'Check source attribution and visible trust fields before publishing any text change.',
        ],
        metrics,
        target_url: action.target_url,
      },
    };
  }

  if (action.action_type === 'internal_link_draft') {
    return {
      status: 'executed',
      message: 'Created an internal-link boost brief. Page content was not changed.',
      result: {
        brief: [
          'Find 3-5 stronger related articles/topics and add contextual links to this target.',
          'Prefer relevant in-body links over broad footer/sidebar links.',
          'Re-run SEO and redirect checks after code/content changes.',
        ],
        metrics,
        target_url: action.target_url,
      },
    };
  }

  if (action.action_type === 'topic_brief_draft') {
    return {
      status: 'executed',
      message: 'Created a query-led content brief for the topic pipeline.',
      result: {
        brief: [
          `Search query or demand signal: ${action.target_value || '-'}`,
          'Create or refresh a focused article that directly answers the query intent.',
          'Use current source material and preserve financial-risk disclosure.',
        ],
        metrics,
      },
    };
  }

  if (action.action_type === 'feedback_review_draft') {
    return {
      status: 'executed',
      message: 'Created a feedback-signal review brief. Published content and crawl rules were not changed.',
      result: {
        brief: [
          `Feedback signal: ${action.target_value || action.target_url || '-'}`,
          'Review status code, canonical, robots/noindex, sitemap inclusion, and internal link source before changing anything.',
          'Use 410, redirect, noindex, or content update only after confirming the entity-specific cause.',
        ],
        metrics,
        target_url: action.target_url,
      },
    };
  }

  return {
    status: 'failed',
    message: `Unsupported action type: ${action.action_type}`,
    result: {},
  };
}

export async function executeLoopActions(limit = 20): Promise<LoopExecuteResult> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 20)));
  const [{ id: runId }] = await db.queryAll<{ id: number }>(
    `
    INSERT INTO loop_runs(run_key, run_type, mode, status, notes)
    VALUES ($1, 'execute_actions', 'apply', 'running', 'admin-api')
    RETURNING id
    `,
    [`admin-execute-actions-${Date.now()}-${randomUUID()}`]
  );

  const actions = await db.queryAll<LoopActionItem & { score: number | null }>(
    `
    SELECT
      a.id,
      a.action_type,
      a.status,
      a.risk_level,
      a.target_kind,
      a.target_id,
      a.target_value,
      a.target_url,
      a.payload,
      a.result,
      a.updated_at::text,
      o.opportunity_type,
      o.priority,
      o.score::float AS score
    FROM loop_actions a
    JOIN content_opportunities o ON o.id = a.opportunity_id
    WHERE a.status = 'proposed'
      AND a.risk_level = 'low'
      AND a.action_type = ANY($1::text[])
    ORDER BY o.priority DESC, o.score DESC, a.created_at ASC
    LIMIT $2
    `,
    [SAFE_LOOP_ACTIONS, safeLimit]
  );

  const results: LoopExecuteResult['results'] = [];
  try {
    for (const action of actions) {
      const built = buildLoopActionResult(action);
      await db.queryRun(
        `
        UPDATE loop_actions
        SET status = $2,
            result = $3::jsonb,
            updated_at = CURRENT_TIMESTAMP,
            queued_at = CASE WHEN $2 = 'queued' THEN COALESCE(queued_at, CURRENT_TIMESTAMP) ELSE queued_at END,
            executed_at = CASE WHEN $2 IN ('executed', 'failed') THEN COALESCE(executed_at, CURRENT_TIMESTAMP) ELSE executed_at END
        WHERE id = $1
        `,
        [action.id, built.status, JSON.stringify(built.result)]
      );
      await db.queryRun(
        `
        INSERT INTO loop_action_results(action_id, status, message, evidence)
        VALUES ($1, $2, $3, $4::jsonb)
        `,
        [action.id, built.status, built.message, JSON.stringify(built.result)]
      );
      results.push({
        id: action.id,
        action_type: action.action_type,
        target_value: action.target_value,
        status: built.status,
        message: built.message,
      });
    }

    await db.queryRun(
      `
      UPDATE loop_runs
      SET status = 'completed',
          finished_at = CURRENT_TIMESTAMP,
          stats = $2::jsonb
      WHERE id = $1
      `,
      [
        runId,
        JSON.stringify({
          inspectedActions: actions.length,
          updatedActions: results.length,
          source: 'admin-api',
        }),
      ]
    );
  } catch (error) {
    await db.queryRun(
      `
      UPDATE loop_runs
      SET status = 'failed',
          finished_at = CURRENT_TIMESTAMP,
          stats = $2::jsonb
      WHERE id = $1
      `,
      [runId, JSON.stringify({ error: error instanceof Error ? error.message : String(error) })]
    );
    throw error;
  }

  return {
    inspectedActions: actions.length,
    updatedActions: results.length,
    results,
  };
}

export async function updateLoopActionStatus(
  id: number,
  status: 'dismissed' | 'proposed'
): Promise<LoopMutationResult> {
  const updated = await db.queryRun(
    `
    UPDATE loop_actions
    SET status = $2,
        updated_at = CURRENT_TIMESTAMP,
        result = CASE
          WHEN $2 = 'dismissed' THEN jsonb_set(COALESCE(result, '{}'::jsonb), '{dismissed_by}', '"admin-api"', true)
          ELSE COALESCE(result, '{}'::jsonb) - 'dismissed_by'
        END
    WHERE id = $1
      AND status IN ('proposed', 'dismissed')
    `,
    [id, status]
  );
  if (updated > 0) {
    await db.queryRun(
      `
      INSERT INTO loop_action_results(action_id, status, message, evidence)
      VALUES ($1, $2, $3, $4::jsonb)
      `,
      [
        id,
        status,
        status === 'dismissed' ? 'Dismissed from admin.' : 'Reopened from admin.',
        JSON.stringify({ source: 'admin-api' }),
      ]
    );
  }
  return {
    updated,
    message: updated > 0 ? `Action ${status}.` : 'No eligible action updated.',
  };
}

export async function updateLoopOpportunityStatus(
  id: number,
  status: 'dismissed' | 'open'
): Promise<LoopMutationResult> {
  const updated = await db.queryRun(
    `
    UPDATE content_opportunities
    SET status = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status IN ('open', 'dismissed')
    `,
    [id, status]
  );
  return {
    updated,
    message: updated > 0 ? `Opportunity ${status}.` : 'No eligible opportunity updated.',
  };
}
