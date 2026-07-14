#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const workspaceToAppDir = new Map([
  ['@yayanews/admin', path.join('apps', 'admin')],
  ['@yayanews/web', path.join('apps', 'web')],
]);

function usage() {
  return [
    'Usage: node scripts/build-next-app.mjs <workspace> [options]',
    '',
    'Options:',
    '  --standalone          Build with Next output=standalone.',
    '  --no-standalone       Build without standalone output.',
    '  --dist-dir <dir>      Set NEXT_DIST_DIR for this build.',
    '  --no-clean            Do not remove the target dist dir before building.',
    '  -h, --help            Show this help.',
  ].join('\n');
}

function requireValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value) throw new Error(`Missing value for ${optionName}`);
  return value;
}

function parseArgs(argv) {
  const options = {
    workspace: '',
    standalone: null,
    distDir: '',
    clean: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--standalone') {
      options.standalone = true;
      continue;
    }
    if (arg === '--no-standalone') {
      options.standalone = false;
      continue;
    }
    if (arg === '--dist-dir') {
      options.distDir = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--dist-dir=')) {
      options.distDir = arg.slice('--dist-dir='.length);
      continue;
    }
    if (arg === '--no-clean') {
      options.clean = false;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (options.workspace) throw new Error(`Unexpected extra workspace: ${arg}`);
    options.workspace = arg;
  }

  if (!options.workspace) throw new Error('Missing workspace.');
  return options;
}

function removeDistDir(options) {
  if (!options.clean || !options.distDir) return;
  const appDir = workspaceToAppDir.get(options.workspace);
  if (!appDir) return;

  const root = process.cwd();
  const target = path.resolve(root, appDir, options.distDir);
  const allowedRoot = path.resolve(root, appDir);
  if (!target.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`Refusing to clean outside app directory: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  removeDistDir(options);

  const env = { ...process.env };
  if (options.standalone !== null) {
    env.NEXT_OUTPUT_STANDALONE = options.standalone ? '1' : '0';
  }
  if (options.distDir) {
    env.NEXT_DIST_DIR = options.distDir;
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', 'build', '-w', options.workspace];
  console.log(`[build-next-app] ${npm} ${args.join(' ')}`);
  if (options.distDir) console.log(`[build-next-app] NEXT_DIST_DIR=${options.distDir}`);
  if (options.standalone !== null) console.log(`[build-next-app] NEXT_OUTPUT_STANDALONE=${env.NEXT_OUTPUT_STANDALONE}`);

  await new Promise((resolve, reject) => {
    const child = spawn(npm, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with exit code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
