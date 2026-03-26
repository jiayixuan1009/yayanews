"""统一日志模块，每步输出便于调试。"""
import io
import logging
import os
import sys
from datetime import datetime

if sys.platform == "win32" and not isinstance(sys.stdout, io.TextIOWrapper):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)
        fmt = logging.Formatter(
            f"[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)
    return logger


def step_print(step: str, msg: str):
    """醒目地打印流水线步骤信息。"""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"  [{ts}] STEP: {step}")
    print(f"  {msg}")
    print(f"{'='*60}\n")
