import os
from pipeline.run import run_article_pipeline, run_flash_pipeline, run_collect_topics, run_single_article
from pipeline.agents.agent6_translator import translate_queue
from redis import Redis
from rq import Queue
from pipeline.utils.redis_conn import get_redis_connection

def calculate_priority(topic: dict) -> str:
    """Evaluate topic features and assign a queue priority."""
    source = topic.get('source', '')
    type_ = topic.get('type', '')
    category = topic.get('category_slug', '')
    
    # 方案 B：高中低优先级重新排序
    
    # 👑 最高优先级：唯一的特权留给现实世界的突发新闻
    if source != 'ai_generated':
        return 'high'
        
    # 🐌 最低优先级：时效性最弱的纯 AI 发散普通短文（比如衍生品、部分宏观等常规凑数播报）
    if type_ == 'standard' and category not in ['us-stock', 'hk-stock', 'crypto']:
        return 'low'
        
    # 🟢 正常优先级（中坚力量）：深度长文(deep)、美股、港股、加密货币等核心分类
    return 'default'

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
