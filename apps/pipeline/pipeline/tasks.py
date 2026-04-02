import os
from pipeline.run import run_article_pipeline, run_flash_pipeline, run_collect_topics, run_single_article
from pipeline.agents.agent6_translator import translate_queue
from redis import Redis
from rq import Queue
from pipeline.utils.redis_conn import get_redis_connection

def calculate_priority(topic: dict) -> str:
    """
    内容创作队列优先级分类器 (v3 信源强化版)

    文章队列共有两种信源：
      - rss          → CoinDesk / CoinTelegraph / SeekingAlpha 等权威外媒 RSS
      - ai_generated → LLM 基于关键词发散生成的选题

    判断维度：来源(source) × 分类(category) × 文章类型(type)

    三档定义：
    - high    = 权威外媒真实外电 → 代表现实事件，时效最强，必须插队
    - default = 核心市场主干内容 → AI 发散但高相关性，按序稳定产出
    - low     = 边缘填充内容     → 非核心 AI 发散，资源空闲时处理
    """
    source   = topic.get('source', '')
    type_    = topic.get('type', 'standard')
    category = topic.get('category_slug', '')

    # ─── 信源层 ───────────────────────────────────────────────
    # 文章队列中，只有 source='rss' 代表真实外媒抓取（区别于快讯通道的多路 API）
    is_real_news = source == 'rss'
    # 英文信源比中文信源高半档：英文外媒在信息传播链中是第一手来源，时效更强
    is_english   = topic.get('source_lang', 'zh') == 'en'

    # ─── 分类层 ───────────────────────────────────────────────
    CORE_MARKETS   = {'us-stock', 'hk-stock', 'crypto'}   # 高波动，分秒必争
    ACTIVE_MARKETS = {'derivatives'}                        # 日内行情，节奏略缓

    is_core   = category in CORE_MARKETS
    is_active = category in ACTIVE_MARKETS
    is_deep   = type_ == 'deep'

    # ══════════════════════════════════════════════════════════
    # 优先级决策树
    # ══════════════════════════════════════════════════════════

    # 👑 HIGH：英文外媒 RSS（CoinDesk / CoinTelegraph / SeekingAlpha 等）
    #    信息传播链第一手，时效最强，无论哪个市场都无条件插队
    if is_real_news and is_english:
        return 'high'

    # 🟢 DEFAULT (高位)：中文 RSS 外电 → 比 AI 发散更接近现实，但弱于英文一线
    if is_real_news:
        return 'default'

    # 🟢 DEFAULT：核心市场的所有 AI 内容（深度文 + 标准文）
    if is_core:
        return 'default'

    # 🟢 DEFAULT：衍生品深度研报（高留存价值，不降级）
    if is_active and is_deep:
        return 'default'

    # 🐌 LOW：衍生品普通短文（AI 发散凑数播报）
    if is_active:
        return 'low'

    # 🐌 LOW：其他分类 AI 内容（兜底）
    return 'low'

def task_collect_and_enqueue_articles(batch_size: int = 10):
    """供 RQ 队列调用的阶段一解耦任务：仅采集选题，然后依据优先级规则分发。"""
    topics = run_collect_topics(batch_size=batch_size)
    if not topics:
        return "No topics collected"
        
    conn = get_redis_connection()
    
    for topic in topics:
        prio = calculate_priority(topic)
        q = Queue(f'yayanews:articles:{prio}', connection=conn)
        
        q.enqueue(task_process_single_article, topic=topic, job_timeout=1200)
        
    return f"Enqueued {len(topics)} individual article generation jobs across priority logic"

def task_process_single_article(topic: dict):
    """供 RQ 队列调用的原子任务：专注于写一篇文章。"""
    published = run_single_article(topic)
    return f"Completed single article processing: {topic.get('title')}"

def task_run_articles_and_translate(batch_size: int = 10):
    """[兼容旧版] 供 RQ 队列调用的整合型文章任务。包含中文多 Agent 写入及后续的英文 Agent 6 转译。"""
    articles = run_article_pipeline(batch_size=batch_size)
    if articles:
        translate_queue(batch_size=len(articles))
    return f"Completed {len(articles)} articles and translation queue"

def task_run_flash(count: int = 10):
    """供 RQ 队列调用的快讯聚合任务。"""
    run_flash_pipeline(count=count)
    return f"Completed flash flush for {count} targets"
