"""Quick DB diagnostic: counts articles & flash_news by language."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'pipeline'))

# Fix Windows GBK encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import psycopg2

LOCAL_URL = "postgresql://yayanews_super:<REDACTED>@127.0.0.1:5433/yayanews"
REMOTE_URL = "postgresql://yayanews_super:<REDACTED>@<REDACTED-IP>:5432/yayanews"

def check_db(label, dsn):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    try:
        conn = psycopg2.connect(dsn, connect_timeout=10)
        cur = conn.cursor()

        # First, discover the articles table columns
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='articles' ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"\n[articles columns]: {', '.join(cols)}")

        # Published articles by lang
        cur.execute("""
            SELECT lang, status, COUNT(*)
            FROM articles
            WHERE status='published'
            GROUP BY lang, status ORDER BY lang
        """)
        print("\n[Published Articles]")
        for row in cur.fetchall():
            print(f"  lang={row[0]}  status={row[1]}  count={row[2]}")

        # All articles by lang + status
        cur.execute("""
            SELECT lang, status, COUNT(*)
            FROM articles
            GROUP BY lang, status ORDER BY lang, status
        """)
        print("\n[All Articles by lang+status]")
        for row in cur.fetchall():
            print(f"  lang={row[0]}  status={row[1]}  count={row[2]}")

        # Flash news
        cur.execute("""
            SELECT lang, COUNT(*) FROM flash_news GROUP BY lang ORDER BY lang
        """)
        print("\n[Flash News]")
        for row in cur.fetchall():
            print(f"  lang={row[0]}  count={row[1]}")

        # Recent articles
        cur.execute("""
            SELECT lang, COUNT(*) FROM articles
            WHERE status='published'
              AND created_at > NOW() - INTERVAL '7 days'
            GROUP BY lang ORDER BY lang
        """)
        print("\n[Articles created in last 7 days]")
        rows = cur.fetchall()
        if rows:
            for row in rows:
                print(f"  lang={row[0]}  count={row[1]}")
        else:
            print("  (none)")

        # Latest EN article
        cur.execute("SELECT MAX(created_at), MAX(published_at) FROM articles WHERE lang='en' AND status='published'")
        row = cur.fetchone()
        print(f"\n[Latest EN article] created_at={row[0]}, published_at={row[1]}")

        cur.execute("SELECT MAX(created_at) FROM flash_news WHERE lang='en'")
        row = cur.fetchone()
        print(f"[Latest EN flash]   created_at={row[0]}")

        # Check if translate_en has run
        cur.execute("SELECT MAX(created_at) FROM articles WHERE lang='en'")
        row = cur.fetchone()
        print(f"[Latest EN article overall] created_at={row[0]}")

        conn.close()
        print("\n[OK] Connection successful")
    except Exception as e:
        print(f"\n[FAIL] Connection error: {e}")

if __name__ == "__main__":
    check_db("LOCAL DB (127.0.0.1:5433)", LOCAL_URL)
    check_db("REMOTE DB (<REDACTED-IP>:5432)", REMOTE_URL)
