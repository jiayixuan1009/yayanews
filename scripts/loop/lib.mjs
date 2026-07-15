import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

import { readRequiredEnvValue } from '../lib/read-env.mjs';

export const { Client, Pool } = pkg;

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
export const DEFAULT_SITE_ORIGIN = 'https://yayanews.cryptooptiontool.com';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, '..', '..');
export const defaultEnvPath = path.join(rootDir, '.env');

export function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

export function databaseUrlFromEnv(envPath = defaultEnvPath) {
  return process.env.DATABASE_URL || readRequiredEnvValue(envPath, 'DATABASE_URL');
}

export function parseCommonArgs(argv, defaults = {}) {
  const options = {
    envPath: defaultEnvPath,
    limit: defaults.limit ?? 100,
    apply: false,
    output: '',
    ...defaults,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.apply = false;
      continue;
    }
    if (arg === '--env') {
      options.envPath = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--env=')) {
      options.envPath = arg.slice('--env='.length);
      continue;
    }
    if (arg === '--limit') {
      options.limit = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--output') {
      options.output = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (options.input) throw new Error(`Unexpected extra input: ${arg}`);
    options.input = arg;
  }

  if ('limit' in options && (!Number.isFinite(options.limit) || options.limit < 1)) {
    throw new Error(`Invalid --limit: ${options.limit}`);
  }
  if ('limit' in options) options.limit = Math.floor(options.limit);
  return options;
}

export async function withClient(options, fn) {
  const client = new Client({ connectionString: databaseUrlFromEnv(options.envPath) });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function createLoopRun(client, { runType, mode, source = '', notes = '' }) {
  const runKey = `${runType}-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(16).slice(2, 8)}`;
  const { rows } = await client.query(
    `
    INSERT INTO loop_runs(run_key, run_type, mode, source, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, run_key
    `,
    [runKey, runType, mode, source, notes],
  );
  return rows[0];
}

export async function finishLoopRun(client, id, { status = 'completed', stats = {}, notes = '' }) {
  await client.query(
    `
    UPDATE loop_runs
    SET status = $2,
        finished_at = CURRENT_TIMESTAMP,
        stats = $3::jsonb,
        notes = CASE WHEN $4 = '' THEN notes ELSE $4 END
    WHERE id = $1
    `,
    [id, status, JSON.stringify(stats), notes],
  );
}

export function loadCsvExport(inputPath) {
  const resolved = path.resolve(inputPath);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) return readDirectoryExport(resolved);
  if (stat.isFile() && resolved.toLowerCase().endsWith('.zip')) return readZipExport(resolved);
  if (stat.isFile() && resolved.toLowerCase().endsWith('.csv')) {
    return [{ name: path.basename(resolved), text: readTextFile(resolved) }];
  }
  throw new Error(`Unsupported CSV export input: ${inputPath}`);
}

function readDirectoryExport(directory) {
  return collectFiles(directory)
    .filter((filePath) => filePath.toLowerCase().endsWith('.csv'))
    .map((filePath) => ({
      name: path.relative(directory, filePath).replace(/\\/g, '/'),
      text: readTextFile(filePath),
    }));
}

function collectFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function readZipExport(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const files = [];

  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid zip central directory at offset ${offset}`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replace(/\\/g, '/');

    if (name.toLowerCase().endsWith('.csv')) {
      files.push({
        name,
        text: unzipFileEntry(buffer, localHeaderOffset, method, compressedSize).replace(/^\uFEFF/, ''),
      });
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw new Error('Unable to locate zip end of central directory.');
}

function unzipFileEntry(buffer, localHeaderOffset, method, compressedSize) {
  if (buffer.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid zip local file header at offset ${localHeaderOffset}`);
  }

  const nameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return compressed.toString('utf8');
  if (method === 8) return zlib.inflateRawSync(compressed).toString('utf8');
  throw new Error(`Unsupported zip compression method: ${method}`);
}

export function parseCsvRecords(text) {
  const rows = parseCsv(text).filter((row) => row.some((field) => field.trim() !== ''));
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const records = rows.slice(1).map((row) => {
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = row[index] ?? '';
    }
    return record;
  });
  return { headers, records };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

export function findColumn(headers, candidates) {
  const normalized = headers.map((header) => normalizeHeader(header));
  for (const candidate of candidates.map(normalizeHeader)) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return headers[index];
  }
  for (let index = 0; index < headers.length; index += 1) {
    if (candidates.some((candidate) => normalized[index].includes(normalizeHeader(candidate)))) {
      return headers[index];
    }
  }
  return null;
}

export function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function numericMetric(value, fallback = 0) {
  const normalized = String(value ?? '').replace(/[%,$,\s]/g, '');
  if (!normalized) return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

export function ctrMetric(value, clicks, impressions) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    const raw = String(value).trim();
    const number = numericMetric(raw, NaN);
    if (Number.isFinite(number)) return raw.includes('%') ? number / 100 : number;
  }
  return impressions > 0 ? clicks / impressions : 0;
}

export function performanceDimensionName(fileName, dimensionColumn) {
  const base = path.basename(fileName).toLowerCase();
  const column = normalizeHeader(dimensionColumn);
  if (base.includes('quer') || column.includes('quer')) return 'Queries';
  if (base.includes('page') || column.includes('page') || column === 'url') return 'Pages';
  if (base.includes('date') || column === 'date') return 'Dates';
  if (base.includes('countr') || column === 'country') return 'Countries';
  if (base.includes('device') || column === 'device') return 'Devices';
  if (base.includes('appearance') || column.includes('appearance')) return 'Search Appearance';
  return dimensionColumn;
}

export function findPerformanceDimensionColumn(headers) {
  return findColumn(headers, [
    'Top pages',
    'Page',
    'Pages',
    'URL',
    'Top queries',
    'Query',
    'Queries',
    'Date',
    'Country',
    'Device',
    'Search appearance',
  ]) || headers.find((header) => {
    const normalized = normalizeHeader(header);
    return !['clicks', 'impressions', 'ctr', 'click-through rate', 'click through rate', 'position', 'average position', 'avg position'].includes(normalized);
  }) || null;
}

export function analyzeUrl(label, siteOrigin = DEFAULT_SITE_ORIGIN) {
  let url;
  try {
    url = new URL(label);
  } catch {
    try {
      url = new URL(label, siteOrigin);
    } catch {
      return {
        url: label,
        lang: null,
        entityKind: 'unknown',
        entityValue: label,
      };
    }
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const lang = parts[0] === 'zh' || parts[0] === 'en' ? parts[0] : null;
  const offset = lang ? 1 : 0;
  const first = parts[offset] || '';
  const second = parts[offset + 1] || '';
  let entityKind = 'other';
  let entityValue = url.pathname;

  if (!first) {
    entityKind = 'home';
    entityValue = lang || 'root';
  } else if (first === 'article' && second) {
    entityKind = 'article';
    entityValue = second;
  } else if (first === 'news' && second) {
    entityKind = 'news-category';
    entityValue = second;
  } else if (first === 'news') {
    entityKind = 'news-list';
    entityValue = lang || 'all';
  } else if (first === 'tag' && second) {
    entityKind = 'tag';
    entityValue = second;
  } else if (first === 'topics' && second) {
    entityKind = 'topic';
    entityValue = second;
  } else if (first === 'topics') {
    entityKind = 'topics-list';
    entityValue = lang || 'all';
  } else if (first === 'flash') {
    entityKind = second ? 'flash' : 'flash-list';
    entityValue = second || lang || 'all';
  } else if (first === 'guide' && second) {
    entityKind = 'guide';
    entityValue = second;
  }

  return {
    url: url.toString(),
    lang,
    entityKind,
    entityValue,
    pathname: url.pathname,
  };
}

export function makeKey(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9._:/-]+/g, '-').replace(/-+/g, '-').slice(0, 120))
    .join(':')
    .slice(0, 300);
}

export function formatPct(value) {
  if (!Number.isFinite(Number(value))) return 'n/a';
  return `${(Number(value) * 100).toFixed(2)}%`;
}
