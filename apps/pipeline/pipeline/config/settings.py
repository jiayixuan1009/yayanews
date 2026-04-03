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
    "hk-stock": {"id": 7, "name": "港股", "keywords": ["港股", "恒生指数", "恒指", "港交所", "HKEX", "HSI", "腾讯", "阿里巴巴", "Hong Kong"]},
}

# ── RSS 源 ──
RSS_FEEDS = [
    {"url": "https://feeds.feedburner.com/CoinDesk", "category": "crypto", "lang": "en"},
    {"url": "https://cointelegraph.com/rss", "category": "crypto", "lang": "en"},
    {"url": "https://seekingalpha.com/market_currents.xml", "category": "us-stock", "lang": "en"},
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
        "timeout": 12,
        "api_url": "https://finnhub.io/api/v1",
        "api_key": os.environ.get("FINNHUB_KEY", ""),
        "categories": ["general", "crypto"],
    },
    "marketaux": {
        "enabled": False,
        "weight": 4,
        "max_items": 15,
        "timeout": 12,
        "api_url": "https://api.marketaux.com/v1",
        "api_key": os.environ.get("MARKETAUX_KEY", ""),
        "searches": ["bitcoin,crypto,ethereum", "US stock,NASDAQ,Wall Street", "Hong Kong stock,Hang Seng", "gold,oil,commodity"],
        "per_search": 5,
    },
    "cryptocompare": {
        "enabled": True,
        "weight": 3,
        "max_items": 10,
        "timeout": 12,
        "api_url": "https://min-api.cryptocompare.com/data",
        "api_key": os.environ.get("CRYPTOCOMPARE_KEY", ""),
    },
    "coingecko": {
        "enabled": True,
        "weight": 2,
        "max_items": 20,
        "timeout": 12,
        "api_url": "https://api.coingecko.com/api/v3",
        "move_threshold": 2.0,  # 涨跌幅阈值(%)
    },
    "newsapi": {
        "enabled": True,
        "weight": 3,
        "max_items": 15,
        "timeout": 12,
        "api_url": "https://newsapi.org/v2/top-headlines",
        "api_key": os.environ.get("NEWSAPI_KEY", ""),
        "categories": ["business", "technology"],
    },
    "polygon": {
        "enabled": True,
        "weight": 4,
        "max_items": 15,
        "timeout": 12,
        "api_url": "https://api.polygon.io/v2/reference/news",
        "api_key": os.environ.get("POLYGON_KEY", ""),
    },
    "alphavantage": {
        "enabled": True,
        "weight": 3,
        "max_items": 15,
        "timeout": 15,
        "api_url": "https://www.alphavantage.co/query",
        "api_key": os.environ.get("ALPHAVANTAGE_KEY", ""),
        "topics": ["blockchain", "financial_markets", "earnings"],
    },
    "rss": {
        "enabled": True,
        "weight": 1,
        "max_items": 15,
        "timeout": 15,
    },
    "cn_sina": {
        "enabled": True,
        "weight": 6,
        "max_items": 25,
        "timeout": 15,
        "api_url": "https://feed.sina.com.cn/api/roll/get",
        "pageid": 153,
        "lid": 2516,
    },
    "cn_rss": {
        "enabled": True,
        "weight": 5,
        "max_items": 18,
        "timeout": 15,
    },
    "llm_fallback": {
        "enabled": True,
        "weight": 0,
    },
}

FLASH_CONCURRENCY = int(os.environ.get("FLASH_CONCURRENCY", "6"))
FLASH_TRANSLATE_BATCH = int(os.environ.get("FLASH_TRANSLATE_BATCH", "1"))
# WebSocket 缓冲单次消费条数（需配合 pipeline.daemon.finnhub_ws_flash）
FLASH_WS_DRAIN_MAX = int(os.environ.get("FLASH_WS_DRAIN_MAX", "25"))

# 文章 Pipeline：选题并行分类数、LLM 并行度（写作/SEO）
PIPELINE_COLLECT_WORKERS = int(os.environ.get("PIPELINE_COLLECT_WORKERS", "4"))
PIPELINE_LLM_WORKERS = int(os.environ.get("PIPELINE_LLM_WORKERS", "4"))

# ── 站点配置 ──
SITE_NAME = "YayaNews"
SITE_URL = "https://yayanews.cryptooptiontool.com"
TRADING_SITE = os.environ.get("TRADING_SITE", "https://invest.biyapay.com")
