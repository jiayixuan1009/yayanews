/**
 * 从 monorepo 根目录启动 Pipeline Agent6 英文长文补齐（需 Python + apps/pipeline 依赖）
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const batch = process.env.TRANSLATE_EN_BATCH || '5';
const cwd = path.join(root, 'apps', 'pipeline');
const passthrough = process.argv.slice(2);

const py = process.platform === 'win32' ? 'python' : 'python3';
const r = spawnSync(
  py,
  ['-m', 'pipeline.translate_en', '--batch', batch, ...passthrough],
  {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, PYTHONUTF8: '1' },
});

process.exit(r.status === null ? 1 : r.status);
