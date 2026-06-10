#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';

const DEFAULT_BASE_URL = 'https://yayanews.cryptooptiontool.com';
const DEFAULT_PATHS = [
  '/',
  '/news',
  '/zh',
  '/en',
  '/admin',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap-news.xml',
  '/brand/logo-square.png',
];
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = Number(process.env.PUBLIC_HEALTH_TIMEOUT_MS || 15000);

const baseUrl = normalizeBaseUrl(process.env.PUBLIC_HEALTH_BASE_URL || DEFAULT_BASE_URL);
const paths = (process.env.PUBLIC_HEALTH_PATHS || DEFAULT_PATHS.join(','))
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

let failed = false;

for (const path of paths) {
  const target = new URL(path, baseUrl);
  const result = await checkUrl(target);
  const chain = result.chain.map(item => `${item.status} ${item.url}`).join(' -> ');
  if (result.ok) {
    console.log(`OK   ${target.pathname || '/'} - ${result.finalStatus} ${result.finalUrl}`);
    if (result.chain.length > 1) console.log(`INFO redirect - ${chain}`);
  } else {
    failed = true;
    console.log(`FAIL ${target.pathname || '/'} - ${result.reason}`);
    if (chain) console.log(`INFO redirect - ${chain}`);
  }
}

if (failed) process.exitCode = 1;

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    throw new Error(`Invalid PUBLIC_HEALTH_BASE_URL: ${value}`);
  }
}

async function checkUrl(startUrl) {
  const chain = [];
  let current = startUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const response = await requestUrl(current, 'HEAD').catch(async err => {
      if (err?.code === 'HEAD_UNSUPPORTED') {
        return requestUrl(current, 'GET');
      }
      return {
        status: 0,
        headers: {},
        error: err,
      };
    });

    if (response.status === 405 || response.status === 501) {
      const fallback = await requestUrl(current, 'GET').catch(err => ({
        status: 0,
        headers: {},
        error: err,
      }));
      response.status = fallback.status;
      response.headers = fallback.headers;
      response.error = fallback.error;
    }

    if (response.status >= 500 && response.status < 600) {
      const fallback = await requestUrl(current, 'GET').catch(err => ({
        status: 0,
        headers: {},
        error: err,
      }));
      if (!fallback.error) {
        response.status = fallback.status;
        response.headers = fallback.headers;
      }
    }

    if (!response) {
      return {
        ok: false,
        reason: `${current.toString()} empty response`,
        chain,
      };
    }

    if (response.error) {
      return {
        ok: false,
        reason: `${current.toString()} ${response.error.message}`,
        chain,
      };
    }

    chain.push({ status: response.status, url: current.toString() });

    const location = response.headers.location;
    if (location) {
      const next = new URL(location, current);
      if (isLocalhost(next)) {
        return {
          ok: false,
          reason: `redirected to localhost: ${next.toString()}`,
          chain,
        };
      }
      current = next;
      continue;
    }

    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      finalStatus: response.status,
      finalUrl: current.toString(),
      reason: ok ? '' : `${current.toString()} returned ${response.status}`,
      chain,
    };
  }

  return {
    ok: false,
    reason: `too many redirects after ${MAX_REDIRECTS}`,
    chain,
  };
}

function requestUrl(url, method) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'http:' ? http : https;
    const req = client.request(
      url,
      {
        method,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'YayaNews-Public-Health/1.0',
        },
      },
      res => {
        res.resume();
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error(`timeout after ${TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

function isLocalhost(url) {
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
