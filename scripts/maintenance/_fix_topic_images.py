import os
import re
from psycopg2 import connect
from psycopg2.extras import RealDictCursor
DB_URL = "postgresql://yayanews_super:<REDACTED>@<REDACTED-IP>:5432/yayanews"

def main():
    conn = connect(DB_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id, cover_image FROM topics WHERE cover_image IS NOT NULL")
        rows = cur.fetchall()
        for r in rows:
             url = r['cover_image']
             # basic fix logic
             new_url = url
             if new_url.endswith('.png'):
                  new_url = new_url[:-4] + '.jpg'
             elif not new_url.endswith('.jpg'):
                  new_url += '.jpg'
             
             if new_url != url:
                  cur.execute("UPDATE topics SET cover_image = %s WHERE id = %s", (new_url, r['id']))
                  print(f"Fixed {r['id']}: {url} -> {new_url}")
    conn.commit()
    conn.close()
    print("Topic image URLs fixed.")

if __name__ == "__main__":
    main()
