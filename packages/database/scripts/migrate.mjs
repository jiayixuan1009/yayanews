#!/usr/bin/env node
/**
 * Forward-only SQL migration runner for yayanews.
 *
 * Usage:
 *   DATABASE_URL=... node packages/database/scripts/migrate.mjs <command>
 *
 * Commands:
 *   up        Apply all pending migrations (default).
 *   status    Print applied + pending migrations. Exits 0 even when pending.
 *
 * Conventions:
 *   - Migration files live in ../migrations and are named NNNN_description.sql.
 *   - Each file is executed inside a single transaction.
 *   - The registry lives in schema_migrations (see 0001_create_schema_migrations.sql).
 *   - Changing an already-applied file is treated as drift and aborts the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const REGISTRY_TABLE = 'schema_migrations';

function log(...args) {
  console.log('[migrate]', ...args);
}
function errorLog(...args) {
  console.error('[migrate]', ...args);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    errorLog(`ERROR: ${name} is not set. Refusing to run.`);
    process.exit(1);
  }
  return v;
}

function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    errorLog(`ERROR: migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const seen = new Set();
  return files.map((file) => {
    const match = file.match(/^(\d{4})_[a-z0-9_]+\.sql$/i);
    if (!match) {
      errorLog(`ERROR: invalid migration filename: ${file}`);
      errorLog('       expected format: NNNN_description.sql');
      process.exit(1);
    }
    const version = match[1];
    if (seen.has(version)) {
      errorLog(`ERROR: duplicate migration version: ${version}`);
      process.exit(1);
    }
    seen.add(version);
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    return { version, file, fullPath, sql, checksum };
  });
}

async function registryExists(client) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = $1`,
    [REGISTRY_TABLE]
  );
  return rows.length > 0;
}

async function loadApplied(client) {
  if (!(await registryExists(client))) {
    return new Map();
  }
  const { rows } = await client.query(
    `SELECT version, checksum, applied_at FROM ${REGISTRY_TABLE} ORDER BY version`
  );
  return new Map(rows.map((r) => [r.version, r]));
}

async function cmdStatus(client) {
  const all = loadMigrationFiles();
  const applied = await loadApplied(client);

  log(`discovered ${all.length} migration file(s), ${applied.size} applied`);
  for (const m of all) {
    const rec = applied.get(m.version);
    if (!rec) {
      log(`  [pending] ${m.file}`);
    } else if (rec.checksum !== m.checksum) {
      log(`  [DRIFT!]  ${m.file}  (file changed after apply)`);
    } else {
      log(`  [applied] ${m.file}  at ${rec.applied_at.toISOString?.() ?? rec.applied_at}`);
    }
  }
}

async function cmdUp(client) {
  const all = loadMigrationFiles();
  const applied = await loadApplied(client);

  // Drift check: already-applied files must have matching checksums.
  for (const m of all) {
    const rec = applied.get(m.version);
    if (rec && rec.checksum !== m.checksum) {
      errorLog(
        `ERROR: migration ${m.file} has been modified after it was applied ` +
          `(expected checksum ${rec.checksum.slice(0, 12)}…, got ${m.checksum.slice(0, 12)}…).`
      );
      errorLog('       create a new migration instead of editing an applied one.');
      process.exit(2);
    }
  }

  const pending = all.filter((m) => !applied.has(m.version));
  if (pending.length === 0) {
    log('no pending migrations — database is up to date.');
    return;
  }

  log(`applying ${pending.length} pending migration(s)…`);
  for (const m of pending) {
    const started = Date.now();
    try {
      await client.query('BEGIN');
      await client.query(m.sql);
      // The registry table is created by the first migration itself, so the
      // INSERT here will succeed for every subsequent run including 0001.
      await client.query(
        `INSERT INTO ${REGISTRY_TABLE}(version, checksum, duration_ms) VALUES ($1, $2, $3)`,
        [m.version, m.checksum, Date.now() - started]
      );
      await client.query('COMMIT');
      log(`  applied ${m.file} (${Date.now() - started}ms)`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      errorLog(`FAILED ${m.file}:`, err.message);
      process.exit(3);
    }
  }
  log('done.');
}

async function main() {
  const cmd = (process.argv[2] || 'up').toLowerCase();
  if (!['up', 'status'].includes(cmd)) {
    errorLog(`ERROR: unknown command "${cmd}" (expected: up | status)`);
    process.exit(1);
  }

  const connectionString = requireEnv('DATABASE_URL');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (cmd === 'status') await cmdStatus(client);
    else await cmdUp(client);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  errorLog('UNHANDLED ERROR:', err);
  process.exit(99);
});
