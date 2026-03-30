import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://yayanews:Jia1009al@127.0.0.1:5432/yayanews';
  const pool = new Pool({ connectionString });
  
  try {
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('[DB] Connecting to PostgreSQL to initialize schema...');
    await pool.query(sql);
    console.log('[DB] Schema and default categories initialized successfully!');
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
