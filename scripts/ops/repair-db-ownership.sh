#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/yayanews}"
SCHEMA_NAME="${SCHEMA_NAME:-public}"

log() {
  echo "[$(date '+%F %T')] $*"
}

shell_env_from_database_url() {
  node - <<'NODE'
const { readEnvFile } = require('./scripts/lib/read-env.cjs');

function sh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const env = Object.fromEntries(readEnvFile('.env'));
const raw = env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is missing in .env');
  process.exit(1);
}

const url = new URL(raw);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
const dbUser = decodeURIComponent(url.username || '');
if (!dbName || !dbUser) {
  console.error('DATABASE_URL must include both database name and username');
  process.exit(1);
}

console.log(`PARSED_DB_NAME=${sh(dbName)}`);
console.log(`PARSED_DB_OWNER=${sh(dbUser)}`);
console.log(`PARSED_DB_HOST=${sh(url.hostname || '')}`);
console.log(`PARSED_DB_PORT=${sh(url.port || '5432')}`);
NODE
}

cd "$APP_DIR"
eval "$(shell_env_from_database_url)"

DB_NAME="${DB_NAME:-$PARSED_DB_NAME}"
DB_OWNER="${DB_OWNER:-$PARSED_DB_OWNER}"

if [[ -z "$DB_NAME" || -z "$DB_OWNER" ]]; then
  log "ERROR: DB_NAME and DB_OWNER must be set"
  exit 1
fi

log "Repairing ownership for database=$DB_NAME schema=$SCHEMA_NAME owner=$DB_OWNER"
log "DATABASE_URL target parsed as host=$PARSED_DB_HOST port=$PARSED_DB_PORT"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" \
  -v dbname="$DB_NAME" \
  -v owner="$DB_OWNER" \
  -v schema="$SCHEMA_NAME" <<'SQL'
SELECT 'before:' || tableowner || ':' || count(*)
FROM pg_tables
WHERE schemaname = :'schema'
GROUP BY tableowner
ORDER BY tableowner;

ALTER DATABASE :"dbname" OWNER TO :"owner";
ALTER SCHEMA :"schema" OWNER TO :"owner";

GRANT ALL PRIVILEGES ON DATABASE :"dbname" TO :"owner";
GRANT ALL PRIVILEGES ON SCHEMA :"schema" TO :"owner";

SELECT format(
  'ALTER %s %I.%I OWNER TO %I;',
  CASE c.relkind
    WHEN 'S' THEN 'SEQUENCE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    WHEN 'f' THEN 'FOREIGN TABLE'
    ELSE 'TABLE'
  END,
  n.nspname,
  c.relname,
  :'owner'
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = :'schema'
  AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
  AND NOT (
    c.relkind = 'S'
    AND EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.objid = c.oid
        AND d.deptype = 'a'
    )
  )
ORDER BY c.relkind, c.relname
\gexec

SELECT format(
  'ALTER %s %s OWNER TO %I;',
  CASE p.prokind
    WHEN 'p' THEN 'PROCEDURE'
    WHEN 'a' THEN 'AGGREGATE'
    ELSE 'FUNCTION'
  END,
  p.oid::regprocedure,
  :'owner'
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = :'schema'
ORDER BY p.proname, p.oid
\gexec

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA :"schema" TO :"owner";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA :"schema" TO :"owner";
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA :"schema" TO :"owner";
ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema" GRANT ALL PRIVILEGES ON TABLES TO :"owner";
ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema" GRANT ALL PRIVILEGES ON SEQUENCES TO :"owner";
ALTER DEFAULT PRIVILEGES IN SCHEMA :"schema" GRANT ALL PRIVILEGES ON FUNCTIONS TO :"owner";

SELECT 'after:' || tableowner || ':' || count(*)
FROM pg_tables
WHERE schemaname = :'schema'
GROUP BY tableowner
ORDER BY tableowner;
SQL

log "Ownership repair complete."
