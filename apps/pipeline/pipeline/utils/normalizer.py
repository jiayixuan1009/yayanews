import json
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger

log = get_logger("normalizer")

SYSTEM_PROMPT = """快讯标准化引擎。对输入的多条中英文金融快讯执行：翻译→去重→输出。

【输入】{"target_lang":"zh"或"en", "news_list":[...]}

【规则】
1. 全部翻译为 target_lang（中文→英文 或 英文→中文），新闻简报风，保留数字/币名/机构名
2. 翻译后做语义去重：同一事件只保留信息最完整的一条
3. 标题≤25字，content 50-100字
4. 跳过非金融内容

【输出】只输出JSON数组，无markdown无解释：
[{"id":"原idx","title":"极简标题","content":"完整快讯","source_lang":"zh/en","final_lang":"zh/en","channel":"原通道","source":"原source","url":"原url"}]"""

def normalize_flash_batch(items: list[dict], target_lang: str) -> list[dict]:
    """使用大模型对一批快讯做翻译+去重。"""
    if not items:
        return []

    # 构造极简的输入集以节省Token，并保留内部排序索引
    # 注意：不传 summary，避免 LLM 输出膨胀导致超 max_tokens 被截断
    input_list = []
    for idx, it in enumerate(items):
        input_list.append({
            "_internal_idx": idx,
            "title": it.get("title", ""),
            "content": it.get("content", ""),
            "channel": it.get("channel", "unknown"),
        })

    user_payload = {
        "target_lang": target_lang,
        "news_list": input_list
    }

    user_prompt = json.dumps(user_payload, ensure_ascii=False)
    
    try:
        raw_response = chat(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.1,  # 低温，严谨风格
            max_tokens=8192
        )
        
        # 解析 JSON 防御
        start_idx = raw_response.find("[")
        end_idx = raw_response.rfind("]")
        if start_idx == -1:
            log.error(f"Normalizer failed to output JSON array for {target_lang}. Response preview: {repr(raw_response[:400])}")
            return []

        if end_idx == -1 or end_idx < start_idx:
            # 响应被 max_tokens 截断，无结尾 ]，尝试恢复已完成的条目
            log.warning(f"Normalizer response truncated for {target_lang} (no closing ]), attempting partial recovery")
            partial = raw_response[start_idx:]
            last_obj_end = partial.rfind("}")
            if last_obj_end == -1:
                log.error(f"Normalizer: no complete objects found for {target_lang}")
                return []
            # 拼上缺失的 ]，并去掉末尾可能残留的逗号
            candidate = partial[:last_obj_end + 1].rstrip().rstrip(",") + "]"
            try:
                results = json.loads(candidate)
                log.warning(f"Normalizer [{target_lang}]: partial recovery succeeded, got {len(results)} items")
            except json.JSONDecodeError as exc:
                log.error(f"Normalizer partial recovery failed for {target_lang}: {exc}")
                return []
        else:
            json_str = raw_response[start_idx:end_idx + 1]
            results = json.loads(json_str)

        final_items = []
        for r in results:
            if not r.get("content"):
                continue
            r["lang"] = target_lang
            final_items.append(r)

        log.info(f"Normalizer [{target_lang}]: {len(items)} in -> {len(final_items)} out")
        return final_items

    except Exception as e:
        log.error(f"Normalizer exception for lang '{target_lang}': {e}")
        return []
