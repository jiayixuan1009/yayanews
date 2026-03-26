"""迁移：创建 pipeline_runs 表，记录每次 pipeline 运行的结构化耗时数据。"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "yayanews.db"


def migrate():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS pipeline_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_type TEXT NOT NULL CHECK(run_type IN ('article','flash','full')),
        started_at DATETIME NOT NULL,
        finished_at DATETIME NOT NULL,
        total_seconds REAL NOT NULL,
        items_requested INTEGER DEFAULT 0,
        items_produced INTEGER DEFAULT 0,
        stage_timings TEXT DEFAULT '{}',
        channel_timings TEXT DEFAULT '{}',
        error_count INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type ON pipeline_runs(run_type);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at);
    """)

    conn.commit()
    print("[migrate] pipeline_runs table created.")
    conn.close()


if __name__ == "__main__":
    migrate()
