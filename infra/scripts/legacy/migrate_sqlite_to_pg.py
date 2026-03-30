import sqlite3
import psycopg2
from psycopg2.extras import execute_batch
import os

def migrate():
    print("Starting migration from SQLite to PostgreSQL...")
    sqlite_conn = sqlite3.connect('data/yayanews.db')
    sqlite_conn.row_factory = sqlite3.Row
    
    pg_url = os.environ.get("DATABASE_URL", "postgresql://yayanews:Jia1009al@127.0.0.1:5432/yayanews")
    pg_conn = psycopg2.connect(pg_url)
    
    tables = [
        "categories", "tags", "articles", "article_tags", "flash_news", 
        "topics", "topic_articles", "guides", "pipeline_runs", "speed_benchmarks"
    ]
    
    with pg_conn.cursor() as pg_cur:
        for t in tables:
            print(f"Migrating table {t}...")
            # delete existing
            pg_cur.execute(f"TRUNCATE TABLE {t} CASCADE")
            
            sql_cur = sqlite_conn.execute(f"SELECT * FROM {t}")
            rows = sql_cur.fetchall()
            if not rows:
                continue
            
            columns = rows[0].keys()
            col_names = ", ".join(columns)
            placeholders = ", ".join(["%s"] * len(columns))
            
            insert_query = f"INSERT INTO {t} ({col_names}) VALUES ({placeholders})"
            
            # transform datetime format replacing T with space if needed or just letting pg parse
            data = [tuple(r) for r in rows]
            
            execute_batch(pg_cur, insert_query, data)
            
            # reset sequence
            if 'id' in columns:
                pg_cur.execute(f"SELECT setval('{t}_id_seq', (SELECT MAX(id) FROM {t}) + 1)")
                
    pg_conn.commit()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
