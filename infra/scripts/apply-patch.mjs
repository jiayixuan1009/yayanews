import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') }); // 解析根目录下的 .env

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ 找不到 DATABASE_URL 环境变量，请确保 .env 文件存在并且格式正确！');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl });

async function applyPatch() {
  console.log('🔄 开始向数据库注入 i18n 增量补丁...');
  try {
    const sqlPath = path.join(__dirname, 'patch-i18n.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    console.log('✅ 数据库架构更新成功 (name_zh, name_en 等字段已附加上)');
  } catch (err) {
    console.error('❌ 补丁执行失败:', err);
  } finally {
    await pool.end();
  }
}

applyPatch();
