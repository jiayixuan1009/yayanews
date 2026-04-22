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
        
        fmt = logging.Formatter(
            f"[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(fmt)
        logger.addHandler(handler)
        
        try:
            from logging.handlers import RotatingFileHandler
            from pathlib import Path
            data_dir = Path("data")
            data_dir.mkdir(exist_ok=True)
            file_handler = RotatingFileHandler(
                "data/pipeline_run.log", maxBytes=1024 * 1024 * 5, backupCount=2, encoding="utf-8"
            )
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(fmt)
            logger.addHandler(file_handler)
        except Exception:
            pass
            
    return logger


def step_print(step: str, msg: str):
    """醒目地打印流水线步骤信息。"""
    ts = datetime.now().strftime("%H:%M:%S")
    out = (
        f"\n{'='*60}\n"
        f"  [{ts}] STEP: {step}\n"
        f"  {msg}\n"
        f"{'='*60}\n"
    )
    print(out, end="")
    try:
        from pathlib import Path
        with open("data/pipeline_run.log", "a", encoding="utf-8") as f:
            f.write(out)
    except Exception:
        pass
