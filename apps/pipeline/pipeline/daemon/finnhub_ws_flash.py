"""
Finnhub WebSocket 新闻订阅守护进程（降低轮询延迟）。

用法（需 FINNHUB_KEY）：
  python -m pipeline.daemon.finnhub_ws_flash

订阅多标的实时新闻，写入 data/ws_flash_queue.jsonl，由 collect_flash 批量翻译入库。
"""
import json
import signal
import sys
import time

try:
    import websocket
except ImportError:
    print("请安装: pip install websocket-client", file=sys.stderr)
    sys.exit(1)

from pipeline.config.settings import FLASH_CHANNELS
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
    log.warning(f"WS error: {err}")


def _on_close(ws, code, msg):
    log.info(f"WS closed: {code} {msg}")


def _on_open(ws):
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
    global _running
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

    url = f"wss://ws.finnhub.io?token={token}"
    while _running:
        try:
            ws = websocket.WebSocketApp(
                url,
                on_message=_on_message,
                on_error=_on_error,
                on_close=_on_close,
                on_open=_on_open,
            )
            ws.run_forever(ping_interval=30, ping_timeout=10)
        except Exception as e:
            log.error(f"run_forever: {e}")
        if _running:
            log.info("5s 后重连...")
            time.sleep(5)
    log.info("退出")


if __name__ == "__main__":
    main()
