"""
Pipeline 全局配置。
所有 API Key 必须通过环境变量设置，不允许硬编码。
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# ── 项目路径 ──
# __file__ is apps/pipeline/pipeline/config/settings.py
PROJECT_ROOT = Path(__file__).resolve().parents[4]
load_dotenv(PROJECT_ROOT / ".env")

# ── LLM 配置（主线路：OpenRouter → 兜底：DeepSeek 直连）──
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://openrouter.fans/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
if not LLM_API_KEY:
    raise EnvironmentError("LLM_API_KEY environment variable is required. Set it in .env or system env.")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")
LLM_REASONER_MODEL = os.environ.get("LLM_REASONER_MODEL", "deepseek-reasoner")

# 兜底线路
LLM_FALLBACK_BASE_URL = os.environ.get("LLM_FALLBACK_BASE_URL", "https://api.deepseek.com/v1")
LLM_FALLBACK_API_KEY = os.environ.get("LLM_FALLBACK_API_KEY", "")
LLM_FALLBACK_MODEL = os.environ.get("LLM_FALLBACK_MODEL", "deepseek-chat")

# ── 每轮生产配置 ──
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "10"))
ARTICLE_MIX = {"standard": 0.7, "deep": 0.3}


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    return float(raw)


NEWS_SOURCE_CONNECT_TIMEOUT_SECONDS = _env_float("NEWS_SOURCE_CONNECT_TIMEOUT_SECONDS", 30.0)
NEWS_SOURCE_READ_TIMEOUT_SECONDS = _env_float("NEWS_SOURCE_READ_TIMEOUT_SECONDS", 35.0)
NEWS_SOURCE_TIMEOUT = (NEWS_SOURCE_CONNECT_TIMEOUT_SECONDS, NEWS_SOURCE_READ_TIMEOUT_SECONDS)

# ── 分类 ──
CATEGORIES = {
    "us-stock": {"id": 1, "name": "美股", "keywords": ["美股", "纳斯达克", "标普500", "道琼斯", "NASDAQ", "S&P", "NYSE", "AAPL", "TSLA", "NVDA", "Wall Street"]},
    "crypto":   {"id": 2, "name": "加密货币", "keywords": ["比特币", "以太坊", "BTC", "ETH", "DeFi", "NFT", "加密货币", "crypto", "blockchain"]},
    "derivatives": {
        "id": 3, "name": "衍生品",
        "keywords": ["黄金", "原油", "期货", "期权", "衍生品", "大宗商品", "外汇", "债券", "铜", "gold", "oil", "commodity", "derivatives", "options", "forex", "bond"],
        "subcategories": {
            "commodity": {"name": "大宗商品", "keywords": ["黄金", "原油", "gold", "oil", "铜", "copper", "wheat", "commodity", "大宗商品", "Brent", "crude", "OPEC", "silver", "铁矿石", "天然气"]},
            "futures":   {"name": "期货",     "keywords": ["期货", "futures", "螺纹钢", "交割", "合约", "主力合约"]},
            "options":   {"name": "期权",     "keywords": ["期权", "options", "行权", "隐含波动率", "IV", "看涨期权", "看跌期权", "call", "put"]},
            "forex":     {"name": "外汇",     "keywords": ["外汇", "forex", "USD", "EUR", "CNY", "JPY", "GBP", "汇率", "美元指数", "DXY"]},
            "bonds":     {"name": "债券",     "keywords": ["债券", "bond", "treasury", "国债", "收益率", "yield", "利率互换"]},
        },
    },
    "hk-stock": {"id": 4, "name": "港股", "keywords": ["港股", "恒生指数", "恒指", "港交所", "HKEX", "HSI", "腾讯", "阿里巴巴", "Hong Kong"]},
}

# ── RSS 源 ──
RSS_FEEDS = [
    {"url": "https://feeds.feedburner.com/CoinDesk", "category": "crypto", "lang": "en"},
    {"url": "https://cointelegraph.com/rss", "category": "crypto", "lang": "en"},
    {"url": "https://seekingalpha.com/market_currents.xml", "category": "us-stock", "lang": "en"},
    {"url": "https://rss-public.bwe-ws.com", "category": "crypto", "lang": "zh"},
]

# ── 中文快讯 RSS（无需英译中，降低延迟与 LLM 消耗）──
CN_FLASH_RSS_FEEDS = [
    # 美股/宏观
    {"url": "https://www.chinanews.com.cn/rss/finance.xml", "category": "us-stock"},
    {"url": "http://finance.people.com.cn/rss/finance.xml", "category": "us-stock"},
    # 港股
    {"url": "http://www.aastocks.com/sc/resources/news-rss.php", "category": "hk-stock"},
    {"url": "https://www1.hkexnews.hk/api/v1/rss?lang=zh", "category": "hk-stock"},
    {"url": "http://rss.sina.com.cn/roll/finance/hk/hot_roll.xml", "category": "hk-stock"},
]

# ── SCMP + HKEX 港股专业源 ──
SCMP_HKEX_FEEDS = [
    # SCMP 南华早报 — 英文港股金融新闻（速度最快、质量最高）
    {"url": "https://www.scmp.com/rss/92/feed",  "category": "hk-stock", "lang": "en", "tag": "SCMP/Business"},
    {"url": "https://www.scmp.com/rss/10/feed",  "category": "hk-stock", "lang": "en", "tag": "SCMP/Companies"},
    {"url": "https://www.scmp.com/rss/318210/feed", "category": "hk-stock", "lang": "en", "tag": "SCMP/HK-Economy"},
    # HKEX 港交所官方公告
    {"url": "https://www.hkex.com.hk/Services/RSS-Feeds/News-Releases?sc_lang=en", "category": "hk-stock", "lang": "en", "tag": "HKEX/News"},
    {"url": "https://www.hkex.com.hk/Services/RSS-Feeds/regulatory-announcements?sc_lang=en", "category": "hk-stock", "lang": "en", "tag": "HKEX/Regulatory"},
    {"url": "https://www.hkex.com.hk/Services/RSS-Feeds/market-communications?sc_lang=en", "category": "hk-stock", "lang": "en", "tag": "HKEX/MarketComm"},
]

# ══════════════════════════════════════════════════════════════
# 快讯多通道配置
# 每个通道独立控制：开关 / 权重 / 单次限额 / 超时 / API 参数
# ══════════════════════════════════════════════════════════════

FLASH_CHANNELS = {
    "finnhub_ws": {
        "enabled": True,
        "weight": 5,
    },
    "finnhub": {
        "enabled": True,
        "weight": 5,          # 权重越高，同等条件下优先入库
        "max_items": 16,      # 单次最多拉取条数
        "api_url": "https://finnhub.io/api/v1",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "api_key": os.environ.get("FINNHUB_KEY", ""),
        "categories": ["general", "crypto"],
    },
    "marketaux": {
        "enabled": False,
        "weight": 4,
        "max_items": 15,
        "api_url": "https://api.marketaux.com/v1",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "api_key": os.environ.get("MARKETAUX_KEY", ""),
        "searches": ["bitcoin,crypto,ethereum", "US stock,NASDAQ,Wall Street", "Hong Kong stock,Hang Seng", "gold,oil,commodity"],
        "per_search": 5,
    },
    "cryptocompare": {
        "enabled": True,
        "weight": 3,
        "max_items": 10,
        "api_url": "https://min-api.cryptocompare.com/data",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "api_key": os.environ.get("CRYPTOCOMPARE_KEY", ""),
    },
    "coingecko": {
        "enabled": True,
        "weight": 2,
        "max_items": 20,
        "api_url": "https://api.coingecko.com/api/v3",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "move_threshold": 2.0,  # 涨跌幅阈值(%)
    },
    "newsapi": {
        "enabled": True,
        "weight": 3,
        "max_items": 15,
        "api_url": "https://newsapi.org/v2/top-headlines",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "api_key": os.environ.get("NEWSAPI_KEY", ""),
        "categories": ["business", "technology"],
    },
    "polygon": {
        "enabled": True,
        "weight": 4,
        "max_items": 15,
        "api_url": "https://api.polygon.io/v2/reference/news",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "api_key": os.environ.get("POLYGON_KEY", ""),
    },
    "alphavantage": {
        "enabled": True,
        "weight": 3,
        "max_items": 15,
        "api_url": "https://www.alphavantage.co/query",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "api_key": os.environ.get("ALPHAVANTAGE_KEY", ""),
        "topics": ["blockchain", "financial_markets", "earnings"],
    },
    "rss": {
        "enabled": True,
        "weight": 1,
        "max_items": 15,
        "timeout": NEWS_SOURCE_TIMEOUT,
    },
    "scmp_hkex": {
        "enabled": True,
        "weight": 7,          # 最高优先级：港股专业源
        "max_items": 20,
        "timeout": NEWS_SOURCE_TIMEOUT,
    },
    "bwenews": {
        "enabled": True,
        "weight": 6,          # 方程式新闻：加密快讯 Alpha 源
        "max_items": 10,
        "rss_url": "https://rss-public.bwe-ws.com",
        "timeout": NEWS_SOURCE_TIMEOUT,
    },
    "cn_sina": {
        "enabled": True,
        "weight": 6,
        "max_items": 25,
        "api_url": "https://feed.sina.com.cn/api/roll/get",
        "timeout": NEWS_SOURCE_TIMEOUT,
        "pageid": 153,
        "lid": 2516,
    },
    "cn_rss": {
        "enabled": True,
        "weight": 5,
        "max_items": 18,
        "timeout": NEWS_SOURCE_TIMEOUT,
    },
    "llm_fallback": {
        "enabled": False,   # 关闭 LLM 凭空生成快讯，节省 Token
        "weight": 0,
    },
}

FLASH_CONCURRENCY = int(os.environ.get("FLASH_CONCURRENCY", "6"))
FLASH_TRANSLATE_BATCH = int(os.environ.get("FLASH_TRANSLATE_BATCH", "1"))
FLASH_NORMALIZE_BATCH = int(os.environ.get("FLASH_NORMALIZE_BATCH", "12"))
FLASH_LLM_CANDIDATE_MULTIPLIER = int(os.environ.get("FLASH_LLM_CANDIDATE_MULTIPLIER", "4"))
FLASH_OUTPUT_LANGS = [
    lang.strip().lower()
    for lang in os.environ.get("FLASH_OUTPUT_LANGS", "zh,en").split(",")
    if lang.strip().lower() in ("zh", "en")
] or ["zh"]
FLASH_LLM_CLEAN_SAME_LANG = os.environ.get("FLASH_LLM_CLEAN_SAME_LANG", "1") == "1"
# WebSocket 缓冲单次消费条数（需配合 pipeline.daemon.finnhub_ws_flash）
FLASH_WS_DRAIN_MAX = int(os.environ.get("FLASH_WS_DRAIN_MAX", "25"))

# 文章 Pipeline：选题并行分类数、LLM 并行度（写作/SEO）
PIPELINE_COLLECT_WORKERS = int(os.environ.get("PIPELINE_COLLECT_WORKERS", "4"))
PIPELINE_LLM_WORKERS = int(os.environ.get("PIPELINE_LLM_WORKERS", "4"))
ARTICLE_STANDARD_MAX_TOKENS = int(os.environ.get("ARTICLE_STANDARD_MAX_TOKENS", "2800"))
ARTICLE_DEEP_MAX_TOKENS = int(os.environ.get("ARTICLE_DEEP_MAX_TOKENS", "4096"))
ARTICLE_DEEP_RATIO = float(os.environ.get("ARTICLE_DEEP_RATIO", "0.15"))
ENABLE_FLASH_EMBEDDING = os.environ.get("ENABLE_FLASH_EMBEDDING", "1") == "1"
EMBEDDING_API_KEY = os.environ.get("EMBEDDING_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
EMBEDDING_BASE_URL = os.environ.get("EMBEDDING_BASE_URL") or os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

# ── Agent 6 英文翻译控制（按需翻译，节省 ~17% Token）──
ENABLE_REALTIME_TRANSLATION = os.environ.get("ENABLE_REALTIME_TRANSLATION", "0") == "1"
TRANSLATION_MIN_VIEWS = int(os.environ.get("TRANSLATION_MIN_VIEWS", "30"))

# ── 站点配置 ──
SITE_NAME = "YayaNews"
SITE_URL = "https://yayanews.cryptooptiontool.com"
TRADING_SITE = os.environ.get("TRADING_SITE", "https://invest.biyapay.com")
