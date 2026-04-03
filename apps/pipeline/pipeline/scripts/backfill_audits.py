import sys
import os

# Ensure the pipeline module is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from pipeline.utils.database import get_conn, get_pool
from pipeline.agents.agent7_auditor import audit_article

def run_backfill(limit=50):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 获取未审核的有素材文章
            cur.execute("""
                SELECT id, title, content, source 
                FROM articles 
                WHERE audit_status IS NULL 
                  AND lang = 'zh' 
                  AND source IS NOT NULL 
                  AND length(source) > 20
                ORDER BY id DESC LIMIT %s
            """, (limit,))
            rows = cur.fetchall()
            
            print(f"Found {len(rows)} articles to backfill audit status...")
            for r in rows:
                a_id, title, content, source = r
                print(f"Auditing [{a_id}] {title[:30]}...")
                audit_article(article_id=a_id, title=title, content=content, source=source)
                
            print("Done!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        get_pool().putconn(conn)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()
    run_backfill(args.limit)
