import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://yayanews:REDACTED@127.0.0.1:5432/yayanews';
    pool = new Pool({
      connectionString,
      max: 20
    });
  }
  return pool;
}

export async function queryAll<T>(text: string, params: any[] = []): Promise<T[]> {
  const { rows } = await getDb().query(text, params);
  return rows as T[];
}

export async function queryGet<T>(text: string, params: any[] = []): Promise<T | undefined> {
  const { rows } = await getDb().query(text, params);
  return rows[0] as T | undefined;
}
