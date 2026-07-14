#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve('apps/web/src/lib/news-sitemap-policy.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
  reportDiagnostics: true,
});

const errors = (output.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
if (errors.length > 0) {
  throw new Error(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'));
}

const policy = await import(`data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`);
const {
  MAX_NEWS_SITEMAP_ITEMS,
  MAX_ITEMS_PER_TOPIC,
  MAX_ITEMS_PER_TITLE_PREFIX,
  diversifyNewsArticles,
  titlePrefixKey,
  topicKey,
} = policy;

const candidates = [];
const addSeries = (topic, categorySlug, count) => {
  for (let index = 0; index < count; index += 1) {
    candidates.push({
      id: candidates.length + 1,
      title: `${topic}${String(index).padStart(3, '0')} 市场更新与交易信号`,
      category_slug: categorySlug,
    });
  }
};

addSeries('黄金', 'commodities', 20);
addSeries('比特币', 'crypto', 20);
addSeries('原油', 'commodities', 20);
addSeries('港股恒指', 'hk-stock', 20);
addSeries('美股纳指', 'us-stock', 20);
addSeries('外汇宏观', 'forex', 20);

for (let index = 0; index < 8; index += 1) {
  candidates.splice(index * 3, 0, {
    id: 1000 + index,
    title: `美联储政策路径：重复标题模板 ${index}`,
    category_slug: 'macro',
  });
}

const selected = diversifyNewsArticles(candidates);
const topicCounts = new Map();
const prefixCounts = new Map();
for (const article of selected) {
  const topic = topicKey(article);
  const prefix = titlePrefixKey(article.title);
  topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  if (prefix) prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
}

const sourceOrder = new Map(candidates.map((article, index) => [article.id, index]));
const selectedOrder = selected.map((article) => sourceOrder.get(article.id));
const preservesOrder = selectedOrder.every((value, index) => index === 0 || value > selectedOrder[index - 1]);
const maxTopicCount = Math.max(...topicCounts.values());
const maxPrefixCount = Math.max(...prefixCounts.values());

if (selected.length !== MAX_NEWS_SITEMAP_ITEMS) {
  throw new Error(`Expected ${MAX_NEWS_SITEMAP_ITEMS} selected articles, got ${selected.length}.`);
}
if (maxTopicCount > MAX_ITEMS_PER_TOPIC) {
  throw new Error(`Topic cap exceeded: ${maxTopicCount} > ${MAX_ITEMS_PER_TOPIC}.`);
}
if (maxPrefixCount > MAX_ITEMS_PER_TITLE_PREFIX) {
  throw new Error(`Title-prefix cap exceeded: ${maxPrefixCount} > ${MAX_ITEMS_PER_TITLE_PREFIX}.`);
}
if (!preservesOrder) throw new Error('Diversification changed source recency order.');

console.log(JSON.stringify({
  ok: true,
  candidates: candidates.length,
  selected: selected.length,
  maxTopicCount,
  maxPrefixCount,
  preservesOrder,
  topics: Object.fromEntries([...topicCounts.entries()].sort()),
}, null, 2));
