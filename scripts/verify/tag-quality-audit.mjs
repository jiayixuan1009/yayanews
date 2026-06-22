#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readEnvFile } from '../lib/read-env.mjs';

const { Client } = pg;

const DEFAULT_ENV_PATH = '.env';
const DEFAULT_MIN_INDEXABLE_COUNT = 3;
const DEFAULT_MAX_EXAMPLES = 20;
const ASCII_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NON_ASCII_RE = /[^\x00-\x7F]/;

function usage() {
  return [
    'Usage: node scripts/verify/tag-quality-audit.mjs [options]',
    '',
    'Options:',
    `  --env <path>                  Env file to read when DATABASE_URL is not already set. Default: ${DEFAULT_ENV_PATH}`,
    `  --min-indexable-count <n>     Per-language article count required for an indexable tag page. Default: ${DEFAULT_MIN_INDEXABLE_COUNT}`,
    `  --max-examples <n>            Rows per report table. Default: ${DEFAULT_MAX_EXAMPLES}`,
    '  --output <path>               Write the Markdown report to a file as well as stdout.',
    '  -h, --help                    Show this help.',
    '',
    'This is a read-only audit. It mirrors the tag sitemap policy: ASCII slug plus at least N approved indexable articles per language.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    envPath: DEFAULT_ENV_PATH,
    output: '',
    minIndexableCount: DEFAULT_MIN_INDEXABLE_COUNT,
    maxExamples: DEFAULT_MAX_EXAMPLES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
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
    if (arg === '--output') {
      options.output = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      continue;
    }
    if (arg === '--min-indexable-count') {
      options.minIndexableCount = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--min-indexable-count=')) {
      options.minIndexableCount = Number(arg.slice('--min-indexable-count='.length));
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(options.minIndexableCount) || options.minIndexableCount < 1) {
    throw new Error(`Invalid --min-indexable-count: ${options.minIndexableCount}`);
  }
  if (!Number.isInteger(options.maxExamples) || options.maxExamples < 1) {
    throw new Error(`Invalid --max-examples: ${options.maxExamples}`);
  }

  return options;
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function databaseUrl(options) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const resolved = path.resolve(options.envPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`DATABASE_URL is not set and env file does not exist: ${resolved}`);
  }
  const value = readEnvFile(resolved).get('DATABASE_URL');
  if (!value) throw new Error(`DATABASE_URL is not set in ${resolved}`);
  return value;
}

async function loadRows(client) {
  const result = await client.query(`
    SELECT
      t.id,
      t.slug,
      t.name,
      COALESCE(t.name_en, '') AS name_en,
      COALESCE(a.lang, 'unknown') AS lang,
      COUNT(a.id)::int AS article_count,
      MAX(COALESCE(a.updated_at, a.published_at, a.created_at)) AS updated_at
    FROM tags t
    LEFT JOIN article_tags at ON at.tag_id = t.id
    LEFT JOIN articles a ON a.id = at.article_id
      AND a.status = 'published'
      AND a.audit_status = 'approved'
      AND a.deleted_at IS NULL
      AND a.is_indexable = TRUE
    GROUP BY t.id, t.slug, t.name, COALESCE(t.name_en, ''), COALESCE(a.lang, 'unknown')
    ORDER BY t.slug, COALESCE(a.lang, 'unknown')
  `);
  return result.rows;
}

function analyzeTags(rows, minIndexableCount) {
  const byId = new Map();
  for (const row of rows) {
    const tag = byId.get(row.id) || {
      id: row.id,
      slug: row.slug || '',
      name: row.name || '',
      nameEn: row.name_en || '',
      counts: { zh: 0, en: 0, unknown: 0 },
      updatedAt: '',
    };

    const lang = row.lang === 'zh' || row.lang === 'en' ? row.lang : 'unknown';
    tag.counts[lang] = Number(row.article_count || 0);
    if (row.updated_at) {
      const updatedAt = new Date(row.updated_at).toISOString();
      if (!tag.updatedAt || updatedAt > tag.updatedAt) tag.updatedAt = updatedAt;
    }

    byId.set(row.id, tag);
  }

  const tags = Array.from(byId.values()).map((tag) => {
    const asciiSlug = ASCII_SLUG_RE.test(tag.slug);
    const mojibakeSlug = NON_ASCII_RE.test(tag.slug);
    const indexableLangs = ['zh', 'en'].filter((lang) => asciiSlug && tag.counts[lang] >= minIndexableCount);
    const thinLangs = ['zh', 'en'].filter((lang) => tag.counts[lang] > 0 && tag.counts[lang] < minIndexableCount);
    const totalCount = tag.counts.zh + tag.counts.en + tag.counts.unknown;
    return {
      ...tag,
      totalCount,
      asciiSlug,
      mojibakeSlug,
      indexableLangs,
      thinLangs,
      orphan: totalCount === 0,
      missingEnglishName: tag.counts.en >= minIndexableCount && !tag.nameEn.trim(),
    };
  });

  return {
    tags,
    dirtySlugs: tags.filter((tag) => !tag.asciiSlug || tag.mojibakeSlug),
    thinTags: tags.filter((tag) => tag.thinLangs.length > 0),
    orphanTags: tags.filter((tag) => tag.orphan),
    missingEnglishNames: tags.filter((tag) => tag.missingEnglishName),
    indexableTags: tags.filter((tag) => tag.indexableLangs.length > 0),
  };
}

function buildReport(analysis, options) {
  const lines = [];
  const sitemapEntryCount = analysis.indexableTags.reduce((sum, tag) => sum + tag.indexableLangs.length, 0);

  lines.push('# Tag Quality Audit');
  lines.push('');
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push(`- Min indexable article count per language: ${options.minIndexableCount}`);
  lines.push(`- Total tags: ${analysis.tags.length}`);
  lines.push(`- Indexable tag pages: ${sitemapEntryCount}`);
  lines.push(`- Tags eligible for at least one sitemap entry: ${analysis.indexableTags.length}`);
  lines.push(`- Dirty or non-ASCII slugs excluded by sitemap policy: ${analysis.dirtySlugs.length}`);
  lines.push(`- Thin tag-language pairs kept noindex by page metadata: ${countThinPairs(analysis.thinTags)}`);
  lines.push(`- Orphan tags: ${analysis.orphanTags.length}`);
  lines.push(`- English-eligible tags missing name_en: ${analysis.missingEnglishNames.length}`);
  lines.push('');

  addTagTable(lines, 'Indexable Tag Candidates', analysis.indexableTags.sort(sortByTotalCount), options.maxExamples);
  addTagTable(lines, 'Dirty Slugs To Clean Or Leave Excluded', analysis.dirtySlugs.sort(sortByTotalCount), options.maxExamples);
  addTagTable(lines, 'Thin Tag Pages', analysis.thinTags.sort(sortByTotalCount), options.maxExamples);
  addTagTable(lines, 'English Name Gaps', analysis.missingEnglishNames.sort(sortByTotalCount), options.maxExamples);

  lines.push('## Recommended Follow-up');
  lines.push('');
  lines.push('- Keep sitemap inclusion limited to ASCII slugs with enough approved, indexable articles in the matching language.');
  lines.push('- For dirty slugs that have real search value, create a clean slug and preserve the old URL through the tag canonical redirect path.');
  lines.push('- Do not force thin tags into sitemap; either add enough strong articles or let the tag page remain noindex.');
  lines.push('- For English-eligible tags, fill `name_en` before relying on the page for English search snippets.');
  lines.push('');

  return lines.join('\n');
}

function countThinPairs(tags) {
  return tags.reduce((sum, tag) => sum + tag.thinLangs.length, 0);
}

function sortByTotalCount(a, b) {
  return b.totalCount - a.totalCount || a.slug.localeCompare(b.slug);
}

function addTagTable(lines, title, tags, limit) {
  lines.push(`## ${title}`);
  lines.push('');
  if (tags.length === 0) {
    lines.push('_No matching tags._');
    lines.push('');
    return;
  }

  lines.push('| Slug | Name | name_en | zh | en | Indexable Langs | Thin Langs | Updated |');
  lines.push('| --- | --- | --- | ---: | ---: | --- | --- | --- |');
  for (const tag of tags.slice(0, limit)) {
    lines.push([
      md(tag.slug),
      md(tag.name),
      md(tag.nameEn || 'n/a'),
      tag.counts.zh,
      tag.counts.en,
      md(tag.indexableLangs.join(', ') || 'none'),
      md(tag.thinLangs.join(', ') || 'none'),
      md(tag.updatedAt || 'n/a'),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');
}

function md(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = new Client({ connectionString: databaseUrl(options) });
  await client.connect();
  try {
    const rows = await loadRows(client);
    const analysis = analyzeTags(rows, options.minIndexableCount);
    const report = buildReport(analysis, options);
    console.log(report);
    if (options.output) {
      fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
      fs.writeFileSync(options.output, `${report}\n`, 'utf8');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
