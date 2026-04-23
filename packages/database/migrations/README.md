# Database Migrations

Forward-only SQL migrations for the yayanews PostgreSQL database.

## Conventions

- File names: `NNNN_short_description.sql` (4-digit zero-padded, sequential, `snake_case`).
- One logical change per file; idempotent `IF NOT EXISTS` / `IF EXISTS` clauses preferred but not required.
- Each file is executed inside a single transaction by `migrate.mjs`. Do **not** include `BEGIN` / `COMMIT` yourself.
- Do **not** edit a migration after it has been applied to any environment — its checksum is recorded in `schema_migrations` and a changed file will be reported as drift. Create a new migration instead.

## Commands

```bash
# From the repo root
DATABASE_URL=... node packages/database/scripts/migrate.mjs status   # list pending / applied
DATABASE_URL=... node packages/database/scripts/migrate.mjs up       # apply all pending

# Via package scripts
npm --prefix packages/database run db:migrate:status
npm --prefix packages/database run db:migrate
```

## Relationship to `schema.sql`

`schema.sql` remains the bootstrap schema for brand-new databases (`npm run db:init`). Once a database exists, incremental changes **must** be expressed as migrations in this directory. The first migration (`0001_create_schema_migrations.sql`) only creates the registry table, so applying migrations to a pre-existing database is safe and idempotent.
