import fs from 'node:fs';

export function readEnvFile(envPath) {
  const values = new Map();
  const content = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

export function readRequiredEnvValue(envPath, key) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
  }

  const value = readEnvFile(envPath).get(key);
  if (!value) {
    throw new Error(`Missing ${key} in ${envPath}`);
  }

  return value;
}
