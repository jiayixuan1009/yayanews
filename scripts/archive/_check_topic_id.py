import os
from psycopg2 import connect
from psycopg2.extras import RealDictCursor
DB_URL = "postgresql://yayanews_super:<REDACTED>@<REDACTED-IP>:5432/yayanews"

def main():
    conn = connect(DB_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id, title, topic_id FROM articles ORDER BY published_at DESC LIMIT 50")
        rows = cur.fetchall()
        topics_count = sum(1 for r in rows if r['topic_id'] is not None)
        print(f"Out of the last 50 articles, {topics_count} have a topic_id.")
        for r in rows[:10]:
             print(f"Article: {r['title'][:40]}, Topic ID: {r['topic_id']}")

    conn.close()

if __name__ == "__main__":
    main()
