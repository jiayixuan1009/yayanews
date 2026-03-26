"""
YayaNews 内容生产 Pipeline 主调度器

用法：
  python -m pipeline.run                    # 默认生产 10 篇文章 + 10 条快讯
  python -m pipeline.run --articles 20      # 生产 20 篇文章
  python -m pipeline.run --flash-only       # 仅生产快讯
  python -m pipeline.run --articles-only    # 仅生产文章
"""
import argparse
import io
import os
import sys
import threading
import time
from datetime import datetime

if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from pipeline.agents.agent1_collector import collect
from pipeline.agents.agent2_writer import generate
from pipeline.agents.agent3_reviewer import review
from pipeline.agents.agent4_seo import optimize
from pipeline.agents.agent5_publisher import publish
from pipeline.agents.flash_collector import collect_flash
from pipeline.agents.agent6_translator import translate_queue
from pipeline.utils.database import insert_pipeline_run, now_cn
from pipeline.utils.logger import step_print
from pipeline.tools.speed_benchmark import run_for_article


def run_article_pipeline(batch_size: int = 10):
    """运行文章生产流水线：采集 → 生成 → 审核 → SEO → 发布。"""
    started_at = now_cn()
    start = time.time()
    stage_timings = {}
    step_print("文章 Pipeline 启动", f"批次大小: {batch_size}")

    # Step 1: 选题采集
    t = time.time()
    topics = collect(batch_size=batch_size)
    stage_timings["collect"] = round(time.time() - t, 2)
    if not topics:
        print("\n[Pipeline] 无选题可用，跳过文章生产。")
        return []

    # Step 2: 内容生成
    t = time.time()
    drafts = generate(topics)
    stage_timings["generate"] = round(time.time() - t, 2)
    if not drafts:
        print("\n[Pipeline] 无草稿生成，流水线终止。")
        return []

    # Step 3: 质量审核
    t = time.time()
    reviewed = review(drafts)
    stage_timings["review"] = round(time.time() - t, 2)
    if not reviewed:
        print("\n[Pipeline] 所有草稿未通过审核。")
        return []

    # Step 4: SEO 优化
    t = time.time()
    optimized = optimize(reviewed)
    stage_timings["seo"] = round(time.time() - t, 2)
    if not optimized:
        print("\n[Pipeline] SEO 优化失败。")
        return []

    # Step 5: 入库发布
    t = time.time()
    published = publish(optimized)
    stage_timings["publish"] = round(time.time() - t, 2)

    elapsed = time.time() - start
    stage_timings["total"] = round(elapsed, 2)
    step_print("文章 Pipeline 完成", f"发布 {len(published)} 篇，耗时 {elapsed:.1f}s")

    insert_pipeline_run(
        run_type="article",
        started_at=started_at,
        finished_at=now_cn(),
        total_seconds=elapsed,
        items_requested=batch_size,
        items_produced=len(published),
        stage_timings=stage_timings,
    )

    # 后台线程跑时效对比，不阻塞 Pipeline、不阻塞主线程
    def _bench_bg():
        import time as _t
        for art in published:
            aid = art.get("article_id") or art.get("id")
            if aid and aid > 0:
                try:
                    run_for_article(aid)
                except Exception as e:
                    print(f"  [Benchmark] Article {aid} failed: {e}")
                _t.sleep(2)

    if published:
        threading.Thread(target=_bench_bg, daemon=True).start()

    return published


def run_flash_pipeline(count: int = 10):
    """运行快讯生产流水线。"""
    started_at = now_cn()
    start = time.time()
    result = collect_flash(count=count)
    elapsed = time.time() - start

    produced = result.get("count", 0) if isinstance(result, dict) else len(result)
    stage_t = result.get("stage_timings", {}) if isinstance(result, dict) else {}
    channel_t = result.get("channel_timings", {}) if isinstance(result, dict) else {}
    err_cnt = result.get("error_count", 0) if isinstance(result, dict) else 0

    step_print("快讯 Pipeline 完成", f"入库 {produced} 条，耗时 {elapsed:.1f}s")

    insert_pipeline_run(
        run_type="flash",
        started_at=started_at,
        finished_at=now_cn(),
        total_seconds=elapsed,
        items_requested=count,
        items_produced=produced,
        stage_timings=stage_t,
        channel_timings=channel_t,
        error_count=err_cnt,
    )

    return result


def main():
    parser = argparse.ArgumentParser(description="YayaNews Content Pipeline")
    parser.add_argument("--articles", type=int, default=10, help="文章数量")
    parser.add_argument("--flash", type=int, default=10, help="快讯数量")
    parser.add_argument("--articles-only", action="store_true", help="仅生产文章")
    parser.add_argument("--flash-only", action="store_true", help="仅生产快讯")
    args = parser.parse_args()

    print(f"\n{'#'*60}")
    print(f"  YayaNews Content Pipeline")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*60}\n")

    total_start = time.time()
    articles = []
    flash = []

    if not args.flash_only:
        articles = run_article_pipeline(batch_size=args.articles)
        if articles:
            print(f"\n{'#'*30}\n  启动 Agent 6 英文转译子流\n{'#'*30}")
            translations = translate_queue(batch_size=len(articles))

    if not args.articles_only:
        flash = run_flash_pipeline(count=args.flash)

    total_elapsed = time.time() - total_start

    print(f"\n{'#'*60}")
    print(f"  Pipeline 总结")
    print(f"  文章: {len(articles)} 篇发布")
    print(f"  快讯: {len(flash)} 条入库")
    print(f"  总耗时: {total_elapsed:.1f}s")
    print(f"{'#'*60}\n")


if __name__ == "__main__":
    main()
