import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../');
const pipelineDir = path.resolve(rootDir, 'apps/pipeline');
const venvDir = path.join(pipelineDir, '.venv');

const isWin = process.platform === 'win32';
const venvPipDirs = isWin ? ['Scripts', 'pip'] : ['bin', 'pip'];

try {
  console.log('--- Setting up Python Virtual Environment ---');
  if (!fs.existsSync(venvDir)) {
    console.log(`[setup] Creating virtual environment at ${venvDir}...`);
    // Try python -m venv first, as it works out of the box on Windows and Linux where aliased
    try {
      execSync(`python -m venv "${venvDir}"`, { stdio: 'inherit' });
    } catch {
      console.log(`[setup] Fallback to python3...`);
      execSync(`python3 -m venv "${venvDir}"`, { stdio: 'inherit' });
    }
  } else {
    console.log(`[setup] Virtual environment already exists at ${venvDir}.`);
  }

  const venvPipPath = path.join(venvDir, ...venvPipDirs);
  const requirementsPath = path.join(pipelineDir, 'requirements.txt');

  console.log(`[setup] Installing requirements via virtual environment pip...`);
  // Ensure we encapsulate everything to strictly use the sandboxed `.venv/bin/pip`
  execSync(`"${venvPipPath}" install -r "${requirementsPath}"`, { stdio: 'inherit' });
  console.log('✅ Successfully setup Pipeline Python environment.');
} catch (error) {
  console.error('❌ Failed to setup Python environment:', error.message);
  process.exit(1);
}
