"""Finnhub WebSocket 快讯落地缓冲：守护进程写入 JSONL，collect_flash 批量消费。"""
import json
import os
import threading
from pathlib import Path

from pipeline.config.settings import PROJECT_ROOT

BUFFER_PATH = PROJECT_ROOT / "data" / "ws_flash_queue.jsonl"
_LOCK = threading.Lock()
_MAX_FILE_LINES = 5000


def _ensure_dir():
    BUFFER_PATH.parent.mkdir(parents=True, exist_ok=True)


def append_ws_item(item: dict) -> None:
    """写入一条待处理快讯（英文，需后续翻译）。"""
    _ensure_dir()
    line = json.dumps(item, ensure_ascii=False) + "\n"
    with _LOCK:
        with open(BUFFER_PATH, "a", encoding="utf-8") as f:
            f.write(line)
        try:
            with open(BUFFER_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            if len(lines) > _MAX_FILE_LINES:
                with open(BUFFER_PATH, "w", encoding="utf-8") as f:
                    f.writelines(lines[-_MAX_FILE_LINES:])
        except OSError:
            pass


def drain_ws_buffer(max_items: int = 30) -> list[dict]:
    """原子读出最多 max_items 条并清空已读部分（保留未读）。"""
    _ensure_dir()
    if not BUFFER_PATH.is_file():
        return []
    with _LOCK:
        try:
            with open(BUFFER_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except OSError:
            return []
        if not lines:
            return []
        take = lines[:max_items]
        rest = lines[max_items:]
        items = []
        for line in take:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        try:
            with open(BUFFER_PATH, "w", encoding="utf-8") as f:
                f.writelines(rest)
        except OSError:
            pass
        return items
