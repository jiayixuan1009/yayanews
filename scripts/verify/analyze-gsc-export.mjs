#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DEFAULT_SITE_ORIGIN = 'https://yayanews.cryptooptiontool.com';
const DEFAULT_MAX_EXAMPLES = 8;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;

const PINYIN_HINTS = new Set([
  'a', 'ai', 'an', 'ba', 'bao', 'bei', 'bi', 'biao', 'bo', 'bu',
  'cai', 'cang', 'ce', 'cha', 'chang', 'chao', 'che', 'cheng', 'chi', 'chu',
  'chuang', 'cong', 'da', 'dan', 'dao', 'de', 'deng', 'di', 'dian', 'die',
  'ding', 'dong', 'du', 'duan', 'dui', 'e', 'er', 'fa', 'fang', 'fei',
  'fen', 'feng', 'fu', 'gang', 'gao', 'ge', 'gen', 'gong', 'gu', 'guan',
  'guang', 'gui', 'guo', 'hai', 'han', 'hao', 'he', 'heng', 'hong', 'hou',
  'hua', 'huan', 'huang', 'hui', 'ji', 'jia', 'jian', 'jiao', 'jie', 'jin',
  'jing', 'ju', 'jun', 'kan', 'kou', 'kuang', 'kun', 'lai', 'lang', 'lei',
  'li', 'lian', 'liang', 'liao', 'lie', 'liu', 'long', 'lu', 'lun', 'mei',
  'men', 'mo', 'na', 'neng', 'nian', 'niu', 'pan', 'pao', 'pi', 'pian',
  'po', 'pu', 'qi', 'qian', 'qing', 'quan', 'qu', 'ru', 'sai', 'san',
  'se', 'sha', 'shan', 'shang', 'sheng', 'shi', 'shou', 'shu', 'si', 'su',
  'suo', 'tai', 'tan', 'tao', 'te', 'ti', 'tong', 'tou', 'tu', 'tui',
  'wa', 'wai', 'wan', 'wei', 'wen', 'wu', 'xi', 'xia', 'xian', 'xiang',
  'xiao', 'xin', 'xing', 'xiu', 'xu', 'xuan', 'ya', 'yan', 'yang', 'yao',
  'yi', 'yin', 'ying', 'you', 'yu', 'yuan', 'yue', 'zai', 'zhan', 'zhang',
  'zhe', 'zhen', 'zhi', 'zhong', 'zhou', 'zhu', 'zhuan', 'zi', 'zou',
]);

function usage() {
  return [
    'Usage: node scripts/verify/analyze-gsc-export.mjs <gsc-export-dir-or-zip> [options]',
    '',
    'Options:',
    `  --site-origin <url>     Expected production origin. Default: ${DEFAULT_SITE_ORIGIN}`,
    `  --max-examples <n>      Example URLs per bucket. Default: ${DEFAULT_MAX_EXAMPLES}`,
    '  --output <path>         Write the Markdown report to a file as well as stdout.',
    '  -h, --help              Show this help.',
    '',
    'Examples:',
    '  npm run verify:gsc-export -- outputs/gsc-coverage-2026-06-14',
    '  npm run verify:gsc-export -- C:/Users/admin/Downloads/coverage.zip --output outputs/gsc-analysis.md',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    input: '',
    output: '',
    siteOrigin: DEFAULT_SITE_ORIGIN,
    maxExamples: DEFAULT_MAX_EXAMPLES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--site-origin') {
      options.siteOrigin = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--site-origin=')) {
      options.siteOrigin = arg.slice('--site-origin='.length);
      continue;
    }
    if (arg === '--max-examples') {
      options.maxExamples = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-examples=')) {
      options.maxExamples = Number(arg.slice('--max-examples='.length));
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
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (options.input) {
      throw new Error(`Unexpected extra input: ${arg}`);
    }
    options.input = arg;
  }

  if (!options.input) throw new Error('Missing GSC export directory or zip path.');
  if (!Number.isFinite(options.maxExamples) || options.maxExamples < 1) {
    throw new Error(`Invalid --max-examples: ${options.maxExamples}`);
  }

  options.siteOriginUrl = new URL(options.siteOrigin);
  return options;
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function loadExport(inputPath) {
  const resolved = path.resolve(inputPath);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) return readDirectoryExport(resolved);
  if (stat.isFile() && resolved.toLowerCase().endsWith('.zip')) return readZipExport(resolved);
  if (stat.isFile() && resolved.toLowerCase().endsWith('.csv')) {
    return [{ name: path.basename(resolved), text: readTextFile(resolved) }];
  }
  throw new Error(`Unsupported GSC export input: ${inputPath}`);
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

function pickCsv(files, basename) {
  const lower = basename.toLowerCase();
  return files.find((file) => path.basename(file.name).toLowerCase() === lower) || null;
}

function parseCsvRecords(text) {
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

function findColumn(headers, candidates) {
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

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function metadataEntries(metadataCsv) {
  if (!metadataCsv) return [];
  const { headers, records } = parseCsvRecords(metadataCsv.text);
  const propertyColumn = findColumn(headers, ['Property', 'Key', 'Name']) || headers[0];
  const valueColumn = findColumn(headers, ['Value']) || headers[1];
  return records
    .map((record) => ({
      property: record[propertyColumn] || '',
      value: record[valueColumn] || '',
    }))
    .filter((entry) => entry.property || entry.value);
}

function chartSummary(chartCsv) {
  if (!chartCsv) return null;
  const { headers, records } = parseCsvRecords(chartCsv.text);
  const dateColumn = findColumn(headers, ['Date']);
  const countColumn = findColumn(headers, ['Affected pages', 'Pages', 'Count']);
  if (!dateColumn || !countColumn) return null;

  const points = records
    .map((record) => ({
      date: record[dateColumn],
      count: Number(String(record[countColumn] || '').replace(/,/g, '')),
    }))
    .filter((point) => point.date && Number.isFinite(point.count));
  if (points.length === 0) return null;

  const firstNonZero = points.find((point) => point.count > 0) || null;
  const latest = points[points.length - 1];
  const peak = points.reduce((best, point) => point.count > best.count ? point : best, points[0]);
  const previous = points.length > 1 ? points[points.length - 2] : null;
  return {
    points,
    firstNonZero,
    latest,
    previous,
    peak,
    deltaFromPrevious: previous ? latest.count - previous.count : 0,
  };
}

function analyzeTable(tableCsv, siteOriginUrl) {
  const { headers, records } = parseCsvRecords(tableCsv.text);
  const urlColumn = findColumn(headers, ['URL', 'Page', 'Submitted URL']);
  const lastCrawledColumn = findColumn(headers, ['Last crawled', 'Last crawl', 'Date']);
  if (!urlColumn) throw new Error(`Unable to find URL column in ${tableCsv.name}`);

  return records
    .map((record) => analyzeUrl(record[urlColumn], record[lastCrawledColumn] || '', siteOriginUrl))
    .filter(Boolean);
}

function analyzeUrl(rawUrl, lastCrawled, siteOriginUrl) {
  const trimmedUrl = String(rawUrl || '').trim();
  if (!trimmedUrl) return null;

  const parsed = parseUrl(trimmedUrl, siteOriginUrl);
  const rawPath = parsed ? parsed.pathname : extractPath(trimmedUrl);
  const decodedPath = safeDecode(rawPath);
  const segments = decodedPath.split('/').filter(Boolean);
  const lang = segments[0] === 'zh' || segments[0] === 'en' ? segments[0] : 'missing';
  const routeIndex = lang === 'missing' ? 0 : 1;
  const route = segments[routeIndex] || 'home';
  const slug = segments.slice(routeIndex + 1).join('/');
  const kind = classifyKind(route, slug);
  const signals = [];

  if (!parsed) signals.push('invalid-url');
  if (parsed && parsed.origin !== siteOriginUrl.origin) signals.push('origin-mismatch');
  if (lang === 'missing' && isLegacyRoutable(route)) signals.push('legacy-no-locale');
  if (kind === 'flash-detail') signals.push('flash-detail');
  if (kind === 'unknown') signals.push('unknown-route');
  if (hasNonAsciiOrMojibake(trimmedUrl)) signals.push('non-ascii-or-mojibake-url');
  if (parsed?.search && (kind === 'article-detail' || kind === 'flash-detail')) signals.push('query-in-detail-url');
  if (lang === 'en' && isDetailKind(kind) && slugLooksTranslatedFromChinese(slug)) {
    signals.push('english-detail-slug-review');
  }

  return {
    url: trimmedUrl,
    lastCrawled,
    origin: parsed?.origin || 'invalid',
    path: decodedPath,
    lang,
    route,
    kind,
    slug,
    signals,
    actionBucket: actionBucket({ kind, signals }),
  };
}

function parseUrl(value, siteOriginUrl) {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(value, siteOriginUrl);
    } catch {
      return null;
    }
  }
}

function extractPath(value) {
  const match = value.match(/^https?:\/\/[^/]+([^#]*)/i);
  return match?.[1] || value;
}

function safeDecode(value) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function classifyKind(route, slug) {
  if (route === 'home') return 'home';
  if (route === 'article') return slug ? 'article-detail' : 'article-list';
  if (route === 'flash') return slug ? 'flash-detail' : 'flash-list';
  if (route === 'news') return slug ? 'news-category' : 'news-list';
  if (route === 'tag') return slug ? 'tag-detail' : 'tag-list';
  if (route === 'topics') return slug ? 'topic-detail' : 'topic-list';
  if (route === 'authors') return slug ? 'author-detail' : 'author-list';
  if (route === 'guide') return slug ? 'guide-detail' : 'guide-list';
  if (route === 'category') return 'legacy-category-alias';
  if (route === 'markets') return 'markets';
  if (route === 'search') return 'search';
  if (route === 'sitemap.xml' || route === 'sitemap-news.xml' || route === 'news.xml' || route === 'feed-news.xml' || route === 'robots.txt') {
    return 'resource';
  }
  if (route === 'sitemap-chunk') return 'sitemap-chunk';
  return 'unknown';
}

function isLegacyRoutable(route) {
  return ['article', 'flash', 'news', 'category', 'tag', 'topics', 'authors', 'guide', 'markets', 'search'].includes(route);
}

function isDetailKind(kind) {
  return ['article-detail', 'flash-detail', 'tag-detail', 'topic-detail', 'author-detail', 'guide-detail'].includes(kind);
}

function hasNonAsciiOrMojibake(value) {
  return /[^\x00-\x7F]|�|锟|浠|骞|缇|鍖|鑲|鏍|棰|勬|祴|杈/.test(value);
}

function slugLooksTranslatedFromChinese(slug) {
  const normalized = slug
    .toLowerCase()
    .replace(/%[0-9a-f]{2}/gi, '-')
    .replace(/[^a-z0-9-]+/g, '-');
  const tokens = normalized.split('-').filter(Boolean);
  if (tokens.length < 8) return hasNonAsciiOrMojibake(slug);

  const hintCount = tokens.filter((token) => PINYIN_HINTS.has(token)).length;
  const shortTokenCount = tokens.filter((token) => token.length <= 4).length;
  const hintRatio = hintCount / tokens.length;
  const shortRatio = shortTokenCount / tokens.length;
  return hasNonAsciiOrMojibake(slug) || (hintCount >= 6 && hintRatio >= 0.4 && shortRatio >= 0.65);
}

function actionBucket(analysis) {
  const signals = new Set(analysis.signals);
  if (signals.has('origin-mismatch') || signals.has('invalid-url')) return 'Validate exported property and URL format';
  if (signals.has('legacy-no-locale')) return 'Confirm legacy redirect coverage';
  if (signals.has('english-detail-slug-review')) return 'Review English detail slugs';
  if (signals.has('query-in-detail-url')) return 'Clean malformed detail URLs';
  if (analysis.kind === 'flash-detail') return 'Let stale flash detail URLs age out';
  if (analysis.kind === 'unknown') return 'Map unknown URL pattern';
  return 'Sample in URL Inspection';
}

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function countSignals(items) {
  const counts = new Map();
  for (const item of items) {
    for (const signal of item.signals) {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  return counts;
}

function topEntries(counts, limit = 20) {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function dateRange(items) {
  const dates = items
    .map((item) => item.lastCrawled)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  return { first: dates[0], last: dates[dates.length - 1] };
}

function buildReport({ input, metadata, chart, analyses, siteOriginUrl, maxExamples }) {
  const issue = metadata.find((entry) => entry.property.toLowerCase() === 'issue')?.value || 'unknown';
  const crawledRange = dateRange(analyses);
  const lines = [];

  lines.push('# GSC Coverage Export Analysis');
  lines.push('');
  lines.push(`- Input: \`${input}\``);
  lines.push(`- Expected site origin: \`${siteOriginUrl.origin}\``);
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push(`- Table rows: ${analyses.length}`);
  lines.push(`- GSC issue: ${issue}`);
  if (crawledRange) lines.push(`- Last crawled range: ${crawledRange.first} to ${crawledRange.last}`);
  lines.push('');

  if (metadata.length > 0) {
    lines.push('## Metadata');
    lines.push('');
    lines.push('| Property | Value |');
    lines.push('| --- | --- |');
    for (const entry of metadata) {
      lines.push(`| ${md(entry.property)} | ${md(entry.value)} |`);
    }
    lines.push('');
  }

  if (chart) {
    lines.push('## Trend');
    lines.push('');
    if (chart.firstNonZero) lines.push(`- First non-zero chart date: ${chart.firstNonZero.date} (${chart.firstNonZero.count})`);
    lines.push(`- Latest chart date: ${chart.latest.date} (${chart.latest.count})`);
    lines.push(`- Previous delta: ${chart.deltaFromPrevious >= 0 ? '+' : ''}${chart.deltaFromPrevious}`);
    lines.push(`- Peak: ${chart.peak.date} (${chart.peak.count})`);
    lines.push('');
  }

  addCountTable(lines, 'URL Kind', topEntries(countBy(analyses, (item) => item.kind)));
  addCountTable(lines, 'Language Prefix', topEntries(countBy(analyses, (item) => item.lang)));
  addCountTable(lines, 'Signals', topEntries(countSignals(analyses)));
  addCountTable(lines, 'Action Buckets', topEntries(countBy(analyses, (item) => item.actionBucket)));
  addCountTable(lines, 'Last Crawled Dates', topEntries(countBy(analyses, (item) => item.lastCrawled || 'unknown'), 12));

  lines.push('## Examples');
  lines.push('');
  const exampleBuckets = [
    ['legacy-no-locale', (item) => item.signals.includes('legacy-no-locale')],
    ['english-detail-slug-review', (item) => item.signals.includes('english-detail-slug-review')],
    ['non-ascii-or-mojibake-url', (item) => item.signals.includes('non-ascii-or-mojibake-url')],
    ['query-in-detail-url', (item) => item.signals.includes('query-in-detail-url')],
    ['flash-detail', (item) => item.kind === 'flash-detail'],
    ['unknown-route', (item) => item.kind === 'unknown'],
  ];
  for (const [label, predicate] of exampleBuckets) {
    addExamples(lines, label, analyses.filter(predicate), maxExamples);
  }

  lines.push('## Recommended Follow-up');
  lines.push('');
  const signalCounts = countSignals(analyses);
  if (signalCounts.has('legacy-no-locale')) {
    lines.push('- Keep no-locale redirect regressions covered for `/article/*`, `/flash/*`, `/news/*` and category aliases while GSC recrawls old URLs.');
  }
  if (signalCounts.has('english-detail-slug-review')) {
    lines.push('- Review English detail URLs with pinyin, mojibake, or non-ASCII slugs; preserve redirects from legacy slugs to canonical English slugs when backfilling.');
  }
  if (signalCounts.has('query-in-detail-url')) {
    lines.push('- Inspect malformed detail URLs containing `?` inside the slug; these often indicate bad historical encoding or copied URLs.');
  }
  if (countBy(analyses, (item) => item.kind).get('flash-detail')) {
    lines.push('- Flash detail URLs should remain out of production sitemaps; if they appear here, treat them as stale crawl cleanup unless live redirects are failing.');
  }
  lines.push('- Use URL Inspection on a few examples from each large bucket after deploys; compare Google-selected canonical and live crawl status.');
  lines.push('');

  return lines.join('\n');
}

function addCountTable(lines, title, entries) {
  lines.push(`## ${title}`);
  lines.push('');
  if (entries.length === 0) {
    lines.push('_No data._');
    lines.push('');
    return;
  }
  lines.push('| Value | Count |');
  lines.push('| --- | ---: |');
  for (const [value, count] of entries) {
    lines.push(`| ${md(value)} | ${count} |`);
  }
  lines.push('');
}

function addExamples(lines, title, items, limit) {
  if (items.length === 0) return;
  lines.push(`### ${title}`);
  lines.push('');
  lines.push('| Last crawled | Kind | Language | URL |');
  lines.push('| --- | --- | --- | --- |');
  for (const item of items.slice(0, limit)) {
    lines.push(`| ${md(item.lastCrawled || 'unknown')} | ${md(item.kind)} | ${md(item.lang)} | ${md(item.url)} |`);
  }
  lines.push('');
}

function md(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = loadExport(options.input);
  const tableCsv = pickCsv(files, 'Table.csv') || files.find((file) => /table/i.test(file.name)) || files[0];
  if (!tableCsv) throw new Error('No CSV files found in GSC export.');

  const metadata = metadataEntries(pickCsv(files, 'Metadata.csv'));
  const chart = chartSummary(pickCsv(files, 'Chart.csv'));
  const analyses = analyzeTable(tableCsv, options.siteOriginUrl);
  const report = buildReport({
    input: options.input,
    metadata,
    chart,
    analyses,
    siteOriginUrl: options.siteOriginUrl,
    maxExamples: Math.floor(options.maxExamples),
  });

  console.log(report);
  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(options.output, `${report}\n`, 'utf8');
  }
}

main();
