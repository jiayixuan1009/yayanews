"""
临时任务：清理僵尸 draft + 立即触发大批量文章生产 + 暂停快讯。
直接使用 psycopg2 和 redis，不依赖 pipeline 内部数据库模块。
"""
import os, sys, json, time
os.environ["DATABASE_URL"] = "postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews"
os.environ["LLM_API_KEY"] = "sk-5ff36f81c0a1485caf5cb617c313efb8"

sys.path.insert(0, '/var/www/yayanews/apps/pipeline')
os.chdir('/var/www/yayanews/apps/pipeline')

import psycopg2
from redis import Redis
from rq import Queue

DB_URL = os.environ["DATABASE_URL"]
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")

# ── Step 1: 清理僵尸 draft ──
print("=" * 50)
print("Step 1: 清理僵尸 draft 文章")
print("=" * 50)

db = psycopg2.connect(DB_URL)
db.autocommit = True
cur = db.cursor()

cur.execute("SELECT count(*) FROM articles WHERE status = 'draft'")
total_drafts = cur.fetchone()[0]
print(f"  当前 draft 文章总数: {total_drafts}")

# 删除包含 "创作中" 的占位 draft（这些是流水线中断产生的僵尸记录）
cur.execute("DELETE FROM articles WHERE status = 'draft' AND title LIKE '%创作中%'")
zombie_count = cur.rowcount
print(f"  已删除僵尸占位记录: {zombie_count} 篇")

cur.execute("SELECT count(*) FROM articles WHERE status = 'draft'")
remaining = cur.fetchone()[0]
print(f"  剩余 draft: {remaining} 篇")
cur.close()
db.close()

# ── Step 2: 暂停快讯，集中火力消费文章 ──
print("\n" + "=" * 50)
print("Step 2: 临时切到 articles-only 模式")
print("=" * 50)

config_path = "/var/www/yayanews/apps/pipeline/data/daemon_config.json"
new_config = {
    "mode": "articles",
    "flash": 0,
    "articles": 20,
    "timestamp": time.time()
}
os.makedirs(os.path.dirname(config_path), exist_ok=True)
with open(config_path, "w") as f:
    json.dump(new_config, f)
print(f"  已切换到: {json.dumps(new_config)}")

# ── Step 3: 立即向队列投递一轮 20 篇选题 ──
print("\n" + "=" * 50)
print("Step 3: 立即投递 20 篇文章选题到 RQ 队列")
print("=" * 50)

from pipeline.tasks import task_collect_and_enqueue_articles

redis_conn = Redis(host=REDIS_HOST, port=6379, password="Jia1009re")
q = Queue('yayanews:articles', connection=redis_conn)
job = q.enqueue(task_collect_and_enqueue_articles, batch_size=20, job_timeout=600)
print(f"  已投递 Job: {job.id}")
print(f"  队列当前深度: {len(q)}")

# ── Step 4: 设置 5 分钟后自动恢复 all 模式 ──
print("\n" + "=" * 50)
print("Step 4: 5分钟后自动恢复 all 模式")
print("=" * 50)

restore_script = f'''import json, time
time.sleep(300)
config = {{"mode": "all", "flash": 12, "articles": 10, "timestamp": time.time()}}
with open("{config_path}", "w") as f:
    json.dump(config, f)
print("已恢复 all 模式")
'''
with open("/tmp/restore_mode.py", "w") as f:
    f.write(restore_script)

os.system("nohup python3 /tmp/restore_mode.py > /tmp/restore_mode.log 2>&1 &")
print("  已启动后台恢复计时器 (5分钟)")

print("\n" + "=" * 50)
print("Done! 僵尸已清理，文章生产已启动，快讯5分钟后恢复。")
print("=" * 50)
