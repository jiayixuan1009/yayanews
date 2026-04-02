import json
from pipeline.utils.llm import chat
from pipeline.utils.logger import get_logger

log = get_logger("normalizer")

SYSTEM_PROMPT = """你是一个用于生产环境的加密新闻快讯标准化引擎（news normalization engine），负责处理中英混合的快讯流。

你的任务是：对输入的 news_list 进行语言统一、翻译、跨语言语义去重，并输出可直接用于前端展示的结果。

====================
【输入】
你会收到一个 JSON：
{
  "target_lang": "zh" 或 "en",
  "news_list": [...]
}

====================
【处理逻辑】
一、文本提取
每条新闻优先取以下字段作为正文：1. content, 2. summary, 3. title。取第一个非空字段作为 raw_text。

二、语言识别
判断 raw_text 的原始语言："zh" 或 "en"

三、统一语言（必须执行）
如果 target_lang = "zh"：中文保持不变，英文翻译成中文
如果 target_lang = "en"：英文保持不变，中文翻译成英文

翻译要求：
- 使用新闻快讯风格（简洁、直接）
- 保留项目名、币名、机构名、链名、协议名
- 保留数字、金额、百分比、时间
- 不添加解释，不扩写内容，不省略关键信息
- 尽量压缩为一句话

四、语义去重（核心步骤）
⚠️ 必须基于 normalized_text（统一语言后）进行去重
判定为重复的情况：描述同一事件；主体相同 + 动作相同；关键对象相同；数字金额时间一致。即使中英文不同也算重复。
例如：Binance launches new feature 与 币安推出新功能 -> 必须去重。

去重策略：
1. 保留信息更完整的一条
2. 若接近，保留发布时间更新的一条
3. 若仍接近，保留更简洁清晰的一条
4. 删除其他重复项

五、排序
若存在 published_at：按时间排序，否则保持原顺序

====================
【输出格式】
只输出 JSON 数组，不要输出解释、markdown 或额外文本：
[
  {
    "id": "<原内部idx>",
    "title": "<一句话极简标题>",
    "content": "<统一语言后的最终完整快讯>",
    "source_lang": "zh 或 en",
    "final_lang": "zh 或 en",
    "published_at": "<可选>",
    "source": "<可选>",
    "url": "<可选>",
    "channel": "<原通道透传>"
  }
]

====================
【强制约束】
1. 输出中只允许出现 target_lang 对应语言（中文页面无英文，英文页面无中文）。
2. 去重必须在翻译执行后。
3. 必须删除重复内容。
4. 不输出 null 字段，不输出解释、思考，不要用 markdown，严禁回答 "OK" 或 ```json 等包装。
5. 必须保持原有原内部idx和channel等需要透传的话直接融在返回里。必须输出title和content两项！
"""

def normalize_flash_batch(items: list[dict], target_lang: str) -> list[dict]:
    """使用大模型对一批快讯做翻译+去重。"""
    if not items:
        return []

    # 构造极简的输入集以节省Token，并保留内部排序索引
    input_list = []
    for idx, it in enumerate(items):
        input_list.append({
            "_internal_idx": idx, # 用于事后映射原属性 (如果需要)
            "title": it.get("title", ""),
            "content": it.get("content", ""),
            "summary": it.get("summary", ""),
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
            max_tokens=4000
        )
        
        # 解析 JSON 防御
        start_idx = raw_response.find("[")
        end_idx = raw_response.rfind("]")
        if start_idx == -1 or end_idx == -1:
            log.error(f"Normalizer failed to output JSON array for {target_lang}")
            return []
            
        json_str = raw_response[start_idx:end_idx+1]
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
