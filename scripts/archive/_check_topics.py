import os
from psycopg2 import connect
from psycopg2.extras import RealDictCursor
DB_URL = "postgresql://yayanews_super:<REDACTED>@<REDACTED-IP>:5432/yayanews"

def main():
    conn = connect(DB_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        print("=== TOPICS COUNT ===")
        cur.execute("""
            SELECT t.id, t.title, t.status, t.cover_image,
              (SELECT COUNT(*) FROM articles a WHERE a.topic_id = t.id AND a.status='published' AND a.audit_status='approved') as approved_articles
            FROM topics t
            ORDER BY approved_articles DESC, t.id ASC
        """)
        for r in cur.fetchall():
            print(f"ID: {r['id']}, Title: {r['title']}, Status: {r['status']}, Img: {r['cover_image'][:30] if r['cover_image'] else None}, Articles: {r['approved_articles']}")

        print("\n=== CATEGORY IMAGES ===")
        cur.execute("SELECT id, slug, name, cover_image FROM categories ORDER BY id")
        for r in cur.fetchall():
             print(f"ID: {r['id']}, Slug: {r['slug']}, Name: {r['name']}, Img: {r['cover_image'][:30] if r['cover_image'] else None}")
    conn.close()

if __name__ == "__main__":
    main()
