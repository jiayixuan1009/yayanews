"""
Deepseek 模型配置，按渠道分配模型。

Deepseek API 兼容 OpenAI 格式，当前统一使用 deepseek-chat 模型。

用法：
  from pipeline.llm_config import get_model_for_channel, DEEPSEEK_MODEL_STANDARD
  model = get_model_for_channel("highspeed")  # -> "deepseek-chat"
  model = get_model_for_channel("default")   # -> "deepseek-chat"
"""
from __future__ import annotations

import os

# Deepseek 模型
DEEPSEEK_MODEL_STANDARD = "deepseek-chat"       # DeepSeek-V3，通用对话
DEEPSEEK_MODEL_REASONER = "deepseek-reasoner"    # DeepSeek-R1，深度推理（备用）

# 保留向后兼容的别名
MINIMAX_MODEL_STANDARD = DEEPSEEK_MODEL_STANDARD
MINIMAX_MODEL_HIGHSPEED = DEEPSEEK_MODEL_STANDARD

# 渠道 -> 模型：按任务特性分配
# - highspeed/fast/realtime: 快讯翻译、选题等速度优先场景 → chat
# - quality: 深度研报，需要分析推理能力 → reasoner
# - 其余: 标准文章、SEO 等 → chat
CHANNEL_TO_MODEL = {
    "highspeed": DEEPSEEK_MODEL_STANDARD,
    "fast": DEEPSEEK_MODEL_STANDARD,
    "realtime": DEEPSEEK_MODEL_STANDARD,
    "default": DEEPSEEK_MODEL_STANDARD,
    "quality": DEEPSEEK_MODEL_REASONER,     # 深度研报专用
    "standard": DEEPSEEK_MODEL_STANDARD,
    "": DEEPSEEK_MODEL_STANDARD,
}


def get_model_for_channel(channel: str | None = None) -> str:
    """根据渠道返回 Deepseek 模型名。当前所有渠道统一使用 deepseek-chat。"""
    key = (channel or "").strip().lower()
    return CHANNEL_TO_MODEL.get(key, DEEPSEEK_MODEL_STANDARD)


def get_model_from_env() -> str:
    """从环境变量 LLM_CHANNEL 读取渠道并返回对应模型；未设则用 default。"""
    channel = os.environ.get("LLM_CHANNEL", "default")
    return get_model_for_channel(channel)
