import json
from pipeline.utils.database import get_conn, get_pool
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger

log = get_logger("agent7")

PROMPT_TEMPLATE = """你是一个严苛的金融内容风控制度员。
请核查以下 YayaNews 刚刚生成的中文新闻文章是否出现了严重的事实造假或捏造数据。
【原始素材】
{source}

【生成的文章】
{content}

【核查规则】
1. 生成的文章中的任何具体数字（金额、百分比、日期）必须能在一字不差的原始素材中找到出处，或者属于极度明显的客观大背景常识。如果凭空捏造了具体的价格、涨跌幅、或者在文中引用了素材中不存在的机构言论，则必须驳回。
2. 只要核心逻辑和数字没有无中生有，就可以通过，不管翻译风格如何。

请严格仅输出一个 JSON（不要任何 markdown 或其他多余字符）：
{{"status": "approved", "reason": "通过原因"}}
或者
{{"status": "rejected", "reason": "驳回原因：捏造了...数据"}}
"""

def audit_article(article_id: int, title: str, content: str, source: str) -> bool:
    """对生成的文章进行事后审核，更新 audit_status"""
    if not source or len(str(source).strip()) < 20:
        return True # 无原始素材的原创文章暂不管制
        
    prompt = PROMPT_TEMPLATE.format(source=str(source)[:2500], content=str(content)[:2500])
    
    try:
        res = chat("你是金融风控员。", prompt, temperature=0.1, max_tokens=200)
        start = res.find("{")
        end = res.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(res[start:end])
            status = data.get("status", "approved")
            reason = data.get("reason", "")
            
            _update_db(article_id, status, reason)
            
            if status == "rejected":
                log.warning(f"[Audit Reject] ID:{article_id} '{title}' - {reason}")
                return False
            else:
                log.info(f"[Audit Pass] ID:{article_id} '{title}'")
                return True
        else:
            log.warning(f"Audit LLM output not parsable: {res}")
            return True
            
    except Exception as e:
        log.error(f"Audit error for article {article_id}: {e}")
        return True

def _update_db(a_id: int, status: str, reason: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE articles SET audit_status=%s, audit_reason=%s WHERE id=%s", (status, reason, a_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"Update audit status failed: {e}")
    finally:
        get_pool().putconn(conn)
