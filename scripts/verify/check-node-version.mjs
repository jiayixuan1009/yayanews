#!/usr/bin/env node

// Node 22 is the target (CI, Docker, .nvmrc). Node 20 reached end of life in April 2026
// and gets no security fixes; 20.19+ is still accepted only so a server that has not
// been upgraded yet keeps deploying. Remove 20 from SUPPORTED once production runs 22.
const PREFERRED = 22;
const SUPPORTED = { 20: 19, 22: 0 }; // major -> minimum minor
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
const minMinor = current ? SUPPORTED[current.major] : undefined;
const supported = current && minMinor !== undefined && current.minor >= minMinor;
// Windows local Next.js builds hung under Node 24 in this repo; 23+ stays blocked there.
const windowsNextBuildHangRisk = isWindows && current && current.major > PREFERRED;

if (!supported && (!current || current.major < PREFERRED || windowsNextBuildHangRisk)) {
  const reason = windowsNextBuildHangRisk
    ? 'Windows local Next.js builds currently hang under Node.js 24 in this repo.'
    : `Node.js ${PREFERRED}.x is required (20.19+ is accepted during the upgrade).`;
  console.error([
    `Unsupported Node.js runtime: ${process.version}`,
    reason,
    `Use Node ${PREFERRED} before running install, dev, build, start, or verify commands.`,
    '',
    'Examples:',
    `  nvm install ${PREFERRED}`,
    `  nvm use ${PREFERRED}`,
    '',
    'Then rerun:',
    '  npm ci',
    '  npm run build:web',
  ].join('\n'));
  process.exit(1);
}

if (current.major !== PREFERRED) {
  console.warn(
    current.major === 20
      ? `Warning: Node ${process.version} is end of life (no security fixes). CI and Docker use Node ${PREFERRED}; upgrade this machine.`
      : `Warning: CI uses Node ${PREFERRED}.x; current runtime is ${process.version}.`
  );
}
