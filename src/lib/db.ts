import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'yayanews.db');
    db = new Database(dbPath, { readonly: false });
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 15000');
    db.pragma('foreign_keys = ON');
  }
  return db;
}
