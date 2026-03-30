import { Pool, types } from 'pg';

// 禁用 Date 对象转换，原样返回时间字符串，保证前端 `.slice(0, 16)` 不报错
types.setTypeParser(1114, str => str); // timestamp
types.setTypeParser(1184, str => str); // timestamptz
types.setTypeParser(1082, str => str); // date

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      max: 20,
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

export async function queryAll<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getDb().query(text, params);
  return convertDates(rows) as T[];
}

export async function queryGet<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getDb().query(text, params);
  return convertDates(rows[0]) as T | undefined;
}

/** Returns number of rows affected (for INSERT/UPDATE/DELETE). */
export async function queryRun(text: string, params: unknown[] = []): Promise<number> {
  const result = await getDb().query(text, params);
  return result.rowCount ?? 0;
}
