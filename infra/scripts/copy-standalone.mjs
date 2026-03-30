import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

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

function processApp(appName) {
  const appDir = path.join(rootDir, 'apps', appName);
  const standaloneDir = path.join(appDir, '.next', 'standalone');

  if (!fs.existsSync(standaloneDir)) {
    console.log(`[${appName}] Standalone not found, skipping.`);
    return;
  }

  const staticSrc = path.join(appDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, 'apps', appName, '.next', 'static');
  console.log(`[${appName}] Copying static assets to standalone...`);
  copyRecursiveSync(staticSrc, staticDest);

  const publicSrc = path.join(appDir, 'public');
  const publicDest = path.join(standaloneDir, 'apps', appName, 'public');
  if (fs.existsSync(publicSrc)) {
    console.log(`[${appName}] Copying public assets to standalone...`);
    copyRecursiveSync(publicSrc, publicDest);
  }

  console.log(`[${appName}] ✅ Successfully prepared standalone directory.`);
}

console.log('--- Preparing Standalone Builds ---');
processApp('web');
processApp('admin');
