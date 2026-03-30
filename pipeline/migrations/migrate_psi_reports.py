"""创建 psi_reports 表（PageSpeed 跑分归档）。执行: python -m pipeline.migrate_psi_reports"""
import sqlite3
from pathlib import Path

DB = Path(__file__).parent.parent / "data" / "yayanews.db"


def main():
    DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS psi_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          page_key TEXT NOT NULL,
          url TEXT NOT NULL,
          strategy TEXT NOT NULL DEFAULT 'mobile',
          performance_score INTEGER,
          lcp_ms REAL,
          fcp_ms REAL,
          ttfb_ms REAL,
          cls REAL,
          raw_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_psi_reports_created ON psi_reports(created_at DESC)"
    )
    conn.commit()
    conn.close()
    print("psi_reports OK")


if __name__ == "__main__":
    main()
