"""
MiniMax 2.7 模型配置，按渠道分配 MiniMax-M2.7 / MiniMax-M2.7-highspeed。

用法：
  from pipeline.llm_config import get_model_for_channel, MINIMAX_MODEL_STANDARD, MINIMAX_MODEL_HIGHSPEED
  model = get_model_for_channel("highspeed")  # -> "MiniMax-M2.7-highspeed"
  model = get_model_for_channel("default")   # -> "MiniMax-M2.7"
"""
from __future__ import annotations

import os

# MiniMax M2.7 系列（2026-03 发布）
MINIMAX_MODEL_STANDARD = "MiniMax-M2.7"           # 标准，约 60 tok/s
MINIMAX_MODEL_HIGHSPEED = "MiniMax-M2.7-highspeed"  # 高速，约 100 tok/s

# 渠道 -> 模型：需要低延迟的渠道用 highspeed，其余用 standard
CHANNEL_TO_MODEL = {
    "highspeed": MINIMAX_MODEL_HIGHSPEED,
    "fast": MINIMAX_MODEL_HIGHSPEED,
    "realtime": MINIMAX_MODEL_HIGHSPEED,
    "default": MINIMAX_MODEL_STANDARD,
    "quality": MINIMAX_MODEL_STANDARD,
    "standard": MINIMAX_MODEL_STANDARD,
    "": MINIMAX_MODEL_STANDARD,
}


def get_model_for_channel(channel: str | None = None) -> str:
    """根据渠道返回 MiniMax 2.7 模型名。未配置或未知渠道用 standard。"""
    key = (channel or "").strip().lower()
    return CHANNEL_TO_MODEL.get(key, MINIMAX_MODEL_STANDARD)


def get_model_from_env() -> str:
    """从环境变量 LLM_CHANNEL 读取渠道并返回对应模型；未设则用 default。"""
    channel = os.environ.get("LLM_CHANNEL", "default")
    return get_model_for_channel(channel)
