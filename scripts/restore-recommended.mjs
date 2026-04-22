/**
 * 使用仓库内「唯一且时间最新」的全量种子 data/cloud_seed.sql（HEAD）恢复数据库。
 * 内含英文快讯最新至种子内时间戳；英文长文 articles 在种子中不存在。
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

process.chdir(root);
execSync('git checkout HEAD -- data/cloud_seed.sql', { stdio: 'inherit' });
console.log('\n[restore] 已同步 data/cloud_seed.sql <- git HEAD');
console.log('[restore] 执行: npx dotenv-cli -e .env -- psql -v ON_ERROR_STOP=1 -f data/cloud_seed.sql\n');
execSync('npx dotenv-cli -e .env -- psql -v ON_ERROR_STOP=1 -f data/cloud_seed.sql', { stdio: 'inherit' });
console.log('\n[restore] 完成。');
console.log('[restore] 种子与当前库若有差异，可运行: npm run db:gap-report（查看缺失项与后续补齐建议）');
console.log('[restore] 仅看种子文件统计: npm run db:report:seed');
