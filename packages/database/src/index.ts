import { Pool, types } from 'pg';

// 禁用 Date 对象转换，原样返回时间字符串，保证前端 `.slice(0, 16)` 不报错
types.setTypeParser(1114, str => str); // timestamp
types.setTypeParser(1184, str => str); // timestamptz
types.setTypeParser(1082, str => str); // date

let pool: Pool | null = null;

const TRANSIENT_CONNECTION_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  '57P01',
  '57P02',
  '57P03',
  '08000',
  '08003',
  '08006',
  '53300',
]);

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      max: intEnv('DB_POOL_MAX', 10),
      connectionTimeoutMillis: intEnv('DB_CONNECTION_TIMEOUT_MS', 5000),
      idleTimeoutMillis: intEnv('DB_IDLE_TIMEOUT_MS', 30000),
      query_timeout: intEnv('DB_QUERY_TIMEOUT_MS', 10000),
    });
    // Prevent unhandled rejection crashes from idle clients
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

function convertDates(obj: any): any {
  if (obj && typeof obj === 'object' && typeof obj.getTime === 'function') {
    // Return standard format like 2026-03-30 22:40:35 used in Postgres strings
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${obj.getFullYear()}-${pad(obj.getMonth()+1)}-${pad(obj.getDate())} ${pad(obj.getHours())}:${pad(obj.getMinutes())}:${pad(obj.getSeconds())}`;
  }
  if (Array.isArray(obj)) return obj.map(convertDates);
  if (obj && typeof obj === 'object') {
    const res: any = {};
    for (const k in obj) res[k] = convertDates(obj[k]);
    return res;
  }
  return obj;
}

function isTransientConnectionError(err: any): boolean {
  const code = err?.code || err?.cause?.code;
  if (code && TRANSIENT_CONNECTION_CODES.has(String(code))) return true;
  const message = String(err?.message || err?.cause?.message || '');
  return /Connection terminated|terminated unexpectedly|timeout|ECONNRESET|ECONNREFUSED/i.test(message);
}

async function readQueryWithRetry(text: string, params: unknown[]) {
  try {
    return await getDb().query(text, params);
  } catch (err: any) {
    if (!isTransientConnectionError(err)) throw err;
    console.warn('[DB transient read retry]', err.message || err);
    return getDb().query(text, params);
  }
}

export async function queryAll<T>(text: string, params: unknown[] = []): Promise<T[]> {
  try {
    const { rows } = await readQueryWithRetry(text, params);
    return convertDates(rows) as T[];
  } catch (err: any) {
    if (err.code === '42P18') console.error(`\n[DB 42P18 ERROR - queryAll]\nSQL: ${text}\nParams:`, params, '\n');
    throw err;
  }
}

export async function queryGet<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  try {
    const { rows } = await readQueryWithRetry(text, params);
    return convertDates(rows[0]) as T | undefined;
  } catch (err: any) {
    if (err.code === '42P18') console.error(`\n[DB 42P18 ERROR - queryGet]\nSQL: ${text}\nParams:`, params, '\n');
    throw err;
  }
}

/** Returns number of rows affected (for INSERT/UPDATE/DELETE). */
export async function queryRun(text: string, params: unknown[] = []): Promise<number> {
  const result = await getDb().query(text, params);
  return result.rowCount ?? 0;
}
