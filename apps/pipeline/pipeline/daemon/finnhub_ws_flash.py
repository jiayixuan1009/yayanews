"""
Finnhub WebSocket 新闻订阅守护进程（降低轮询延迟）。

用法（需 FINNHUB_KEY）：
  python -m pipeline.daemon.finnhub_ws_flash

订阅多标的实时新闻，写入 data/ws_flash_queue.jsonl，由 collect_flash 批量翻译入库。
"""
import json
import os
import random
import re
import signal
import sys
import time

try:
    import websocket
except ImportError:
    print("请安装: pip install websocket-client", file=sys.stderr)
    sys.exit(1)

from pipeline.config.settings import FLASH_CHANNELS, NEWS_SOURCE_READ_TIMEOUT_SECONDS
from pipeline.utils.ws_flash_buffer import append_ws_item
from pipeline.utils.database import insert_flash
from pipeline.utils.logger import get_logger

log = get_logger("finnhub_ws")

# 覆盖主要市场标的，获取更多新闻流
_WS_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META",
    "BTC", "ETH", "SPY", "QQQ", "GLD", "USO",
    "BINANCE:BTCUSDT", "BINANCE:ETHUSDT",
    "FOREX:EURUSD", "OANDA:XAU_USD",
]

_running = True
_rate_limited_until = 0.0
_opened_at = 0.0
_connection_opened = False

_MIN_RETRY_DELAY = max(1, int(os.environ.get("FINNHUB_WS_MIN_RETRY_SECONDS", "30")))
_MAX_RETRY_DELAY = max(_MIN_RETRY_DELAY, int(os.environ.get("FINNHUB_WS_MAX_RETRY_SECONDS", "3600")))
_STABLE_CONNECTION_SECONDS = max(
    _MIN_RETRY_DELAY,
    int(os.environ.get("FINNHUB_WS_STABLE_CONNECTION_SECONDS", "60")),
)
_SHORT_CONNECTION_RETRY_SECONDS = max(
    _MIN_RETRY_DELAY,
    int(os.environ.get("FINNHUB_WS_SHORT_CONNECTION_RETRY_SECONDS", "35")),
)
_RATE_LIMIT_FALLBACK_DELAY = max(
    _MIN_RETRY_DELAY,
    int(os.environ.get("FINNHUB_WS_RATE_LIMIT_RETRY_SECONDS", "600")),
)
_RATE_LIMIT_RESET_SKEW_SECONDS = max(
    0,
    int(os.environ.get("FINNHUB_WS_RATE_LIMIT_RESET_SKEW_SECONDS", "5")),
)
_retry_delay = float(_MIN_RETRY_DELAY)
_WS_HANDSHAKE_TIMEOUT_SECONDS = max(
    1,
    int(os.environ.get("FINNHUB_WS_HANDSHAKE_TIMEOUT_SECONDS", str(int(NEWS_SOURCE_READ_TIMEOUT_SECONDS)))),
)
_PING_INTERVAL_SECONDS = max(1, int(os.environ.get("FINNHUB_WS_PING_INTERVAL_SECONDS", "35")))
_PING_TIMEOUT_SECONDS = max(1, int(os.environ.get("FINNHUB_WS_PING_TIMEOUT_SECONDS", "30")))
if _PING_INTERVAL_SECONDS <= _PING_TIMEOUT_SECONDS:
    _PING_INTERVAL_SECONDS = _PING_TIMEOUT_SECONDS + 1


def _extract_rate_limit_reset(err):
    message = str(err)
    patterns = [
        r"['\"]x-ratelimit-reset['\"]\s*:\s*['\"]?(\d+)['\"]?",
        r"\bx-ratelimit-reset\b\s*[:=]\s*['\"]?(\d+)['\"]?",
    ]
    match = None
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            break
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _remember_rate_limit(err):
    global _rate_limited_until
    message = str(err)
    if "429" not in message and "too many requests" not in message.lower():
        return None

    now = time.time()
    reset_at = _extract_rate_limit_reset(err)
    if reset_at and reset_at > now:
        wait_seconds = min(
            _MAX_RETRY_DELAY,
            max(_MIN_RETRY_DELAY, int(reset_at - now) + _RATE_LIMIT_RESET_SKEW_SECONDS),
        )
    else:
        wait_seconds = min(_MAX_RETRY_DELAY, _RATE_LIMIT_FALLBACK_DELAY)
    _rate_limited_until = max(_rate_limited_until, now + wait_seconds)
    return wait_seconds


def _format_retry_time(epoch_seconds: float) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S %z", time.localtime(epoch_seconds))


def _next_retry_seconds():
    global _retry_delay
    now = time.time()
    if _rate_limited_until > now:
        return min(_MAX_RETRY_DELAY, max(_MIN_RETRY_DELAY, _rate_limited_until - now))

    if _connection_opened and _opened_at and now - _opened_at < _STABLE_CONNECTION_SECONDS:
        return min(_MAX_RETRY_DELAY, _SHORT_CONNECTION_RETRY_SECONDS)

    delay = _retry_delay
    _retry_delay = min(_MAX_RETRY_DELAY, max(_MIN_RETRY_DELAY, _retry_delay * 2))
    return delay + random.uniform(0, min(3.0, delay * 0.2))


def _on_message(ws, message):
    try:
        data = json.loads(message)
    except json.JSONDecodeError:
        return
    if data.get("type") != "news":
        return
    arr = data.get("data") or []
    if not isinstance(arr, list):
        return
    for n in arr:
        if not isinstance(n, dict):
            continue
        title = (n.get("headline") or "").strip()
        if not title:
            continue
        
        content = (n.get("summary") or title)[:400]
        source = f"Finnhub/{n.get('source', '')}"
        source_url = n.get("url") or ""
        
        # 1. 直接插入实时数据库，供英文界面瞬间消费（语言设为 en）
        insert_flash(
            title=title,
            content=content,
            category_id=2,  # 默认 Crypto，或者其他逻辑分类
            importance="normal",
            source=source,
            source_url=source_url,
            lang="en"
        )
        
        # 2. 写入 JSONL 缓冲序列，供 60 秒一次的 Pipeline 批量机翻成中文入库
        append_ws_item({
            "title": title,
            "content": content,
            "raw_text": f"{title} {n.get('summary', '')}",
            "source": source,
            "source_url": source_url,
            "lang": "en",
            "channel": "finnhub_ws",
        })


def _on_error(ws, err):
    wait_seconds = _remember_rate_limit(err)
    if wait_seconds is not None:
        log.warning(
            "WS rate limited; cooling down for "
            f"{wait_seconds:.0f}s until {_format_retry_time(_rate_limited_until)}: {err}"
        )
        return
    log.warning(f"WS error: {err}")


def _on_close(ws, code, msg):
    log.info(f"WS closed: {code} {msg}")


def _on_open(ws):
    global _connection_opened, _opened_at
    _connection_opened = True
    _opened_at = time.time()
    log.info("WS connected, subscribing news symbols...")
    # Finnhub: {"type":"subscribe","news":["AAPL","MSFT",...]}
    chunk = 8
    for i in range(0, len(_WS_SYMBOLS), chunk):
        part = _WS_SYMBOLS[i : i + chunk]
        try:
            ws.send(json.dumps({"type": "subscribe", "news": part}))
        except Exception as e:
            log.warning(f"subscribe chunk {i}: {e}")
        time.sleep(0.15)


def main():
    global _connection_opened, _opened_at, _retry_delay, _running
    ch = FLASH_CHANNELS.get("finnhub", {})
    token = ch.get("api_key") or ""
    if not token:
        log.error("未设置 FINNHUB_KEY，无法启动 WebSocket 守护进程")
        sys.exit(1)

    def stop(*_):
        global _running
        _running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    websocket.setdefaulttimeout(_WS_HANDSHAKE_TIMEOUT_SECONDS)
    url = f"wss://ws.finnhub.io?token={token}"
    while _running:
        _connection_opened = False
        _opened_at = 0.0
        try:
            ws = websocket.WebSocketApp(
                url,
                on_message=_on_message,
                on_error=_on_error,
                on_close=_on_close,
                on_open=_on_open,
            )
            ws.run_forever(
                ping_interval=_PING_INTERVAL_SECONDS,
                ping_timeout=_PING_TIMEOUT_SECONDS,
                http_proxy_timeout=_WS_HANDSHAKE_TIMEOUT_SECONDS,
            )
            if _connection_opened and time.time() - _opened_at >= _STABLE_CONNECTION_SECONDS:
                _retry_delay = float(_MIN_RETRY_DELAY)
        except Exception as e:
            log.error(f"run_forever: {e}")
        if _running:
            delay = _next_retry_seconds()
            log.info(f"Retrying Finnhub WS in {delay:.0f}s")
            time.sleep(delay)
    log.info("退出")


if __name__ == "__main__":
    main()
