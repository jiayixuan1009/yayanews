import os
from pipeline.run import run_article_pipeline, run_flash_pipeline
from pipeline.agents.agent6_translator import translate_queue

def task_run_articles_and_translate(batch_size: int = 10):
    """供 RQ 队列调用的整合型文章任务。包含中文多 Agent 写入及后续的英文 Agent 6 转译。"""
    articles = run_article_pipeline(batch_size=batch_size)
    if articles:
        translate_queue(batch_size=len(articles))
    return f"Completed {len(articles)} articles and translation queue"

def task_run_flash(count: int = 10):
    """供 RQ 队列调用的快讯聚合任务。"""
    run_flash_pipeline(count=count)
    return f"Completed flash flush for {count} targets"
