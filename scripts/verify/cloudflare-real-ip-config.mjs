#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const configPaths = [
  path.join(rootDir, 'infra', 'nginx', 'yayanews.conf'),
  path.join(rootDir, 'infra', 'deploy', 'nginx-yayanews.conf'),
];
const rangeUrls = [
  'https://www.cloudflare.com/ips-v4',
  'https://www.cloudflare.com/ips-v6',
];

function fail(message) {
  throw new Error(message);
}

function parseRanges(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function parseConfiguredRanges(text) {
  return [...text.matchAll(/^\s*set_real_ip_from\s+([^;]+);/gm)]
    .map((match) => match[1].trim());
}

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

async function fetchOfficialRanges() {
  const responses = await Promise.all(rangeUrls.map(async (url) => {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'YayaNews-Cloudflare-IP-Config-Check/1.0' },
    });
    if (!response.ok) fail(`Cloudflare range fetch failed: ${url} (${response.status})`);
    return parseRanges(await response.text());
  }));
  return responses.flat();
}

async function main() {
  const configs = configPaths.map((configPath) => ({
    configPath,
    text: fs.readFileSync(configPath, 'utf8'),
  }));

  if (configs[0].text !== configs[1].text) {
    fail('Nginx source and deploy configs have drifted.');
  }

  const officialRanges = await fetchOfficialRanges();
  const configuredRanges = parseConfiguredRanges(configs[0].text);
  const officialSet = new Set(officialRanges);
  const configuredSet = new Set(configuredRanges);
  const missing = officialRanges.filter((range) => !configuredSet.has(range));
  const extra = configuredRanges.filter((range) => !officialSet.has(range));

  if (configuredRanges.length !== configuredSet.size) fail('Duplicate set_real_ip_from entries found.');
  if (missing.length || extra.length) {
    fail(`Cloudflare ranges differ: missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
  }

  const text = configs[0].text;
  if (!/^real_ip_header CF-Connecting-IP;$/m.test(text)) fail('Missing CF-Connecting-IP real_ip_header.');
  if (!/^real_ip_recursive on;$/m.test(text)) fail('Missing real_ip_recursive on.');
  if (!/^log_format yayanews_cf escape=json$/m.test(text)) {
    fail('Missing JSON-escaped yayanews_cf log format.');
  }
  if (count(text, /^\s*access_log \/var\/log\/nginx\/yayanews\.access\.log yayanews_cf;$/gm) !== 2) {
    fail('Expected dedicated access_log in both HTTP and HTTPS servers.');
  }
  if (text.includes('$proxy_add_x_forwarded_for')) {
    fail('proxy_add_x_forwarded_for duplicates the restored visitor address.');
  }

  const forwardedForCount = count(text, /^\s*proxy_set_header X-Forwarded-For \$remote_addr;$/gm);
  if (forwardedForCount < 1) fail('No proxy X-Forwarded-For header uses the restored address.');

  console.log(JSON.stringify({
    ok: true,
    configs: configPaths.map((configPath) => path.relative(rootDir, configPath)),
    cloudflareRanges: officialRanges.length,
    forwardedForLocations: forwardedForCount,
    accessLogs: 2,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
