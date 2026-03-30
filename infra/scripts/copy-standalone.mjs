import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const webAppDir = path.join(rootDir, 'apps', 'web');
const standaloneDir = path.join(webAppDir, '.next', 'standalone');

// 只有开启了 standalone 输出才会生成该目录
if (!fs.existsSync(standaloneDir)) {
  console.log('Standalone mode not detected. Skipping static copy.');
  process.exit(0);
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 拷贝 .next/static 到 .next/standalone/apps/web/.next/static
const nextStaticSrc = path.join(webAppDir, '.next', 'static');
const nextStaticDest = path.join(standaloneDir, 'apps', 'web', '.next', 'static');
console.log('Copying static assets to standalone directory...');
copyRecursiveSync(nextStaticSrc, nextStaticDest);

// 拷贝 public 文件夹到 .next/standalone/apps/web/public
const publicSrc = path.join(webAppDir, 'public');
const publicDest = path.join(standaloneDir, 'apps', 'web', 'public');
if (fs.existsSync(publicSrc)) {
  copyRecursiveSync(publicSrc, publicDest);
}

console.log('✅ Successfully prepared Next.js standalone directory for monorepo web app.');

// ─── Admin App ─────────────────────────────────────────────────────────────
const adminAppDir = path.join(rootDir, 'apps', 'admin');
const adminStandaloneDir = path.join(adminAppDir, '.next', 'standalone');

if (fs.existsSync(adminStandaloneDir)) {
  const adminStaticSrc = path.join(adminAppDir, '.next', 'static');
  const adminStaticDest = path.join(adminStandaloneDir, 'apps', 'admin', '.next', 'static');
  console.log('Copying admin static assets to standalone...');
  copyRecursiveSync(adminStaticSrc, adminStaticDest);
  console.log('✅ Successfully prepared Next.js standalone directory for admin app.');
} else {
  console.log('Admin standalone not found, skipping (run npm run build -w @yayanews/admin first).');
}
