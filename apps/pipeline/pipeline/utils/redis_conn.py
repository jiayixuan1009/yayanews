"""
统一 Redis 连接工厂：解析 REDIS_URL 环境变量（含密码/主机/端口），
供 daemon、worker、tasks 等所有模块使用，避免散落硬编码。

支持格式：
  redis://:password@host:port
  redis://host:port
  
回退：REDIS_HOST + REDIS_PORT + REDIS_PASSWORD 环境变量
"""
import os
from redis import Redis
from urllib.parse import urlparse


def get_redis_connection(db: int = 0) -> Redis:
    """根据环境变量创建 Redis 连接（自动解析 REDIS_URL 或回退到分离变量）。"""
    redis_url = os.environ.get("REDIS_URL")

    if redis_url:
        parsed = urlparse(redis_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        password = parsed.password or None
        return Redis(host=host, port=port, password=password, db=db)

    # Fallback: individual env vars
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", "6379"))
    password = os.environ.get("REDIS_PASSWORD") or None
    return Redis(host=host, port=port, password=password, db=db)
