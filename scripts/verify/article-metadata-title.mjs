#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve('apps/web/src/lib/article-metadata-title.ts');
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

const { articleMetadataTitle, stripEditorialTitleSuffix } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`
);

const currentGscTitle = '原油期货曲线陡峭化分析：供需博弈如何推动远期溢价扩大 | 衍生品市场观察';
const expectedCurrentTitle = '原油期货曲线陡峭化分析：供需博弈如何推动远期溢价扩大';
const substantivePipeTitle = 'Oil and Gas Spread | What the Curve Signals for Refiners';
const longEnglishTitle = 'A very long market analysis title that should be truncated without leaving a partial final English word when it exceeds the metadata title budget for article pages';

const checks = [
  {
    name: 'strip known editorial suffix',
    actual: stripEditorialTitleSuffix(currentGscTitle),
    expected: expectedCurrentTitle,
  },
  {
    name: 'preserve substantive pipe segment',
    actual: stripEditorialTitleSuffix(substantivePipeTitle),
    expected: substantivePipeTitle,
  },
  {
    name: 'current GSC title remains within Chinese budget',
    actual: articleMetadataTitle(currentGscTitle, 'zh'),
    expected: expectedCurrentTitle,
  },
];

for (const check of checks) {
  if (check.actual !== check.expected) {
    throw new Error(`${check.name}: expected "${check.expected}", got "${check.actual}".`);
  }
}

const truncatedEnglish = articleMetadataTitle(longEnglishTitle, 'en');
if (Array.from(truncatedEnglish).length > 95 || !truncatedEnglish.endsWith('…')) {
  throw new Error(`English truncation failed: ${truncatedEnglish}`);
}
if (/\s\S{1,20}…$/.test(truncatedEnglish) && !/\s\w+…$/.test(truncatedEnglish)) {
  throw new Error(`English title appears to end on a partial token: ${truncatedEnglish}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: checks.length + 1,
  gscTitleBefore: currentGscTitle,
  gscTitleAfter: articleMetadataTitle(currentGscTitle, 'zh'),
  substantivePipePreserved: true,
  truncatedEnglish,
}, null, 2));
