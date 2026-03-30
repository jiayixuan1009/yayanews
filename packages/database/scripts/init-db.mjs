import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[DB] ERROR: DATABASE_URL environment variable is not set.');
    console.error('[DB] Please run via: npm run db:init (which loads .env automatically)');
    process.exit(1);
  }
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
