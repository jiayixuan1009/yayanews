from pipeline.utils.database import get_conn, get_pool
from pipeline.utils.logger import get_logger

log = get_logger("topic_tagger")

TOPIC_RULES = [
    {"slug": "nvidia", "tickers": ["NVDA"], "title_kws": ["英伟达", "NVIDIA"]},
    {"slug": "apple", "tickers": ["AAPL"], "title_kws": ["苹果", "Apple"]},
    {"slug": "tesla", "tickers": ["TSLA"], "title_kws": ["特斯拉", "Tesla"]},
    {"slug": "microsoft", "tickers": ["MSFT"], "title_kws": ["微软", "Microsoft"]},
    {"slug": "amd", "tickers": ["AMD"], "title_kws": ["AMD"]},
    {"slug": "google", "tickers": ["GOOGL", "GOOG"], "title_kws": ["谷歌", "Google"]},
    {"slug": "meta", "tickers": ["META"], "title_kws": ["Meta"]},
    {"slug": "intc", "tickers": ["INTC"], "title_kws": ["英特尔", "Intel"]},
    {"slug": "smci", "tickers": ["SMCI"], "title_kws": ["超微电脑"]},
    {"slug": "coinbase", "tickers": ["COIN"], "title_kws": ["Coinbase"]},

    {"slug": "openai", "tickers": [], "title_kws": ["OpenAI", "奥特曼"]},
    {"slug": "anthropic", "tickers": [], "title_kws": ["Anthropic"]},
    {"slug": "xai", "tickers": [], "title_kws": ["xAI"]},
    {"slug": "spacex", "tickers": [], "title_kws": ["SpaceX", "星舰"]},
    {"slug": "tiktok", "tickers": [], "title_kws": ["TikTok", "字节跳动"]},
    {"slug": "telegram", "tickers": [], "title_kws": ["Telegram", "Toncoin", "TON"]},

    {"slug": "chatgpt", "tickers": [], "title_kws": ["ChatGPT"]},
    {"slug": "sora", "tickers": [], "title_kws": ["Sora"]},
    {"slug": "llm", "tickers": [], "title_kws": ["大模型", "LLM"]},
    {"slug": "defi", "tickers": [], "title_kws": ["DeFi", "去中心化金融"]},
    {"slug": "layer2", "tickers": [], "title_kws": ["Layer2", "L2", "二层网络"]},

    {"slug": "fed", "tickers": [], "title_kws": ["美联储", "加息", "降息", "鲍威尔"]},
    {"slug": "cpi", "tickers": [], "title_kws": ["CPI", "非农", "通胀"]},
    {"slug": "earnings", "tickers": [], "title_kws": ["财报", "业绩"]},
    {"slug": "btc", "tickers": ["BTC"], "title_kws": ["比特币", "Bitcoin"]},
    {"slug": "eth", "tickers": ["ETH"], "title_kws": ["以太坊", "Ethereum"]}
]

def auto_assign_topic(article_id: int, title: str, tickers_str: str) -> None:
    if article_id <= 0:
        return
        
    title_upper = title.upper()
    tickers = [t.strip().upper() for t in (tickers_str or "").split(",") if t.strip()]
    
    matched_slug = None
    for rule in TOPIC_RULES:
        # Match Tickers
        if any(ts in tickers for ts in rule["tickers"]):
            matched_slug = rule["slug"]
            break
        # Match Title KWs
        if any(kw.upper() in title_upper for kw in rule["title_kws"]):
            matched_slug = rule["slug"]
            break
            
    if not matched_slug:
        return
        
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # check if topic_id is already assigned
            cur.execute("SELECT topic_id FROM articles WHERE id=%s", (article_id,))
            res = cur.fetchone()
            if res and res[0] is not None:
                return # Already assigned manually or earlier
                
            cur.execute("SELECT id FROM topics WHERE slug=%s", (matched_slug,))
            row = cur.fetchone()
            if row:
                topic_id = row[0]
                cur.execute("UPDATE articles SET topic_id=%s WHERE id=%s", (topic_id, article_id))
                log.info(f"Auto-assigned article {article_id} to topic '{matched_slug}' (id={topic_id})")
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"Failed to auto-assign topic: {e}")
    finally:
        get_pool().putconn(conn)
