import os
import sys
import json
import time
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

# Adjust Python path to load pipeline modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.utils.database import get_conn, get_pool
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger

log = get_logger("audit_history")

PROMPT_TEMPLATE = """你是一个严苛的金融内容风控制度员。
接下来你需要对以下以前发布的 YayaNews 中文新闻文章进行【自洽性和常识性安全核查】。由于历史文章的原始素材已不再保留，请你仅根据文章本身进行判断：

【待审文章】
{content}

【核查规则】
1. 检查文章是否存在极度违背金融常识的明显拼凑（例如：宣称比特币跌破1美元，苹果公司破产等不可能的离谱数字）。
2. 如果文章涉及过于离谱或带有严重导向性造假的情绪化描述，请驳回。
3. 只要大方向合理、符合一般正常的行情报道或行业内容，就予以通过。不要过于吹毛求疵。

请严格仅输出一个 JSON（不要任何 markdown 或其他废话）：
{{"status": "approved", "reason": "大体合理"}}
或者
{{"status": "rejected", "reason": "驳回原因：违背常识..."}}
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
            else:
                log.info("Upgrading articles schema (adding audit_status & audit_reason)...")
                cur.execute("ALTER TABLE articles ADD COLUMN audit_status VARCHAR(20) DEFAULT 'approved';")
                cur.execute("ALTER TABLE articles ADD COLUMN audit_reason TEXT;")
                
            # Always ensure English articles have cover_images populated from their parent
            cur.execute("""
                UPDATE articles e
                SET cover_image = z.cover_image
                FROM articles z
                WHERE e.lang='en' 
                  AND e.parent_id = z.id 
                  AND (e.cover_image IS NULL OR e.cover_image = '');
            """)
            log.info("Historical English cover_images fixed.")
            
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
            cur.execute("SELECT id, title, content FROM articles WHERE status = 'published' AND audit_status = 'approved' ORDER BY id DESC")
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
        a_id, title, content = row
        
        prompt = PROMPT_TEMPLATE.format(content=str(content)[:2500])
        
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
