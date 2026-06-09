"""LLM 调用封装，兼容 OpenAI API 格式。支持主备双线路路由与自动兜底。"""
import inspect
import json
import time
from openai import OpenAI
from pipeline.config.settings import (
    LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_REASONER_MODEL,
    LLM_FALLBACK_BASE_URL, LLM_FALLBACK_API_KEY, LLM_FALLBACK_MODEL,
    EMBEDDING_API_KEY, EMBEDDING_BASE_URL, EMBEDDING_MODEL,
)
from pipeline.utils.logger import get_logger

log = get_logger("llm")

_primary_client = None
_fallback_client = None
_embedding_client = None
_embedding_skip_logged = False
_embedding_disabled_reason = None


def _caller_name() -> str:
    for frame in inspect.stack()[2:8]:
        module = inspect.getmodule(frame.frame)
        name = module.__name__ if module else ""
        if name and name != __name__:
            return f"{name}.{frame.function}"
    return "unknown"


def _usage_value(usage, key: str) -> int | None:
    if usage is None:
        return None
    if isinstance(usage, dict):
        return usage.get(key)
    return getattr(usage, key, None)


def _record_usage(
    *,
    caller: str,
    route: str,
    model: str,
    status: str,
    response=None,
    system_prompt: str = "",
    user_prompt: str = "",
    result: str = "",
    max_tokens: int | None = None,
    temperature: float | None = None,
    latency_ms: int | None = None,
    error: Exception | None = None,
) -> None:
    try:
        usage = getattr(response, "usage", None) if response is not None else None
        from pipeline.utils.database import insert_llm_usage

        insert_llm_usage(
            caller=caller,
            route=route,
            model=model,
            status=status,
            prompt_tokens=_usage_value(usage, "prompt_tokens"),
            completion_tokens=_usage_value(usage, "completion_tokens"),
            total_tokens=_usage_value(usage, "total_tokens"),
            prompt_chars=len(system_prompt) + len(user_prompt),
            completion_chars=len(result or ""),
            max_tokens=max_tokens,
            temperature=temperature,
            latency_ms=latency_ms,
            error_type=type(error).__name__ if error else "",
            error_message=str(error) if error else "",
        )
    except Exception as record_error:
        log.debug(f"LLM usage record skipped: {record_error}")


def _get_primary() -> OpenAI:
    global _primary_client
    if _primary_client is None:
        _primary_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY, timeout=120.0, max_retries=2)
        log.info(f"LLM primary client initialized: base={LLM_BASE_URL}, model={LLM_MODEL}")
    return _primary_client


def _get_fallback() -> OpenAI | None:
    global _fallback_client
    if not LLM_FALLBACK_API_KEY:
        return None
    if _fallback_client is None:
        _fallback_client = OpenAI(base_url=LLM_FALLBACK_BASE_URL, api_key=LLM_FALLBACK_API_KEY, timeout=120.0, max_retries=3)
        log.info(f"LLM fallback client initialized: base={LLM_FALLBACK_BASE_URL}, model={LLM_FALLBACK_MODEL}")
    return _fallback_client


def get_client() -> OpenAI:
    """向后兼容：返回主线路客户端。"""
    return _get_primary()


def _get_embedding_client() -> OpenAI | None:
    global _embedding_client, _embedding_skip_logged
    if not EMBEDDING_API_KEY:
        if not _embedding_skip_logged:
            log.info("Embedding skipped: EMBEDDING_API_KEY/OPENAI_API_KEY is not configured")
            _embedding_skip_logged = True
        return None
    if _embedding_client is None:
        _embedding_client = OpenAI(
            base_url=EMBEDDING_BASE_URL,
            api_key=EMBEDDING_API_KEY,
            timeout=60.0,
            max_retries=1,
        )
        log.info(f"Embedding client initialized: base={EMBEDDING_BASE_URL}, model={EMBEDDING_MODEL}")
    return _embedding_client


def chat(
    system_prompt: str,
    user_prompt: str,
    model: str = "",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """发送一次 LLM 对话。主线路优先，失败自动切换兜底线路。"""
    model = model or LLM_MODEL
    caller = _caller_name()
    primary_error = None

    # ── 1. 尝试主线路 ──
    try:
        client = _get_primary()
        log.debug(f"LLM [primary] request: model={model}, prompt_len={len(user_prompt)}")
        t0 = time.monotonic()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        result = response.choices[0].message.content.strip()
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        _record_usage(
            caller=caller,
            route="primary",
            model=model,
            status="ok",
            response=response,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            result=result,
            max_tokens=max_tokens,
            temperature=temperature,
            latency_ms=elapsed_ms,
        )
        log.info(f"LLM [primary] OK: model={model}, len={len(result)}, {elapsed_ms/1000:.1f}s")
        return result
    except Exception as e:
        primary_error = e
        _record_usage(
            caller=caller,
            route="primary",
            model=model,
            status="error",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            error=e,
        )
        log.warning(f"LLM [primary] failed ({type(e).__name__}: {e}), trying fallback...")

    # ── 2. 兜底线路 ──
    fallback = _get_fallback()
    if fallback is None:
        raise RuntimeError(f"LLM primary failed and no fallback configured: {primary_error}")

    fallback_model = LLM_FALLBACK_MODEL or model
    log.debug(f"LLM [fallback] request: model={fallback_model}, prompt_len={len(user_prompt)}")
    t0 = time.monotonic()
    try:
        response = fallback.chat.completions.create(
            model=fallback_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as e:
        _record_usage(
            caller=caller,
            route="fallback",
            model=fallback_model,
            status="error",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            latency_ms=int((time.monotonic() - t0) * 1000),
            error=e,
        )
        raise

    result = response.choices[0].message.content.strip()
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    _record_usage(
        caller=caller,
        route="fallback",
        model=fallback_model,
        status="ok",
        response=response,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        result=result,
        max_tokens=max_tokens,
        temperature=temperature,
        latency_ms=elapsed_ms,
    )
    log.info(f"LLM [fallback] OK: model={fallback_model}, len={len(result)}, {elapsed_ms/1000:.1f}s")
    return result


def batch_translate(items: list[dict], batch_size: int = 8) -> list[dict]:
    """批量将英文快讯转化为中文快讯。

    英→中跨语言天然去重，无需相似度检查。
    Prompt 精简以最大化速度，同时保持中文新闻风格（非逐字翻译）。
    """
    if not items:
        return items

    results = []
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        numbered = []
        for idx, item in enumerate(batch, 1):
            numbered.append(f"{idx}. {item['title']}\n{item['content'][:200]}")

        prompt = (
            f"将以下 {len(batch)} 条英文金融快讯翻译成中文，并严格按以下要求输出：\n"
            "1. 【极度重要】你的回复必须是一个纯净且合法的 JSON 数组，不要在开头或结尾添加任何说明性文字，绝对不能使用 Markdown 代码块包裹（即不要出现 ```json）。\n"
            "2. 【极度重要】必须确保 JSON 值内部出现的所有西文双引号都被正确转义（使用 \\\"）。\n"
            "3. 标题在 25 字以内，必须突出关键数据；内容在 50-100 字左右，保留原文中的具体数字、货币单位和股票/代币代码。\n"
            "格式示例：[{\"title\":\"...\",\"content\":\"...\"}, ...]\n\n"
            "待翻译快讯内容如下：\n"
            + "\n".join(numbered)
        )

        try:
            raw = chat("金融快讯编辑。只输出JSON。", prompt, temperature=0.3, max_tokens=2500)
            start, end = raw.find("["), raw.rfind("]") + 1
            if start >= 0 and end > start:
                translated = json.loads(raw[start:end])
                for idx, item in enumerate(batch):
                    if idx < len(translated):
                        t = translated[idx]
                        item["title"] = t.get("title", item["title"])
                        item["content"] = t.get("content", item["content"])
                log.info(f"Batch translate OK: {len(batch)} items")
            else:
                log.warning("Batch translate: no JSON array in response")
        except Exception as e:
            log.warning(f"Batch translate failed, keeping originals: {e}")

        results.extend(batch)

    return results


def get_embedding(text: str, model: str = "") -> list[float]:
    """请求大模型的文本嵌入接口向量化内容，以备写入 pgvector"""
    global _embedding_disabled_reason
    if not text:
        return None
    if _embedding_disabled_reason:
        return None
    client = _get_embedding_client()
    if client is None:
        return None
    model = model or EMBEDDING_MODEL
    try:
        res = client.embeddings.create(input=[text], model=model)
        return res.data[0].embedding
    except Exception as e:
        status_code = getattr(e, "status_code", None)
        if status_code in (400, 404):
            _embedding_disabled_reason = f"{type(e).__name__}: {e}"
            log.warning(f"Embedding disabled after provider rejected request: {_embedding_disabled_reason}")
        else:
            log.warning(f"Embedding failed: {e}")
        return None

def compute_similarity(text_a: str, text_b: str) -> float:
    """基于字符级 n-gram 的 Jaccard 相似度。
    返回 0.0~1.0，越高越相似。用于重复率门控，无需外部依赖。
    """
    if not text_a or not text_b:
        return 0.0
    n = 3
    def ngrams(text: str) -> set[str]:
        text = text.lower().strip()
        return {text[i:i+n] for i in range(len(text) - n + 1)} if len(text) >= n else {text}
    a, b = ngrams(text_a), ngrams(text_b)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)
