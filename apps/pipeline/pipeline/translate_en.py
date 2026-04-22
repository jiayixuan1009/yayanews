"""
一次性补齐英文长文：调用 Agent 6，将尚无英文子稿的中文已发布长文翻译入库。

用法（在 monorepo 根目录）:
  cd apps/pipeline && python -m pipeline.translate_en
  cd apps/pipeline && python -m pipeline.translate_en --until-done

或根目录:
  npm run pipeline:translate-en
  npm run pipeline:translate-en:all

依赖: 根目录 .env 中 DATABASE_URL、LLM_API_KEY（及 LLM_BASE_URL 等）已配置。
"""
from __future__ import annotations

import argparse
import os

from pipeline.agents.agent6_translator import _get_translation_candidates, translate_queue


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill English articles (Agent 6)")
    ap.add_argument(
        "--batch",
        type=int,
        default=int(os.environ.get("TRANSLATE_EN_BATCH", "5")),
        help="每批最多处理篇数（默认 5，可用环境变量 TRANSLATE_EN_BATCH）",
    )
    ap.add_argument(
        "--until-done",
        action="store_true",
        help="按批循环直至无待译中文长文；若某批全部失败则退出码 1",
    )
    ap.add_argument(
        "--max-batches",
        type=int,
        default=int(os.environ.get("TRANSLATE_EN_MAX_BATCHES", "100")),
        help="与 --until-done 合用时的最大批次数（防止异常死循环）",
    )
    args = ap.parse_args()
    n = max(1, min(args.batch, 50))

    if not args.until_done:
        translate_queue(batch_size=n, force=True)
        return

    total_ok = 0
    batch_idx = 0
    while batch_idx < args.max_batches:
        batch_idx += 1
        print(f"\n{'='*60}\n>>> 第 {batch_idx} 批（每批最多 {n} 篇），已累计成功 {total_ok} 篇\n{'='*60}")

        out = translate_queue(batch_size=n, force=True)
        total_ok += len(out)

        rest = _get_translation_candidates(limit=1)
        if not rest:
            print(f"\n[translate_en] 全部完成：本进程累计成功入库 {total_ok} 篇（共跑 {batch_idx} 批）。")
            return

        if not out:
            print(
                "\n[translate_en] 仍有待译稿件，但本批无一成功（API/LLM 均失败或内容无效）。"
                "请检查日志与 LLM 配额后重试同一命令。"
            )
            raise SystemExit(1)

    print(
        f"\n[translate_en] 已达 --max-batches={args.max_batches} 上限，停止。"
        f"已成功约 {total_ok} 篇；可再次执行以继续。"
    )
    raise SystemExit(2)


if __name__ == "__main__":
    main()
