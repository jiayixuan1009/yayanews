import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'apps/web/.next',
  'apps/admin/.next',
  'apps/ws-server/dist',
  'packages/database/dist',
  'packages/logger/dist',
  'packages/sanitize/dist',
  'packages/seo/dist',
  'packages/types/dist',
  '.next',
  '.turbo',
];

function assertInsideRoot(absPath) {
  const relative = path.relative(root, absPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside workspace: ${absPath}`);
  }
}

for (const target of targets) {
  const absPath = path.resolve(root, target);
  assertInsideRoot(absPath);

  if (!fs.existsSync(absPath)) {
    continue;
  }

  try {
    fs.rmSync(absPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
    console.log(`[clean] removed ${target}`);
  } catch (error) {
    const hint = process.platform === 'win32'
      ? ' Stop any local node/PM2/Next processes that may be using this build directory, then retry.'
      : '';
    throw new Error(`Failed to remove ${target}: ${error.message}.${hint}`);
  }
}
