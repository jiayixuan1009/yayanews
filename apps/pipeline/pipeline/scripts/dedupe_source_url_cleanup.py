"""
存量重复内容清理：同一信源 URL（按 source_url + lang 分组）只保留最早一篇，
其余文章 301 重定向到保留篇并下索引（is_indexable=false）。

用法（在 apps/pipeline 目录、已激活 venv、已导出 DATABASE_URL）：
    python -m pipeline.scripts.dedupe_source_url_cleanup            # dry-run，仅打印影响范围
    python -m pipeline.scripts.dedupe_source_url_cleanup --apply    # 实际执行

可逆性：仅设置 is_indexable=false 并写 article_slug_redirects，不删除数据；
如需回滚，将相关文章 is_indexable 置回 true 并删除对应重定向行即可。
"""
import argparse
import os
import sys
from collections import defaultdict

import psycopg2

NORM_URL_SQL = "regexp_replace(regexp_replace(lower(trim(source_url)), '[?#].*$', ''), '/+$', '')"


def fetch_groups(cur):
    cur.execute(
        f"""
        SELECT {NORM_URL_SQL} AS nurl,
               COALESCE(lang, 'zh') AS lang,
               source,
               id, slug, created_at, length(COALESCE(content, '')) AS clen
        FROM articles
        WHERE source_url IS NOT NULL AND source_url <> ''
          AND status = 'published'
          AND deleted_at IS NULL
          AND is_indexable = TRUE
        ORDER BY nurl, lang, created_at ASC, id ASC
        """
    )
    groups = defaultdict(list)
    for nurl, lang, source, aid, slug, created_at, clen in cur.fetchall():
        groups[(nurl, lang)].append(
            {"id": aid, "slug": slug, "created_at": created_at, "clen": clen, "source": source, "nurl": nurl}
        )
    return {k: v for k, v in groups.items() if len(v) > 1}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="实际执行（默认 dry-run）")
    parser.add_argument("--limit-print", type=int, default=20, help="dry-run 打印的最大分组数")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            groups = fetch_groups(cur)

            total_redundant = sum(len(v) - 1 for v in groups.values())
            by_source = defaultdict(int)
            for members in groups.values():
                for m in members[1:]:
                    by_source[m["source"]] += 1

            print(f"==== source_url 去重清理 ({'APPLY' if args.apply else 'DRY-RUN'}) ====")
            print(f"重复分组数 (source_url+lang, >1 篇): {len(groups)}")
            print(f"将保留 (canonical): {len(groups)} 篇")
            print(f"将下索引并 301 (redundant): {total_redundant} 篇")
            print("按来源统计 redundant：")
            for src, cnt in sorted(by_source.items(), key=lambda x: -x[1]):
                print(f"  {src or '(空)'}: {cnt}")

            print(f"\n影响最大的前 {args.limit_print} 个分组：")
            for (nurl, lang), members in sorted(groups.items(), key=lambda kv: -len(kv[1]))[: args.limit_print]:
                keep = members[0]
                print(f"  [{len(members)}篇][{lang}] keep id={keep['id']} ({keep['slug'][:40]})  url={nurl[:70]}")

            if not args.apply:
                print("\n[DRY-RUN] 未做任何修改。加 --apply 执行。")
                conn.rollback()
                return

            redirected = 0
            deindexed = 0
            for (nurl, lang), members in groups.items():
                canonical = members[0]
                for r in members[1:]:
                    if r["slug"] and r["slug"] != canonical["slug"]:
                        cur.execute(
                            """
                            INSERT INTO article_slug_redirects (old_slug, article_id, new_slug, lang, reason)
                            VALUES (%s, %s, %s, %s, 'dedupe_source_url')
                            ON CONFLICT (old_slug) DO NOTHING
                            """,
                            (r["slug"], canonical["id"], canonical["slug"], lang),
                        )
                        redirected += cur.rowcount
                    cur.execute(
                        "UPDATE articles SET is_indexable = FALSE, updated_at = NOW() WHERE id = %s AND is_indexable = TRUE",
                        (r["id"],),
                    )
                    deindexed += cur.rowcount
            conn.commit()
            print(f"\n[APPLY] 完成：下索引 {deindexed} 篇，新增 301 重定向 {redirected} 条。")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
