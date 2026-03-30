import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://yayanews:Jia1009al@127.0.0.1:5432/yayanews';
    pool = new Pool({
      connectionString,
      max: 20,
    });
  }
  return pool;
}

export async function queryAll<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getDb().query(text, params);
  return rows as T[];
}

export async function queryGet<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getDb().query(text, params);
  return rows[0] as T | undefined;
}

/** Returns number of rows affected (for INSERT/UPDATE/DELETE). */
export async function queryRun(text: string, params: unknown[] = []): Promise<number> {
  const result = await getDb().query(text, params);
  return result.rowCount ?? 0;
}
