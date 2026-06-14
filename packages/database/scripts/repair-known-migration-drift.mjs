#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

function log(...args) {
  console.log('[migration-repair]', ...args);
}

function checksum(fileName) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8'))
    .digest('hex');
}

async function repair0005(client) {
  const targetChecksum = checksum('0005_dedupe_articles_add_normalized_title_unique_index.sql');
  const rec = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', ['0005']);
  if (rec.rowCount === 0 || rec.rows[0].checksum === targetChecksum) return false;

  const col = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'audit_status'"
  );
  const idx = await client.query(
    "SELECT 1 FROM pg_indexes WHERE tablename = 'articles' AND indexname = 'idx_articles_normalized_title_unique'"
  );
  const dup = await client.query(
    "SELECT 1 FROM articles WHERE NULLIF(TRIM(title), '') IS NOT NULL GROUP BY lower(trim(title)) HAVING count(*) > 1 LIMIT 1"
  );

  if (col.rowCount !== 1 || idx.rowCount !== 1 || dup.rowCount !== 0) {
    throw new Error('0005 drift detected, but database state does not match the current migration file.');
  }

  await client.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2', [targetChecksum, '0005']);
  log('repaired checksum for 0005_dedupe_articles_add_normalized_title_unique_index.sql');
  return true;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const repaired = await repair0005(client);
    await client.query('COMMIT');
    if (!repaired) log('no known migration drift repair needed.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
