"""统一日志模块，每步输出便于调试。

When `LOG_FORMAT=json` is set, stdout uses newline-delimited JSON matching
the schema emitted by `@yayanews/logger` (fields: `time`, `level`, `service`,
`env`, `logger`, `msg`, plus any `extra={...}` kwargs). This lets the
Python pipeline's T1–T3 stage timings and the Node services' T4–T5 broadcast
logs be correlated by a single downstream collector.
"""
import io
import json
import logging
import os
import sys
from datetime import datetime, timezone

if sys.platform == "win32" and not isinstance(sys.stdout, io.TextIOWrapper):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass


_STANDARD_LOGRECORD_ATTRS = {
    "args", "asctime", "created", "exc_info", "exc_text", "filename",
    "funcName", "levelname", "levelno", "lineno", "message", "module",
    "msecs", "msg", "name", "pathname", "process", "processName",
    "relativeCreated", "stack_info", "thread", "threadName", "taskName",
}


class JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line aligned with @yayanews/logger."""

    def __init__(self, service: str, env: str):
        super().__init__()
        self._service = service
        self._env = env

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "service": self._service,
            "env": self._env,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Preserve structured extras passed via `logger.info("msg", extra={"k": "v"})`.
        for key, value in record.__dict__.items():
            if key in _STANDARD_LOGRECORD_ATTRS or key.startswith("_"):
                continue
            try:
                json.dumps(value)  # ensure serializable
                payload[key] = value
            except TypeError:
                payload[key] = repr(value)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)

        use_json = os.getenv("LOG_FORMAT", "").lower() == "json"
        env = os.getenv("NODE_ENV") or os.getenv("PY_ENV") or "development"

        if use_json:
            fmt: logging.Formatter = JsonFormatter(service="pipeline", env=env)
        else:
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
