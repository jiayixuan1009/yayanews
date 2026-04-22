import sys
import os
from slugify import slugify
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from pipeline.utils.database import get_conn, get_pool
from psycopg2.extras import RealDictCursor

def migrate_tags():
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as select_cur:
            select_cur.execute("SELECT id, name, slug FROM tags")
            tags = select_cur.fetchall()
            
            with conn.cursor() as cur:
                updated_count = 0
                for tag in tags:
                    old_slug = tag['slug']
                    new_slug = slugify(tag['name'], max_length=50)
                    
                    if old_slug != new_slug:
                        # Check for collision
                        cur.execute("SELECT id FROM tags WHERE slug = %s AND id != %s", (new_slug, tag['id']))
                        if cur.fetchone():
                            # Collision exists, append id
                            new_slug = f"{new_slug}-{tag['id']}"
                            
                        # Update the slug
                        cur.execute("UPDATE tags SET slug = %s WHERE id = %s", (new_slug, tag['id']))
                        print(f"Updated tag '{tag['name']}': {old_slug} -> {new_slug}")
                        updated_count += 1
                        
        conn.commit()
        print(f"Migration complete. Updated {updated_count} tags.")
    finally:
        if get_pool():
            get_pool().putconn(conn)

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    migrate_tags()
