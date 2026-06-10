#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');
const { readEnvFile } = require('../lib/read-env.cjs');

const [envPathArg, command, ...args] = process.argv.slice(2);

if (!envPathArg || !command) {
  console.error('Usage: node scripts/ops/run-with-env.cjs <env-file> <command> [args...]');
  process.exit(2);
}

const envPath = path.resolve(envPathArg);
const fileEnv = Object.fromEntries(readEnvFile(envPath));
const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...fileEnv,
    ...process.env,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', err => {
  console.error(err.message);
  process.exit(1);
});
