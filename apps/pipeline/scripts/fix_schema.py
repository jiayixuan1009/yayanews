import os
import sys
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.utils.database import get_conn, get_pool
from pipeline.utils.logger import get_logger

log = get_logger("schema_fix")

def fix_topics():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 1. Add topic_id to articles
            log.info("Checking articles.topic_id column...")
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='articles' AND column_name='topic_id';
            """)
            if not cur.fetchone():
                log.info("Adding topic_id column to articles table...")
                cur.execute("ALTER TABLE articles ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;")
            else:
                log.info("topic_id already exists.")
                
            # 2. Add topic_featured_articles table if missing
            cur.execute("""
                CREATE TABLE IF NOT EXISTS topic_featured_articles (
                    topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
                    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
                    sort_order INTEGER DEFAULT 0,
                    PRIMARY KEY (topic_id, article_id)
                );
            """)
            log.info("topic_featured_articles table verified.")
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"Error: {e}")
    finally:
        get_pool().putconn(conn)

if __name__ == "__main__":
    fix_topics()
    log.info("Done.")
