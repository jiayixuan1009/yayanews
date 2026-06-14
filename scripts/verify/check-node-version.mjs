#!/usr/bin/env node

const REQUIRED_MAJOR = 20;
const REQUIRED_MINOR = 19;
const isWindows = process.platform === 'win32';

function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

const current = parseVersion(process.version);

const unsupported =
  !current ||
  current.major < REQUIRED_MAJOR ||
  (current.major === REQUIRED_MAJOR && current.minor < REQUIRED_MINOR);
const windowsNextBuildHangRisk = isWindows && current?.major !== REQUIRED_MAJOR;

if (unsupported || windowsNextBuildHangRisk) {
  const reason = unsupported
    ? `Node.js ${REQUIRED_MAJOR}.${REQUIRED_MINOR}.x or newer is required.`
    : 'Windows local Next.js builds currently hang under Node.js 24 in this repo.';
  console.error([
    `Unsupported Node.js runtime: ${process.version}`,
    reason,
    `Use Node ${REQUIRED_MAJOR}.${REQUIRED_MINOR}.x before running install, dev, build, or start commands on Windows.`,
    '',
    'Windows examples:',
    '  nvm install 20.19.0',
    '  nvm use 20.19.0',
    '',
    'Then rerun:',
    '  npm ci',
    '  npm run build:web',
  ].join('\n'));
  process.exit(1);
}

if (current.major !== REQUIRED_MAJOR) {
  console.warn(
    `Warning: CI uses Node ${REQUIRED_MAJOR}.${REQUIRED_MINOR}.x; current runtime is ${process.version}.`
  );
}
