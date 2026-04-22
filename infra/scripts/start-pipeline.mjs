import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../');
const pipelineDir = path.resolve(rootDir, 'apps/pipeline');
const venvDir = path.join(pipelineDir, '.venv');

const isWin = process.platform === 'win32';
const venvPythonDirs = isWin ? ['Scripts', 'python.exe'] : ['bin', 'python'];
const venvPythonPath = path.join(venvDir, ...venvPythonDirs);

if (!fs.existsSync(venvDir) || !fs.existsSync(venvPythonPath)) {
  console.warn('\n===============================================================');
  console.warn('⚠️  [Pipeline] 拦截保护: 找不到该服务的专属隔离引擎 (.venv) !!!');
  console.warn('⚠️  [Pipeline] 建议操作: 请在根目录新开终端执行 `npm run setup`');
  console.warn('⚠️  [Pipeline] 运行状态: 已为您平滑退出该线程，拦截并发报错海啸。');
  console.warn('===============================================================\n');
  process.exit(0); // Exit gracefully to not trigger concurrently cascade restarts
}

console.log(`[Pipeline] 正在通过隔离环境 ${venvPythonPath} 唤起后台核心...`);
const child = spawn(`"${venvPythonPath}"`, ['-m', 'pipeline.run_daemon'], {
  cwd: pipelineDir,
  shell: true,
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error(`[Pipeline] 线程发生错误: ${err.message}`);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[Pipeline] 线程已中断，退出码: ${code}`);
  }
});
