#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://yayanews.cryptooptiontool.com';
const DEFAULT_EXPECTED_ORIGIN = 'https://yayanews.cryptooptiontool.com';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

const REDIRECT_CASES = [
  {
    name: 'root defaults to zh',
    path: '/',
    expectedStatus: 308,
    expectedLocation: '/zh',
    finalStatus: 200,
    finalPath: '/zh',
  },
  {
    name: 'news defaults to zh',
    path: '/news',
    expectedStatus: 308,
    expectedLocation: '/zh/news',
    finalStatus: 200,
    finalPath: '/zh/news',
  },
  {
    name: 'root respects english accept-language',
    path: '/',
    expectedStatus: 308,
    expectedLocation: '/en',
    finalStatus: 200,
    finalPath: '/en',
    headers: { 'accept-language': 'en-US,en;q=0.9' },
  },
  {
    name: 'root respects english locale cookie',
    path: '/',
    expectedStatus: 308,
    expectedLocation: '/en',
    finalStatus: 200,
    finalPath: '/en',
    headers: { cookie: 'NEXT_LOCALE=en' },
  },
  {
    name: 'locale trailing slash is normalized',
    path: '/zh/',
    expectedStatus: 308,
    expectedLocation: '/zh',
    finalStatus: 200,
    finalPath: '/zh',
  },
  {
    name: 'english locale trailing slash is normalized',
    path: '/en/',
    expectedStatus: 308,
    expectedLocation: '/en',
    finalStatus: 200,
    finalPath: '/en',
  },
  {
    name: 'legacy category alias keeps zh locale',
    path: '/zh/category/us-stock',
    expectedStatus: 308,
    expectedLocation: '/zh/news/us-stock',
    finalStatus: 200,
    finalPath: '/zh/news/us-stock',
  },
  {
    name: 'legacy category alias keeps en locale',
    path: '/en/category/crypto',
    expectedStatus: 308,
    expectedLocation: '/en/news/crypto',
    finalStatus: 200,
    finalPath: '/en/news/crypto',
  },
  {
    name: 'rss legacy endpoint redirects to news sitemap',
    path: '/news.xml',
    expectedStatus: 308,
    expectedLocation: '/sitemap-news.xml',
    finalStatus: 200,
    finalPath: '/sitemap-news.xml',
  },
  {
    name: 'encoded legacy flash slug is safely localized',
    path: '/flash/dogwifhat%E6%B5%8B%E8%AF%95-104147',
    expectedStatus: 308,
    expectedLocation: '/zh/flash/dogwifhat%E6%B5%8B%E8%AF%95-104147',
    finalStatus: [200, 404],
    finalPath: '/zh/flash/dogwifhat价格预测-2032年或达4-50美元-104147',
  },
  {
    name: 'no-locale article slug is safely localized',
    path: '/article/bitcoin-etf-market-update',
    expectedStatus: 308,
    expectedLocation: '/zh/article/bitcoin-etf-market-update',
    finalStatus: [200, 404],
    finalPath: '/zh/article/bitcoin-etf-market-update',
  },
  {
    name: 'legacy article slug may resolve through suffixed redirect map',
    path: '/en/article/fang-cheng-shi-xin-wen-bwenews',
    expectedStatus: [200, 308, 404],
    expectedLocation: '/en/article/english-article-3e2470f8',
    finalStatus: [200, 404],
    finalPath: '/en/article/english-article-3e2470f8',
    allowMissingLocationWhenStatus: [200, 404],
  },
  {
    name: 'query string survives locale redirect',
    path: '/news?utm_source=gsc',
    expectedStatus: 308,
    expectedLocation: '/zh/news?utm_source=gsc',
    finalStatus: 200,
    finalPath: '/zh/news?utm_source=gsc',
  },
];

const DIRECT_CASES = [
  { name: 'localized zh home stays direct', path: '/zh', expectedStatus: 200 },
  { name: 'localized en home stays direct', path: '/en', expectedStatus: 200 },
  { name: 'robots stays direct', path: '/robots.txt', expectedStatus: 200 },
  { name: 'sitemap stays direct', path: '/sitemap.xml', expectedStatus: 200 },
  { name: 'news sitemap stays direct', path: '/sitemap-news.xml', expectedStatus: 200 },
  { name: 'sitemap chunk stays direct', path: '/sitemap-chunk/static/0', expectedStatus: 200 },
  { name: 'brand asset stays direct', path: '/brand/og-default.png', expectedStatus: 200 },
  { name: 'google verification file stays direct', path: '/google557e7d124058718a.html', expectedStatus: 200 },
  { name: 'text verification file stays direct', path: '/db1162aa32014bba89ab29ba04a5ddba.txt', expectedStatus: 200 },
  { name: 'admin is not localized', path: '/admin', expectedStatus: [200, 302, 401, 403, 404, 405] },
  { name: 'api is not localized', path: '/api/articles', expectedStatus: [200, 400, 401, 404, 405] },
];

function usage() {
  return [
    'Usage: node scripts/verify/redirect-regression.mjs [--base <url>] [--expected-origin <url>] [--fetch-timeout-ms <n>]',
    '',
    `Default base: ${DEFAULT_BASE_URL}`,
    `Default expected origin: ${DEFAULT_EXPECTED_ORIGIN}`,
    'Example: npm run verify:redirects -- --base https://yayanews.cryptooptiontool.com',
  ].join('\n');
}

function parseArgs(argv) {
  let base = process.env.REDIRECT_BASE_URL || DEFAULT_BASE_URL;
  let expectedOrigin = process.env.REDIRECT_EXPECTED_ORIGIN || DEFAULT_EXPECTED_ORIGIN;
  let fetchTimeoutMs = Number(process.env.REDIRECT_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--base') {
      base = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
      continue;
    }
    if (arg === '--expected-origin') {
      expectedOrigin = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--expected-origin=')) {
      expectedOrigin = arg.slice('--expected-origin='.length);
      continue;
    }
    if (arg === '--fetch-timeout-ms') {
      fetchTimeoutMs = Number(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--fetch-timeout-ms=')) {
      fetchTimeoutMs = Number(arg.slice('--fetch-timeout-ms='.length));
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(fetchTimeoutMs) || fetchTimeoutMs < 1000) {
    throw new Error(`Invalid fetch timeout: ${fetchTimeoutMs}`);
  }

  return {
    baseUrl: normalizedBaseUrl(base),
    expectedBaseUrl: normalizedBaseUrl(expectedOrigin),
    fetchTimeoutMs,
  };
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function normalizedBaseUrl(value) {
  const url = new URL(value);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function expectedStatuses(value) {
  return Array.isArray(value) ? value : [value];
}

function isExpectedStatus(actual, expected) {
  return expectedStatuses(expected).includes(actual);
}

function displayExpected(value) {
  return expectedStatuses(value).join(' or ');
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

function samePathAndSearch(actual, expected) {
  const left = normalizePathAndSearch(actual);
  const right = normalizePathAndSearch(expected);
  return left === right;
}

function normalizePathAndSearch(pathAndSearch) {
  const url = new URL(pathAndSearch, 'https://example.test');
  const pathname = url.pathname !== '/' && url.pathname.endsWith('/')
    ? url.pathname.replace(/\/+$/, '')
    : url.pathname;
  return `${pathname}${url.search}`;
}

function normalizedAbsolute(url, baseUrl) {
  const parsed = new URL(url, baseUrl);
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed;
}

function locationPath(location, requestUrl) {
  if (!location) return '';
  const target = new URL(location, requestUrl);
  return `${target.pathname}${target.search}`;
}

function isLocalhost(url) {
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestManual(url, headers, timeoutMs) {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'YayaNews-Redirect-Regression/1.0',
      ...headers,
    },
  }, timeoutMs);
  await response.body?.cancel().catch(() => {});
  return response;
}

async function followChain(startUrl, headers, timeoutMs) {
  const chain = [];
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await requestManual(current, headers, timeoutMs);
    const location = response.headers.get('location');
    chain.push({
      url: current.toString(),
      status: response.status,
      location,
    });

    if (!location || response.status < 300 || response.status >= 400) return chain;

    const next = new URL(location, current);
    if (isLocalhost(next)) {
      chain.push({ url: next.toString(), status: 0, location: '', error: 'redirected to localhost' });
      return chain;
    }
    current = next;
  }

  chain.push({ url: current.toString(), status: 0, location: '', error: `too many redirects after ${MAX_REDIRECTS}` });
  return chain;
}

async function checkRedirectCase(testCase, baseUrl, expectedBaseUrl, fetchTimeoutMs) {
  const failures = [];
  const url = new URL(testCase.path, baseUrl);
  const response = await requestManual(url, testCase.headers || {}, fetchTimeoutMs);
  const location = response.headers.get('location');

  if (!isExpectedStatus(response.status, testCase.expectedStatus)) {
    failures.push(`status: expected ${displayExpected(testCase.expectedStatus)}, got ${response.status}`);
  }

  if (!isRedirectStatus(response.status) && testCase.allowMissingLocationWhenStatus?.includes(response.status)) {
    return failures;
  }

  if (!location) {
    failures.push(`location: expected ${testCase.expectedLocation}, got missing`);
  } else {
    const target = new URL(location, url);
    if (isLocalhost(target)) failures.push(`location: redirected to localhost ${target.toString()}`);
    if (target.origin !== expectedBaseUrl.origin) {
      failures.push(`location origin: expected ${expectedBaseUrl.origin}, got ${target.origin}`);
    }
    if (!samePathAndSearch(`${target.pathname}${target.search}`, testCase.expectedLocation)) {
      failures.push(`location: expected ${testCase.expectedLocation}, got ${target.pathname}${target.search}`);
    }
  }

  if (testCase.finalStatus && isRedirectStatus(response.status)) {
    const chain = await followChain(url, testCase.headers || {}, fetchTimeoutMs);
    const final = chain[chain.length - 1];
    if (final.error) failures.push(`final: ${final.error}`);
    if (!isExpectedStatus(final.status, testCase.finalStatus)) {
      failures.push(`final status: expected ${displayExpected(testCase.finalStatus)}, got ${final.status}`);
    }
    if (testCase.finalPath) {
      const finalUrl = normalizedAbsolute(final.url, baseUrl);
      if (!samePathAndSearch(`${finalUrl.pathname}${finalUrl.search}`, testCase.finalPath)) {
        failures.push(`final path: expected ${testCase.finalPath}, got ${finalUrl.pathname}${finalUrl.search}`);
      }
    }
    const chainText = chain.map((item) => {
      const loc = item.location ? ` -> ${locationPath(item.location, item.url)}` : '';
      return `${item.status} ${new URL(item.url).pathname}${loc}`;
    }).join(' | ');
    if (chain.length > 3) failures.push(`redirect chain too long: ${chainText}`);
  }

  return failures;
}

async function checkDirectCase(testCase, baseUrl, fetchTimeoutMs) {
  const failures = [];
  const url = new URL(testCase.path, baseUrl);
  const response = await requestManual(url, testCase.headers || {}, fetchTimeoutMs);
  const location = response.headers.get('location');

  if (!isExpectedStatus(response.status, testCase.expectedStatus)) {
    failures.push(`status: expected ${displayExpected(testCase.expectedStatus)}, got ${response.status}`);
  }
  if (location && /\/(zh|en)(?:\/|$)/.test(locationPath(location, url))) {
    failures.push(`unexpected locale redirect: ${location}`);
  }

  return failures;
}

async function main() {
  const { baseUrl, expectedBaseUrl, fetchTimeoutMs } = parseArgs(process.argv.slice(2));
  console.log(`Checking redirects at ${baseUrl.origin}`);
  console.log(`Expected redirect origin: ${expectedBaseUrl.origin}`);
  console.log(`Fetch timeout: ${fetchTimeoutMs}ms`);

  let failed = 0;
  const total = REDIRECT_CASES.length + DIRECT_CASES.length;

  for (const testCase of REDIRECT_CASES) {
    try {
      const failures = await checkRedirectCase(testCase, baseUrl, expectedBaseUrl, fetchTimeoutMs);
      if (failures.length > 0) {
        failed += 1;
        console.error(`FAIL ${testCase.name} (${testCase.path})`);
        for (const failure of failures) console.error(`  - ${failure}`);
      } else {
        console.log(`OK   ${testCase.name} (${testCase.path})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${testCase.name} (${testCase.path})`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const testCase of DIRECT_CASES) {
    try {
      const failures = await checkDirectCase(testCase, baseUrl, fetchTimeoutMs);
      if (failures.length > 0) {
        failed += 1;
        console.error(`FAIL ${testCase.name} (${testCase.path})`);
        for (const failure of failures) console.error(`  - ${failure}`);
      } else {
        console.log(`OK   ${testCase.name} (${testCase.path})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${testCase.name} (${testCase.path})`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failed > 0) {
    console.error(`Redirect regression check failed: ${failed}/${total} checks failed.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Redirect regression check passed: ${total}/${total} checks OK.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
