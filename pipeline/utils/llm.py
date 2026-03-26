"""LLM 调用封装，兼容 OpenAI API 格式。支持单次对话和批量翻译。"""
import json
from openai import OpenAI
from pipeline.config.settings import LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
from pipeline.utils.logger import get_logger

log = get_logger("llm")

_client = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
        log.info(f"LLM client initialized: base={LLM_BASE_URL}, model={LLM_MODEL}")
    return _client


def chat(
    system_prompt: str,
    user_prompt: str,
    model: str = "",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """发送一次 LLM 对话并返回文本结果。"""
    client = get_client()
    model = model or LLM_MODEL

    log.debug(f"LLM request: model={model}, prompt_len={len(user_prompt)}")

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
    log.debug(f"LLM response: len={len(result)}")
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
            f"将以下{len(batch)}条英文金融快讯写成中文。"
            "标题25字内突出关键数据，内容50-100字，保留数字和代码。\n"
            '[{"title":"...","content":"..."}, ...]\n\n'
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
