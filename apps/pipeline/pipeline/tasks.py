import os
from pipeline.run import run_article_pipeline, run_flash_pipeline, run_collect_topics, run_single_article
from pipeline.agents.agent6_translator import translate_queue
from redis import Redis
from rq import Queue
from pipeline.utils.redis_conn import get_redis_connection

def task_collect_and_enqueue_articles(batch_size: int = 10):
    """供 RQ 队列调用的阶段一解耦任务：仅采集选题，然后将选题独立打散投放到文章队列排队执行。"""
    topics = run_collect_topics(batch_size=batch_size)
    if not topics:
        return "No topics collected"
        
    conn = get_redis_connection()
    q = Queue('yayanews:articles', connection=conn)
    
    for topic in topics:
        q.enqueue(task_process_single_article, topic=topic, job_timeout=1200)
        
    return f"Enqueued {len(topics)} individual article generation jobs"

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
