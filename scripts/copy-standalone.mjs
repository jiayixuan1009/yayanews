import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, '.next', 'standalone');

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

// 拷贝 .next/static 到 .next/standalone/.next/static
const nextStaticSrc = path.join(rootDir, '.next', 'static');
const nextStaticDest = path.join(standaloneDir, '.next', 'static');
console.log('Copying static assets to standalone directory...');
copyRecursiveSync(nextStaticSrc, nextStaticDest);

// 拷贝 public 文件夹到 .next/standalone/public
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  copyRecursiveSync(publicSrc, publicDest);
}

console.log('✅ Successfully prepared Next.js standalone directory.');
