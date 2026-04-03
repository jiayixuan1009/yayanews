import os
import sys
import json
import time
from datetime import datetime

# Adjust Python path to load pipeline modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.utils.database import get_conn, get_pool
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger

log = get_logger("audit_history")

PROMPT_TEMPLATE = """你是一个严苛的金融内容风控制度员。
请核对以下 YayaNews 生成的中文新闻文章是否出现了严重的事实造假或捏造数据。
【原始素材】
{source}

【生成的文章】
{content}

【核查规则】
1. 生成的文章中的任何具体数字（金额、百分比、日期）必须能在原始素材中找到出处，或者属于极度明显的客观大背景常识（如"美联储今年降息"）。如果凭空捏造了具体的价格、涨跌幅、或者在文中引用了素材中不存在的机构言论，则必须驳回。
2. 只要核心逻辑和数字没有无中生有，就可以通过，不管翻译风格如何。

请严格仅输出一个 JSON（不要任何 markdown 或其他废话）：
{{"status": "approved", "reason": "通过原因"}}
或者
{{"status": "rejected", "reason": "驳回原因：捏造了...数据"}}
"""

def upgrade_schema():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Check if columns exist
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='articles' AND column_name='audit_status';
            """)
            if cur.fetchone():
                log.info("Schema already upgraded.")
                return True
                
            log.info("Upgrading articles schema (adding audit_status & audit_reason)...")
            cur.execute("ALTER TABLE articles ADD COLUMN audit_status VARCHAR(20) DEFAULT 'approved';")
            cur.execute("ALTER TABLE articles ADD COLUMN audit_reason TEXT;")
            # Default to approved for older ones not audited yet so site doesn't break, 
            # we will overwrite immediately for bad ones below.
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        log.error(f"Failed to upgrade schema: {e}")
        return False
    finally:
        get_pool().putconn(conn)

def process_batch():
    conn = get_conn()
    articles_to_check = []
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title, content, original_content FROM articles WHERE status = 'published' AND audit_status = 'approved' ORDER BY id DESC")
            articles_to_check = cur.fetchall()
    except Exception as e:
        log.error(f"Failed to fetch articles: {e}")
        return
    finally:
        get_pool().putconn(conn)

    log.info(f"Found {len(articles_to_check)} published articles. Starting fact-check audit...")
    
    rejected_count = 0
    approved_count = 0
    
    for row in articles_to_check:
        a_id, title, content, source = row
        if not source or len(str(source).strip()) < 20:
            log.info(f"[{a_id}] {title} ... skipped (no original content / original or deep article)")
            continue
            
        prompt = PROMPT_TEMPLATE.format(source=str(source)[:2500], content=str(content)[:2500])
        
        try:
            res = chat("你是金融内容风控员，只能输出 JSON。", prompt, temperature=0.1, max_tokens=200)
            # parse json
            start = res.find("{")
            end = res.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(res[start:end])
                status = data.get("status", "approved")
                reason = data.get("reason", "")
                
                if status == "rejected":
                    rejected_count += 1
                    log.warning(f"❌ REJECTED: [{a_id}] {title} - {reason}")
                    _update_audit(a_id, "rejected", reason)
                else:
                    approved_count += 1
                    log.info(f"✅ APPROVED: [{a_id}] {title}")
                    
            else:
                log.warning(f"Could not parse JSON for article {a_id}: {res}")
                
        except Exception as e:
            log.error(f"LLM or parse error for article {a_id}: {e}")
            
        time.sleep(1) # simple rate limit

    log.info(f"Audit Complete! Checked {approved_count + rejected_count} articles. Rejected {rejected_count}.")

def _update_audit(a_id: int, status: str, reason: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE articles SET audit_status=%s, audit_reason=%s WHERE id=%s", (status, reason, a_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"Failed to update audit status for {a_id}: {e}")
    finally:
        get_pool().putconn(conn)

if __name__ == "__main__":
    log.info("Starting historical audit script...")
    if upgrade_schema():
        process_batch()
    else:
        log.error("Aborting run due to schema upgrade failure.")
